"""
modes/impromptu.py — Impromptu speaking coaching mode.

This is the default mode — focused on improving conversational speaking
skills: clarity, fluency, vocal engagement, and composure.


Note: stress_score removed from Presence — largely redundant with anxiety_score.
Note: eye contact now uses gaze.center_pct (0-100%) instead of
      hp.avg_eye_contact which MediaPipe caps at ~0.55-0.60 regardless
      of actual gaze quality.

Missing data (acoustic/linguistic stage failed) falls back to a neutral 65/100
for that sub-score rather than 0 — a pipeline failure shouldn't tank the
speaker's score.
"""

from __future__ import annotations

from typing import List

from modes.base import BaseMode, CoachingRubric
from models.schemas import RawSignals

_NEUTRAL_FALLBACK = 65.0  # conversation demands more fluency data


def _linear_score(value: float, zero_at: float, hundred_at: float) -> float:
    """
    Linearly map value to a 0-100 score, clamped.
    zero_at maps to 0, hundred_at maps to 100.
    """
    if hundred_at == zero_at:
        return 100.0
    t = (value - zero_at) / (hundred_at - zero_at)
    return max(0.0, min(100.0, t * 100.0))


def _pace_score(wpm: float) -> float:
    """Sweet-spot curve: 120-160 wpm is full marks for conversation."""
    if wpm <= 0:
        return 0.0
    if 120.0 <= wpm <= 160.0:
        return 100.0
    if wpm < 120.0:
        return _linear_score(wpm, zero_at=70.0, hundred_at=120.0)
    return _linear_score(wpm, zero_at=210.0, hundred_at=160.0)


def _articulation_score(rate: float) -> float:
    """Sweet-spot curve: 150-180 wpm articulation is ideal for conversation."""
    if rate <= 0:
        return 0.0
    if 150.0 <= rate <= 180.0:
        return 100.0
    if rate < 150.0:
        return _linear_score(rate, zero_at=80.0, hundred_at=150.0)
    return _linear_score(rate, zero_at=240.0, hundred_at=180.0)


def _pause_quality_score(avg_pause_ms: float, pause_count: int, duration_ms: float) -> float:
    """Strategic pauses (300-800ms avg) are good. Long avg = lost/uncertain."""
    if duration_ms <= 0:
        return _NEUTRAL_FALLBACK

    duration_min = duration_ms / 60_000.0
    pauses_per_min = pause_count / duration_min if duration_min > 0 else 0

    avg_score = 100.0
    if avg_pause_ms > 800.0:
        avg_score = _linear_score(avg_pause_ms, zero_at=2500.0, hundred_at=800.0)
    elif 0 < avg_pause_ms < 300.0:
        avg_score = _linear_score(avg_pause_ms, zero_at=50.0, hundred_at=300.0)

    freq_score = 100.0
    if pauses_per_min > 3.0:
        freq_score = _linear_score(pauses_per_min, zero_at=10.0, hundred_at=3.0)

    return 0.6 * avg_score + 0.4 * freq_score


def _pitch_variation_score(pitch_var: float) -> float:
    """25-50 Hz std is engaging. < 10 = monotone. > 80 = erratic."""
    if pitch_var <= 0:
        return 0.0
    if 25.0 <= pitch_var <= 50.0:
        return 100.0
    if pitch_var < 25.0:
        return _linear_score(pitch_var, zero_at=5.0, hundred_at=25.0)
    return _linear_score(pitch_var, zero_at=90.0, hundred_at=50.0)


def _silence_ratio_score(silence_pct: float) -> float:
    """10-25% silence is natural. <5% = steamrolling. >45% = awkward."""
    if 10.0 <= silence_pct <= 25.0:
        return 100.0
    if silence_pct < 10.0:
        return _linear_score(silence_pct, zero_at=0.0, hundred_at=10.0)
    return _linear_score(silence_pct, zero_at=55.0, hundred_at=25.0)


class ImpromptuMode(BaseMode):

    @property
    def mode_id(self) -> str:
        return "impromptu"

    # ── Scoring ───────────────────────────────────────────────────────────────

    def compute_score(self, signals: RawSignals) -> float:
        """
        0–100 composite score: 35% verbal fluency, 20% language quality,
        20% vocal delivery, 25% presence & composure.
        """
        ac = signals.acoustic_stats
        ls = signals.linguistic_stats
        hp = signals.head_pose
        em = signals.emotion

        # Single source of truth — works for normal AND audio-only sessions.
        duration_ms = signals.duration_ms

        # ── 1. Verbal Fluency (35% of total) ─────────────────────────────────
        if ac is not None:
            filler_pct    = ac.filler_word_ratio * 100.0
            filler_score  = _linear_score(filler_pct, zero_at=12.0, hundred_at=2.0)
            pace          = _pace_score(ac.wpm)
            pause_quality = _pause_quality_score(ac.avg_pause_ms, ac.pause_count, duration_ms)
            artic         = _articulation_score(ac.articulation_rate)
        else:
            filler_score  = _NEUTRAL_FALLBACK
            pace          = _NEUTRAL_FALLBACK
            pause_quality = _NEUTRAL_FALLBACK
            artic         = _NEUTRAL_FALLBACK

        fluency = (
            (10.0 / 35.0) * filler_score
            + (12.0 / 35.0) * pace
            + (8.0 / 35.0) * pause_quality
            + (5.0 / 35.0) * artic
        )

        # ── 2. Language Quality (20% of total) ───────────────────────────────
        if ls is not None:
            run_on_score = max(0.0, 100.0 - 20.0 * ls.run_on_sentences)

            word_count = (
                len(signals.stitched_timeline.transcript_timeline)
                if signals.stitched_timeline else 0
            )
            weak_pct   = (ls.weak_words_count / word_count * 100.0) if word_count > 0 else 0.0
            weak_score = _linear_score(weak_pct, zero_at=15.0, hundred_at=3.0)

            repeated_count = len(ls.top_repeated_words)
            vocab_score    = max(0.0, 100.0 - repeated_count * 25.0)

            filler_count          = len(ls.filler_words_found)
            filler_content_ratio  = (filler_count / word_count) if word_count > 0 else 0.0
            filler_content_score  = _linear_score(
                filler_content_ratio * 100.0, zero_at=12.5, hundred_at=3.3
            )
        else:
            run_on_score         = _NEUTRAL_FALLBACK
            weak_score           = _NEUTRAL_FALLBACK
            vocab_score          = _NEUTRAL_FALLBACK
            filler_content_score = _NEUTRAL_FALLBACK

        language = (
            (5.0 / 20.0) * run_on_score
            + (5.0 / 20.0) * weak_score
            + (5.0 / 20.0) * vocab_score
            + (5.0 / 20.0) * filler_content_score
        )

        # ── 3. Vocal Delivery (20% of total) ─────────────────────────────────
        if ac is not None:
            pitch_score = _pitch_variation_score(ac.pitch_variation)

            vol_score = 100.0
            if ac.avg_volume < 0.005:
                vol_score = _linear_score(ac.avg_volume, zero_at=0.001, hundred_at=0.005)
            elif ac.avg_volume < 0.01:
                vol_score = _linear_score(ac.avg_volume, zero_at=0.003, hundred_at=0.01)

            if duration_ms > 0:
                silence_pct    = (ac.total_pause_time_ms / duration_ms * 100.0)
                silence_score  = _silence_ratio_score(silence_pct)
            else:
                # No reliable duration (audio-only edge) — don't punish the speaker.
                silence_score = _NEUTRAL_FALLBACK
        else:
            pitch_score   = _NEUTRAL_FALLBACK
            vol_score     = _NEUTRAL_FALLBACK
            silence_score = _NEUTRAL_FALLBACK

        vocal = (
            (10.0 / 20.0) * pitch_score
            + (5.0 / 20.0) * vol_score
            + (5.0 / 20.0) * silence_score
        )

        # ── 4. Presence & Composure (25% of total) ───────────────────────────
        # gaze.center_pct: % of frames where user was looking at camera center.
        # Range 0–100 naturally. Replaces hp.avg_eye_contact which MediaPipe
        # caps at ~0.55–0.60 regardless of actual eye contact quality.
        # avg_brow_raise = browInnerUp (AU1): an observation signal, not a
        # diagnosis — low activation reads as composed on camera.
        gaze_center_score = signals.gaze.center_pct
        brow_raise_score  = (1.0 - em.avg_brow_raise) * 100.0
        head_pose_score   = hp.avg_head_pose * 100.0
        # Warmth saturation point is PROVISIONAL (0.30 per-side avg on the new
        # avg scale — the old /0.15 was tuned for the summed smile and gave
        # full marks to the faintest grin). Recalibrate from beta score_ranges.
        warmth_score      = min(em.avg_smile / 0.30, 1.0) * 100.0

        presence = (
            (12.0 / 25.0) * gaze_center_score
            + (7.0 / 25.0) * brow_raise_score
            + (3.0 / 25.0) * head_pose_score
            + (3.0 / 25.0) * warmth_score
        )

        # ── Final weighted composite ─────────────────────────────────────────
        raw = 0.35 * fluency + 0.20 * language + 0.20 * vocal + 0.25 * presence
        return round(min(100.0, max(0.0, raw)), 1)

    # ── Feedback ──────────────────────────────────────────────────────────────

    def generate_feedback(self, signals: RawSignals, score: float) -> List[str]:
        """
        Ordered coaching tips for conversation improvement.
        First item is always the overall summary line.
        """
        tips: List[str] = []
        ac = signals.acoustic_stats
        ls = signals.linguistic_stats
        hp = signals.head_pose
        em = signals.emotion

        # ── Verbal Fluency tips ──────────────────────────────────────────────
        if ac is not None:
            filler_pct = ac.filler_word_ratio * 100.0
            if filler_pct >= 8.0:
                tips.append(
                    f"🗣️ Filler words made up {filler_pct:.1f}% of your speech. "
                    "Every 'um' and 'uh' signals uncertainty — "
                    "try pausing silently instead."
                )
            elif filler_pct < 2.0 and ac.wpm > 0:
                tips.append("✅ Very clean delivery — minimal filler words.")

            if ac.wpm > 0:
                if ac.wpm < 120:
                    tips.append(
                        f"🐌 Speaking pace was slow ({ac.wpm:.0f} WPM). "
                        "Aim for 120-160 WPM for a natural conversational flow."
                    )
                elif ac.wpm > 160:
                    tips.append(
                        f"🏃 Speaking pace was fast ({ac.wpm:.0f} WPM). "
                        "Slow to 120-160 WPM so your ideas have room to land."
                    )

            if ac.pitch_variation < 15.0:
                tips.append(
                    "🎵 Your voice was quite monotone. "
                    "Varying your pitch keeps the listener engaged."
                )

            if ac.avg_pause_ms > 1500:
                tips.append(
                    f"⏸️ Average pause was {ac.avg_pause_ms:.0f}ms — quite long. "
                    "Aim for 300-800ms pauses to sound thoughtful, not lost."
                )

        # ── Language Quality tips ────────────────────────────────────────────
        if ls is not None:
            if ls.run_on_sentences > 0:
                tips.append(
                    f"📝 {ls.run_on_sentences} run-on sentence(s) detected. "
                    "Shorter sentences hit harder — "
                    "break long thoughts into 2-3 clear statements."
                )
            if ls.weak_words_count >= 3:
                examples = ", ".join(ls.weak_words_found[:4])
                tips.append(
                    f"🪢 {ls.weak_words_count} hedging words found ({examples}). "
                    "Dropping 'basically', 'kind of', 'I think' makes you sound "
                    "more decisive and trustworthy."
                )
            if ls.top_repeated_words and len(ls.top_repeated_words) >= 3:
                tips.append(
                    f"🔁 You repeated several words heavily: "
                    f"{', '.join(ls.top_repeated_words[:3])}. "
                    "Try using synonyms to keep your speech fresh."
                )

        # ── Presence tips ────────────────────────────────────────────────────
        if signals.gaze.center_pct < 40.0:
            tips.append(
                "👁️ Gaze was off-camera frequently — looking at the camera "
                "signals that you're engaged and confident."
            )

        if em.avg_brow_raise > 0.25:
            tips.append(
                "😟 Frequent brow raising detected. Try slow breaths between thoughts — "
                "a relaxed face puts others at ease."
            )

        if em.avg_smile >= 0.20:
            tips.append("😊 Great warmth! Your natural smile makes you approachable.")

        # ── Overall summary (always first) ───────────────────────────────────
        if score >= 78:
            tips.insert(0, f"🌟 Excellent performance — score {score}/100.")
        elif score >= 55:
            tips.insert(0, f"📈 Good foundation — score {score}/100. A few refinements will make a big difference.")
        else:
            tips.insert(0, f"💪 Score {score}/100 — room to grow. Focus on the tips below to level up.")

        return tips

    # ── Coaching Rubric (for LLM prompt) ──────────────────────────────────────

    def coaching_rubric(self) -> CoachingRubric:
        return CoachingRubric(
            mode_label="Impromptu Speaking",
            focus_description=(
                "The speaker was talking spontaneously without preparation. "
                "Focus on: clarity of expression, conciseness, grammatical accuracy (tenses & plurals), "
                "filler word reduction, natural sentence structure, vocabulary range, and vocal engagement "
                "(pitch variation, pacing, strategic pauses). "
                "Apply the Before/After/Why format so the speaker can hear exactly "
                "how to rephrase what they said."
            ),
            correction_categories=[
                "Grammar, Tenses & Plurals",
                "Conciseness & Impact",
                "Lexical Diversity & Transitions",
                "Scenario Phrasing",
                "Fillers & Weak Language",
            ],
            framework_hint=(
                "Look for intro-body-conclusion or problem-solution structure. "
                "Note if the speaker opened strongly or jumped straight into the middle."
            ),
            key_coaching_question=(
                "Did the speaker communicate their idea clearly, engagingly, "
                "and naturally on the spot?"
            ),
        )

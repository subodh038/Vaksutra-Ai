"""
modes/feynman.py — Feynman Technique coaching mode.

The Feynman Technique: explain a concept so simply that a non-expert
(or a 12-year-old) can fully understand it. If you cannot explain it
simply, you do not understand it well enough.

Scoring weights (total = 1.0)
------------------------------
  Low filler word ratio     0.25  (fillers = uncertainty = gaps in knowledge)
  Low run-on sentences      0.20  (tangled sentences = tangled thinking)
  Low repeated phrases      0.20  (loops = circular reasoning)
  WPM in [100–140] range    0.20  (too fast = not letting ideas land)
  Eye contact               0.15  (connection = confidence in your explanation)
"""

from __future__ import annotations

import logging
from typing import List

from modes.base import BaseMode, CoachingRubric
from models.schemas import RawSignals

logger = logging.getLogger(__name__)


class FeynmanMode(BaseMode):

    @property
    def mode_id(self) -> str:
        return "feynman"

    # ── Scoring ───────────────────────────────────────────────────────────────

    def compute_score(self, signals: RawSignals) -> float:
        """
        0–100 composite score for the Feynman explanation quality.

        Inputs  : signals.acoustic_stats, signals.linguistic_stats,
                  signals.head_pose
        Outputs : float in [0.0, 100.0]
        """
        ac = signals.acoustic_stats
        ls = signals.linguistic_stats
        hp = signals.head_pose

        # ── Low filler ratio (0.25 weight) ───────────────────────────────────
        # 0 fillers → 100 pts. >15% fillers → 0 pts.
        filler_pct = (ac.filler_word_ratio * 100.0) if ac else 0.0
        filler_score = max(0.0, 100.0 - (filler_pct / 0.15))

        # ── Low run-on sentences (0.20 weight) ───────────────────────────────
        # 0 run-ons → 100 pts. 5+ → 0 pts.
        run_ons = ls.run_on_sentences if ls else 0
        run_on_score = max(0.0, 100.0 - (run_ons * 20.0))

        # ── Low repeated words (0.20 weight) ─────────────────────────────────
        # 0 repeated → 100 pts. 5+ → 0 pts.
        repeated = len(ls.top_repeated_words) if ls else 0
        repeat_score = max(0.0, 100.0 - (repeated * 20.0))

        # ── WPM in ideal explanation range 100–140 (0.20 weight) ─────────────
        wpm = ac.wpm if ac else 0.0
        if 100.0 <= wpm <= 140.0:
            wpm_score = 100.0
        elif wpm < 100.0:
            wpm_score = max(0.0, (wpm / 100.0) * 100.0)
        else:
            wpm_score = max(0.0, 100.0 - ((wpm - 140.0) / 60.0) * 100.0)

        # ── Eye contact / confidence (0.15 weight) ────────────────────────────
        eye_score = hp.avg_eye_contact * 100.0

        raw = (
            0.25 * filler_score
            + 0.20 * run_on_score
            + 0.20 * repeat_score
            + 0.20 * wpm_score
            + 0.15 * eye_score
        )
        return round(min(100.0, max(0.0, raw)), 1)

    # ── Deterministic Feedback ────────────────────────────────────────────────

    def generate_feedback(self, signals: RawSignals, score: float) -> List[str]:
        """
        Ordered coaching tips for Feynman-style explanation quality.
        First item is always the overall summary line.
        """
        tips: List[str] = []
        ac = signals.acoustic_stats
        ls = signals.linguistic_stats
        hp = signals.head_pose

        # ── Filler words ──────────────────────────────────────────────────────
        if ac:
            filler_pct = ac.filler_word_ratio * 100.0
            if filler_pct > 8.0:
                tips.append(
                    f"🔴 High filler word usage ({filler_pct:.1f}%). "
                    "In the Feynman method, fillers often signal knowledge gaps — "
                    "pause silently instead of reaching for 'um' or 'uh'."
                )
            elif filler_pct > 3.0:
                tips.append(
                    f"🟡 Moderate filler usage ({filler_pct:.1f}%). "
                    "Try replacing fillers with a 1-second pause to collect your thoughts."
                )

        # ── Run-on sentences ──────────────────────────────────────────────────
        if ls and ls.run_on_sentences > 2:
            tips.append(
                f"📝 {ls.run_on_sentences} run-on sentences detected. "
                "Long tangled sentences are a sign the idea isn't yet fully clear in your mind. "
                "Break it into shorter, punchy statements."
            )

        # ── Repeated words / circular reasoning ──────────────────────────────
        if ls and ls.top_repeated_words:
            words = ", ".join(f'"{w}"' for w in ls.top_repeated_words[:3])
            tips.append(
                f"🔁 Repeated words detected: {words}. "
                "Circular repetition often means you're searching for the right word — "
                "prepare a cleaner analogy or example before your next attempt."
            )

        # ── WPM pacing ────────────────────────────────────────────────────────
        if ac:
            if ac.wpm > 140.0:
                tips.append(
                    f"⏩ You spoke at {ac.wpm:.0f} WPM — slightly fast for a Feynman explanation. "
                    "Slow down to 100–140 WPM so each concept has time to land."
                )
            elif ac.wpm < 80.0 and ac.wpm > 0:
                tips.append(
                    f"⏸️ Pacing was slow ({ac.wpm:.0f} WPM). "
                    "A little more energy and momentum keeps the listener engaged."
                )

        # ── Eye contact ───────────────────────────────────────────────────────
        if hp.avg_eye_contact < 0.45:
            tips.append(
                "👁️ Eye contact was low — looking directly at the camera builds trust "
                "that you know your material well."
            )

        # ── Weak / hedge words ────────────────────────────────────────────────
        if ls and ls.weak_words_count > 3:
            tips.append(
                f"⚠️ {ls.weak_words_count} weak/hedging words found "
                f"({', '.join(ls.weak_words_found[:3])}). "
                "Hedging words like 'basically' or 'kind of' weaken your explanation's authority."
            )

        # ── Overall summary (always first) ────────────────────────────────────
        if score >= 75:
            tips.insert(0, f"🌟 Strong Feynman explanation — score {score}/100. Your ideas came through clearly!")
        elif score >= 50:
            tips.insert(0, f"📈 Good foundation — score {score}/100. Some areas to refine before your next explanation.")
        else:
            tips.insert(0, f"💪 Feynman score {score}/100. Keep simplifying — the clearer the words, the deeper the understanding.")

        return tips

    # ── Coaching Rubric (for LLM prompt) ──────────────────────────────────────

    def coaching_rubric(self) -> CoachingRubric:
        return CoachingRubric(
            mode_label="Feynman Technique — Concept Explanation",
            focus_description=(
                "The speaker was explaining a concept using the Feynman Technique. "
                "The goal is radical simplicity: explain as if to a non-expert or a 12-year-old. "
                "Focus on: clarity of analogies, absence of unexplained jargon, "
                "circular reasoning loops, cognitive gaps (where explanation broke down), "
                "and whether the listener could follow every step without prior knowledge."
            ),
            correction_categories=[
                "Jargon Simplification",
                "Circular Reasoning & Loops",
                "Cognitive Gap Moments",
                "Analogy Quality",
                "Sentence Clarity",
            ],
            framework_hint=(
                "Look for the 4 Feynman steps: "
                "1) Choose a concept, "
                "2) Explain it simply, "
                "3) Identify gaps (where explanation stumbled), "
                "4) Simplify and use analogy. "
                "Did the speaker follow this arc naturally?"
            ),
            key_coaching_question=(
                "Could a 12-year-old with no prior knowledge understand "
                "and follow this explanation from start to finish?"
            ),
        )

    def required_context(self) -> List[str]:
        return ["topic"]   # frontend must send what concept is being explained

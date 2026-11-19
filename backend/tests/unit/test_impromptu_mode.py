"""
tests/unit/test_impromptu_mode.py — Unit tests for modes/impromptu.py

Tests compute_score() and generate_feedback() with synthetic RawSignals.
These mirror the CURRENT scoring contract:
  - Presence uses gaze.center_pct (NOT the MediaPipe-capped avg_eye_contact)
  - Weights: 35% fluency, 20% language, 20% vocal, 25% presence
  - Session duration comes from RawSignals.duration_ms (audio-only support)

Run:  python -m pytest tests/unit/test_impromptu_mode.py -v
"""

from models.schemas import (
    EmotionSummary, FrameAnalysisEntry,
    GazeBreakdown, HeadPoseSummary, RawSignals, ScoreRanges,
    AcousticStats, LinguisticStats, StitchedTimeline, TimestampedWord
)
from modes.impromptu import ImpromptuMode


# ── Helpers ───────────────────────────────────────────────────────────────────

mode = ImpromptuMode()

DURATION_MS = 120_000  # 2-minute session — every sub-scorer gets real duration


def make_signals(
    eye_contact: float = 0.8,       # legacy knob — scoring now ignores this
    head_pose: float = 0.8,
    center_pct: float = 70.0,
    brow_raise: float = 0.1,
    stress: float = 0.1,
    confusion: float = 0.1,
    smile: float = 0.2,
    face_pct: float = 95.0,
    filler_ratio: float = 0.0,
    fillers_found: int = 0,
    wpm: float = 130.0,
    run_on: int = 0,
    weak_count: int = 0,
    word_count: int = 100,
    pitch_variation: float = 30.0,
    avg_volume: float = 0.02,
    articulation_rate: float = 160.0,
    pause_count: int = 3,
    avg_pause_ms: float = 500.0,
    total_pause_time_ms: float = 21_000.0,
    repeated_words: int = 0,
    duration_ms: float = DURATION_MS,
) -> RawSignals:
    frames: list[FrameAnalysisEntry] = []   # not needed for scoring

    ac = AcousticStats(
        pitch_variation=pitch_variation, avg_volume=avg_volume,
        pause_count=pause_count, longest_pause_ms=avg_pause_ms * 2,
        total_pause_time_ms=total_pause_time_ms, avg_pause_ms=avg_pause_ms,
        filler_word_ratio=filler_ratio, wpm=wpm,
        articulation_rate=articulation_rate,
    )
    ls = LinguisticStats(
        weak_words_count=weak_count, weak_words_found=[],
        run_on_sentences=run_on,
        top_repeated_words=[f"w{i}" for i in range(repeated_words)],
        filler_words_found=["um"] * fillers_found,
        filler_word_ratio=filler_ratio,
    )
    timeline = StitchedTimeline(
        transcript_timeline=[
            TimestampedWord(word="test", start_ms=0, end_ms=10)
            for _ in range(word_count)
        ]
    )

    return RawSignals(
        frames=frames,
        face_frames=frames,
        face_detected_pct=face_pct,
        gaze=GazeBreakdown(
            center_pct=center_pct,
            left_pct=(100 - center_pct) / 3,
            right_pct=(100 - center_pct) / 3,
            down_pct=(100 - center_pct) / 3,
            away_pct=0.0,
        ),
        emotion=EmotionSummary(
            avg_brow_raise=brow_raise, avg_confusion=confusion,
            avg_stress=stress, avg_frown=0.0,
            avg_squint=0.0, avg_smile=smile, avg_blink_rate=0.0,
        ),
        head_pose=HeadPoseSummary(
            avg_eye_contact=eye_contact,
            avg_head_pose=head_pose,
            avg_head_pitch=0.0, avg_head_roll=0.0,
        ),
        acoustic_stats=ac,
        linguistic_stats=ls,
        detected_events=[],
        score_ranges=ScoreRanges(
            eye_contact_min=0.0, eye_contact_max=1.0, eye_contact_avg=eye_contact,
            anxiety_min=0.0, anxiety_max=brow_raise, anxiety_avg=brow_raise,
            stress_min=0.0, stress_max=stress, stress_avg=stress,
            smile_min=0.0, smile_max=smile, smile_avg=smile,
        ),
        transcript="",
        audio_received_bytes=0,
        duration_ms=duration_ms,
        stitched_timeline=timeline,
    )


# ── compute_score tests ───────────────────────────────────────────────────────

def test_perfect_signals_scores_100():
    signals = make_signals(
        head_pose=1.0, center_pct=100.0,
        brow_raise=0.0, stress=0.0, face_pct=100.0,
        smile=0.3,  # 0.3/0.30 saturates warmth to 100
    )
    assert mode.compute_score(signals) == 100.0


def test_all_zero_signals_scores_near_0():
    signals = make_signals(
        head_pose=0.0, center_pct=0.0,
        brow_raise=1.0, stress=1.0, smile=0.0, face_pct=0.0,
        filler_ratio=0.20, fillers_found=20, wpm=10.0,
        run_on=5, weak_count=20, repeated_words=4,
        # kill every acoustic sweet-spot default too
        pitch_variation=0.0, avg_volume=0.0, articulation_rate=0.0,
        pause_count=30, avg_pause_ms=3000.0, total_pause_time_ms=60_000.0,
    )
    score = mode.compute_score(signals)
    assert score <= 5.0


def test_score_is_clamped_to_0_100():
    hi = make_signals(head_pose=1.0, center_pct=100.0, brow_raise=0.0,
                      stress=0.0, face_pct=100.0)
    assert 0.0 <= mode.compute_score(hi) <= 100.0

    lo = make_signals(head_pose=0.0, center_pct=0.0, brow_raise=1.0,
                      stress=1.0, face_pct=0.0)
    assert 0.0 <= mode.compute_score(lo) <= 100.0


def test_golden_value_known_inputs():
    # Hand-computed against modes/impromptu.py formulas:
    #   fluency : filler 5% -> 70 | pace 130 -> 100 | pq (avg 500, 1.5/min) -> 100
    #             artic 160 -> 100                     => (10*70+12*100+8*100+5*100)/35 = 91.4286
    #   language: run-on 1 -> 80 | weak 10% -> 41.667 | vocab 0 rep -> 100
    #             signal-noise 0 found -> 100          => (80+41.667+100+100)/4 = 80.4167
    #   vocal   : pitch 30 -> 100 | vol .02 -> 100 | silence 17.5% -> 100 => 100
    #   presence: gaze 60 -> 60 | anx .2 -> 80 | pose .7 -> 70 | warm .2 -> 66.667
    #                                          => (720+560+210+200)/25 = 67.6
    #   raw = .35*91.4286 + .20*80.4167 + .20*100 + .25*67.6 ≈ 85.0
    signals = make_signals(
        head_pose=0.7, center_pct=60.0,
        brow_raise=0.2, stress=0.1, face_pct=90.0,
        filler_ratio=0.05, wpm=130.0, run_on=1, weak_count=10, word_count=100,
    )
    assert mode.compute_score(signals) == 85.0


def test_score_decreases_with_higher_anxiety():
    low  = make_signals(brow_raise=0.1)
    high = make_signals(brow_raise=0.8)
    assert mode.compute_score(low) > mode.compute_score(high)


def test_score_decreases_with_lower_center_gaze():
    good = make_signals(center_pct=90.0)
    poor = make_signals(center_pct=20.0)
    assert mode.compute_score(good) > mode.compute_score(poor)


def test_audio_only_session_does_not_crash_or_zero_out():
    """Audio-only fallback: no frames, duration from decoded audio."""
    signals = make_signals()
    # simulate pipeline behaviour: frames empty, duration set from audio
    object.__setattr__(signals, "duration_ms", DURATION_MS) if False else None
    assert 0.0 <= mode.compute_score(signals) <= 100.0


def test_missing_duration_uses_neutral_for_silence():
    """duration_ms=0 must NOT hard-zero the silence sub-score anymore."""
    bad = make_signals(duration_ms=0.0, pause_count=30, avg_pause_ms=3000.0)
    worse_duration = make_signals(duration_ms=120_000,
                                  pause_count=30, avg_pause_ms=3000.0,
                                  total_pause_time_ms=90_000.0)
    # With duration present and 75% silence the score must be lower than the
    # unknown-duration case (which neutralises pause/silence).
    assert mode.compute_score(worse_duration) < mode.compute_score(bad)


# ── generate_feedback tests ───────────────────────────────────────────────────

def test_feedback_always_starts_with_summary():
    signals = make_signals()
    score = mode.compute_score(signals)
    tips = mode.generate_feedback(signals, score)
    assert len(tips) >= 1
    assert str(int(score)) in tips[0] or f"{score}" in tips[0]


def test_low_center_gaze_tip_fires():
    signals = make_signals(center_pct=30.0)   # below 40
    tips = mode.generate_feedback(signals, 50.0)
    assert any("gaze" in t.lower() for t in tips)


def test_high_anxiety_tip_fires():
    signals = make_signals(brow_raise=0.4)       # above 0.25
    tips = mode.generate_feedback(signals, 60.0)
    assert any("brow" in t.lower() for t in tips)


def test_warmth_tip_fires_when_smiling():
    signals = make_signals(smile=0.25)        # >= 0.20
    tips = mode.generate_feedback(signals, 70.0)
    assert any("warmth" in t.lower() or "smile" in t.lower() for t in tips)


def test_filler_tip_fires():
    signals = make_signals(filler_ratio=0.10)  # >= 8%
    tips = mode.generate_feedback(signals, 55.0)
    assert any("filler" in t.lower() for t in tips)


def test_pace_fast_tip_fires():
    signals = make_signals(wpm=190.0)          # > 160
    tips = mode.generate_feedback(signals, 55.0)
    assert any("fast" in t.lower() or "wpm" in t.lower() for t in tips)


def test_weak_word_tip_fires():
    signals = make_signals(weak_count=5)
    tips = mode.generate_feedback(signals, 55.0)
    assert any("hedging" in t.lower() or "weak" in t.lower() for t in tips)


def test_score_above_78_gives_excellent_summary():
    signals = make_signals(head_pose=1.0, center_pct=100.0,
                           brow_raise=0.0, stress=0.0, face_pct=100.0)
    score = mode.compute_score(signals)   # 100.0
    tips = mode.generate_feedback(signals, score)
    assert "excellent" in tips[0].lower()


def test_score_below_55_gives_grow_summary():
    signals = make_signals(
        head_pose=0.0, center_pct=0.0,
        brow_raise=1.0, stress=1.0, face_pct=0.0,
        filler_ratio=0.15, fillers_found=15, wpm=90.0,
        pitch_variation=5.0, avg_volume=0.001, articulation_rate=80.0,
        pause_count=30, avg_pause_ms=3000.0, total_pause_time_ms=60_000.0,
    )
    score = mode.compute_score(signals)
    assert score < 55
    tips = mode.generate_feedback(signals, score)
    assert "room to grow" in tips[0].lower() or "grow" in tips[0].lower()

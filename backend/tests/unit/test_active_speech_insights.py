"""
Unit tests for ground-truth active speech and silence ratio calculations.
Verifies that leading/trailing dead air and spoken word timestamps are accurately accounted for.
"""

import pytest
from models.schemas import (
    AcousticStats,
    EmotionSummary,
    GazeBreakdown,
    HeadPoseSummary,
    LinguisticStats,
    PipelineStatus,
    RawSignals,
    ScoreRanges,
    StitchedTimeline,
    TimestampedWord,
)
from core.insights.insight_generator import generate_derived_insights


def _build_signals(
    duration_ms: float,
    words: list[tuple[str, float, float]],
    pause_time_ms: float = 0.0,
    wpm: float = 0.0,
    pitch_var: float = 30.0,
) -> RawSignals:
    timeline = StitchedTimeline(
        duration_ms=duration_ms,
        transcript_timeline=[
            TimestampedWord(word=w, start_ms=s, end_ms=e)
            for w, s, e in words
        ],
    )
    ac = AcousticStats(
        pitch_variation=pitch_var,
        avg_volume=0.05,
        pause_count=len(words) - 1 if len(words) > 1 else 0,
        longest_pause_ms=500.0,
        total_pause_time_ms=pause_time_ms,
        wpm=wpm,
        articulation_rate=140.0,
        filler_word_ratio=0.0,
    )
    return RawSignals(
        frames=[],
        face_frames=[],
        face_detected_pct=100.0,
        gaze=GazeBreakdown(center_pct=70.0, left_pct=10.0, right_pct=10.0, down_pct=10.0, away_pct=0.0),
        emotion=EmotionSummary(
            avg_brow_raise=0.05,
            avg_confusion=0.05,
            avg_stress=0.05,
            avg_frown=0.0,
            avg_squint=0.05,
            avg_smile=0.15,
            avg_blink_rate=0.1,
        ),
        head_pose=HeadPoseSummary(avg_eye_contact=0.7, avg_head_pose=0.9, avg_head_pitch=0.0, avg_head_roll=0.0),
        acoustic_stats=ac,
        linguistic_stats=None,
        detected_events=[],
        score_ranges=ScoreRanges(
            eye_contact_min=0, eye_contact_max=1, eye_contact_avg=0.7,
            anxiety_min=0, anxiety_max=1, anxiety_avg=0.05,
            stress_min=0, stress_max=1, stress_avg=0.05,
            smile_min=0, smile_max=1, smile_avg=0.15,
        ),
        transcript=" ".join(w for w, _, _ in words),
        audio_received_bytes=1000,
        duration_ms=duration_ms,
        stitched_timeline=timeline,
    )


def test_user_scenario_11_words_in_67_seconds():
    """11 words taking ~4.5s in a 67s recording must show ~93% silence and Sluggish pacing."""
    # Words spoken between 10s and 14.5s
    words = [
        ("I", 10000, 10300),
        ("don't", 10350, 10700),
        ("know.", 10750, 11100),
        ("Hi,", 11400, 11700),
        ("good", 11750, 12000),
        ("morning.", 12050, 12500),
        ("Good", 12800, 13100),
        ("morning.", 13150, 13600),
        ("Hi,", 13800, 14000),
        ("good", 14050, 14300),
        ("morning.", 14350, 14700),
    ]
    duration_ms = 67000.0  # 1m 7s
    signals = _build_signals(duration_ms=duration_ms, words=words, pause_time_ms=0.0, wpm=9.85)
    
    insights = generate_derived_insights(signals)

    # Active speech is ~4.7s (from 10s to 14.7s), so silence is ~62.3s -> ~93%
    assert 90.0 <= insights.silence_ratio_pct <= 95.0
    assert insights.pacing_status == "Sluggish"
    assert round(insights.pacing_wpm) == 10


def test_continuous_speech_shows_natural_silence_ratio():
    """Continuous speech across 60s should produce natural conversational silence (15-25%)."""
    # 120 words with natural spacing across ~48s of active speech
    words = []
    t = 2000.0  # 2s startup
    for i in range(120):
        words.append((f"word{i}", t, t + 350.0))
        t += 400.0  # 50ms gap
    
    duration_ms = 60000.0
    signals = _build_signals(duration_ms=duration_ms, words=words, pause_time_ms=3000.0, wpm=120.0)
    
    insights = generate_derived_insights(signals)
    assert 15.0 <= insights.silence_ratio_pct <= 28.0
    assert insights.pacing_status == "Conversational"


def test_empty_transcript_produces_100_percent_silence():
    """When no words are spoken in a 30s recording, silence ratio must be 100%."""
    signals = _build_signals(duration_ms=30000.0, words=[])
    insights = generate_derived_insights(signals)
    assert insights.silence_ratio_pct == 100.0


def test_fallback_when_stitched_timeline_is_none():
    """Fallback branch without transcript timeline respects total_pause_time_ms."""
    signals = _build_signals(duration_ms=60000.0, words=[], pause_time_ms=15000.0)
    signals.stitched_timeline = None  # Simulate audio-only fallback without transcript
    
    insights = generate_derived_insights(signals)
    assert insights.silence_ratio_pct == 25.0  # 15,000 / 60,000 * 100

"""
tests/unit/test_events.py — Unit tests for core/visual/event_detection.py

Tests each event type independently using synthetic frame timelines.
All timestamp values are in milliseconds.

Run:  python -m pytest tests/unit/test_events.py -v
"""

from typing import List
import pytest
from models.schemas import FrameAnalysisEntry
from core.visual.event_detection import detect_events, _extract_runs


# ── Frame builder ─────────────────────────────────────────────────────────────

def make_frame(
    ts: float,
    face: bool = True,
    eye_contact: float = 0.8,
    gaze_zone: str = "center",
    brow_raise: float = 0.0,
    stress: float = 0.0,
    frown: float = 0.0,
    mocking: float = 0.0,
    smile: float = 0.0,
    squint: float = 0.0,
    mouth_open: float = 0.0,
    blink: float = 0.0,
) -> FrameAnalysisEntry:
    return FrameAnalysisEntry(
        timestamp=ts, faceDetected=face,
        eyeContactScore=eye_contact, headPoseScore=0.8,
        headPitch=0.0, headRoll=0.0,
        mouthOpenScore=mouth_open, smileScore=smile,
        blinkScore=blink, browRaiseScore=brow_raise,
        confusionScore=0.0, stressScore=stress,
        frownScore=frown, squintScore=squint,
        mockingScore=mocking, gazeZone=gaze_zone,
        faceWidth=0.5, isReadingScript=False,
    )


def normal_frames(count: int, start_ts: float = 0.0, step: float = 100.0) -> List[FrameAnalysisEntry]:
    """Frames with no notable events — all green."""
    return [make_frame(ts=start_ts + i * step) for i in range(count)]


# ── Core behaviour ────────────────────────────────────────────────────────────

def test_empty_frames_returns_empty():
    assert detect_events([]) == []


def test_all_normal_frames_no_events():
    events = detect_events(normal_frames(50))
    assert events == []


def test_events_sorted_by_start_ms():
    # brow-raise event early, gaze-away event later
    frames = (
        [make_frame(ts=i * 100.0, brow_raise=0.7) for i in range(6)]   # 0–500ms
        + [make_frame(ts=i * 100.0) for i in range(6, 12)]          # normal
        + [make_frame(ts=i * 100.0, gaze_zone="left") for i in range(12, 18)]  # 1200–1700ms
    )
    events = detect_events(frames)
    starts = [e.start_ms for e in events]
    assert starts == sorted(starts)


# ── eye_contact_break (threshold < 0.10, min 400ms) ──────────────────────────

def test_eye_contact_break_fires_above_duration():
    # EMA carries over from the 0.8 baseline, so the smoothed score only
    # dips under the 0.10 gate a couple of samples into the break block.
    # 10 break frames give a ≥400ms observed span below threshold.
    frames = (
        normal_frames(3, start_ts=0)
        + [make_frame(ts=300 + i * 100.0, eye_contact=0.05) for i in range(10)]
        + normal_frames(3, start_ts=1_300)
    )
    events = [e for e in detect_events(frames) if e.type == "eye_contact_break"]
    assert len(events) == 1
    assert events[0].duration_ms >= 400


def test_eye_contact_break_does_not_fire_below_duration():
    # 2 frames × 100ms = 200ms < 400ms → no event
    frames = (
        normal_frames(3, start_ts=0)
        + [make_frame(ts=300 + i * 100.0, eye_contact=0.05) for i in range(2)]
        + normal_frames(3, start_ts=500)
    )
    events = [e for e in detect_events(frames) if e.type == "eye_contact_break"]
    assert events == []


def test_single_sparse_low_eye_contact_sample_does_not_become_an_event():
    """A single frame must not be stretched across the next sampling interval."""
    frames = [
        make_frame(ts=0.0),
        make_frame(ts=500.0, eye_contact=0.05),
        make_frame(ts=1_000.0),
    ]
    events = [e for e in detect_events(frames) if e.type == "eye_contact_break"]
    assert events == []


def test_eye_contact_break_no_fire_when_face_absent():
    # deep break score but faceDetected=False — should not trigger
    frames = (
        normal_frames(3, start_ts=0)
        + [make_frame(ts=300 + i * 100.0, eye_contact=0.05, face=False) for i in range(6)]
        + normal_frames(3, start_ts=900)
    )
    events = [e for e in detect_events(frames) if e.type == "eye_contact_break"]
    assert events == []


# ── gaze_away (any non-center zone, min 800ms) ───────────────────────────────

def test_gaze_away_fires_for_left_zone():
    frames = (
        normal_frames(2)
        + [make_frame(ts=200 + i * 100.0, gaze_zone="left") for i in range(9)]
        + normal_frames(2, start_ts=1_100)
    )
    events = [e for e in detect_events(frames) if e.type == "gaze_away"]
    assert len(events) == 1


def test_gaze_away_fires_for_down_zone():
    frames = (
        normal_frames(2)
        + [make_frame(ts=200 + i * 100.0, gaze_zone="down") for i in range(9)]
        + normal_frames(2, start_ts=1_100)
    )
    events = [e for e in detect_events(frames) if e.type == "gaze_away"]
    assert len(events) == 1


# ── brow_raise (> 0.65 after EMA, min 500ms) ─────────────────────────────────

def test_brow_raise_fires_with_sufficient_duration():
    # Sustained 0.9 activation: EMA crosses 0.65 on the 2nd sample and stays
    # above it — observed span comfortably exceeds the 500ms gate.
    frames = (
        normal_frames(3)
        + [make_frame(ts=300 + i * 100.0, brow_raise=0.9) for i in range(10)]
        + normal_frames(3, start_ts=1_300)
    )
    events = [e for e in detect_events(frames) if e.type == "brow_raise"]
    assert len(events) == 1


def test_brow_raise_does_not_fire_on_short_spike():
    # 3 samples = 200ms observed span < 500ms gate → no event, even at 0.9.
    frames = (
        normal_frames(3)
        + [make_frame(ts=300 + i * 100.0, brow_raise=0.90) for i in range(3)]
        + normal_frames(3, start_ts=600)
    )
    events = [e for e in detect_events(frames) if e.type == "brow_raise"]
    assert events == []


def test_eye_closure_requires_observed_duration_not_a_fixed_frame_count():
    frames = (
        normal_frames(2)
        + [make_frame(ts=200 + i * 250.0, blink=0.95) for i in range(2)]
        + normal_frames(2, start_ts=700, step=250.0)
    )
    events = [e for e in detect_events(frames) if e.type == "eye_closure"]
    assert events == []


def test_eye_closure_fires_after_500ms_observed_span():
    # blink=0.95: EMA clears the 0.50 gate on the very first sample.
    frames = (
        normal_frames(2)
        + [make_frame(ts=200 + i * 250.0, blink=0.95) for i in range(3)]
        + normal_frames(2, start_ts=950, step=250.0)
    )
    events = [e for e in detect_events(frames) if e.type == "eye_closure"]
    assert len(events) == 1


# ── smile (> 0.60 + Duchenne guard after EMA, min 400ms) ─────────────────────

def test_smile_fires_with_duchenne_guard_met():
    # Strong simultaneous smile+squint: EMA passes both gates by sample 2 and
    # the run spans 700ms ≥ 400ms.
    frames = (
        normal_frames(2)
        + [make_frame(ts=200 + i * 100.0, smile=0.9, squint=0.4, mouth_open=0.1,
                      brow_raise=0.1, stress=0.1) for i in range(8)]
        + normal_frames(2, start_ts=1_000)
    )
    events = [e for e in detect_events(frames) if e.type == "smile"]
    assert len(events) == 1


def test_smile_blocked_without_squint():
    # squint = 0.0 → Duchenne rule fails → no smile event
    frames = (
        normal_frames(2)
        + [make_frame(ts=200 + i * 100.0, smile=0.9, squint=0.0) for i in range(8)]
        + normal_frames(2, start_ts=1_000)
    )
    events = [e for e in detect_events(frames) if e.type == "smile"]
    assert events == []


def test_smile_blocked_by_high_anxiety():
    # brow_raise=0.5 > 0.4 → guard fails → no smile
    frames = (
        normal_frames(2)
        + [make_frame(ts=200 + i * 100.0, smile=0.9, squint=0.4,
                      brow_raise=0.5) for i in range(8)]
        + normal_frames(2, start_ts=1_000)
    )
    events = [e for e in detect_events(frames) if e.type == "smile"]
    assert events == []


# ── peak_value tracking ───────────────────────────────────────────────────────

def test_peak_value_is_max_during_run():
    # Replicate the detector's EMA (alpha=0.7, seeded with first raw value)
    # over a sustained 0.9 block to derive the exact smoothed peak.
    alpha = 0.7
    ema_vals = []
    ema = None
    for _ in range(10):
        ema = 0.9 if ema is None else alpha * 0.9 + (1 - alpha) * ema
        ema_vals.append(ema)

    frames = (
        normal_frames(3)
        + [make_frame(ts=300 + i * 100.0, brow_raise=0.9) for i in range(10)]
        + normal_frames(3, start_ts=1_300)
    )
    events = [e for e in detect_events(frames) if e.type == "brow_raise"]
    assert len(events) == 1
    assert events[0].peak_value == pytest.approx(max(ema_vals))

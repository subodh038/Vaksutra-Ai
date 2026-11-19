"""
tests/unit/test_gaze.py — Unit tests for core/visual/gaze.py

Run:  python -m pytest tests/unit/test_gaze.py -v
"""

import pytest
from models.schemas import FrameAnalysisEntry, GazeBreakdown
from core.visual.gaze import gaze_breakdown


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_frame(zone: str, ts: float = 0.0, face: bool = True) -> FrameAnalysisEntry:
    """Minimal valid FrameAnalysisEntry for gaze tests."""
    return FrameAnalysisEntry(
        timestamp=ts, faceDetected=face,
        eyeContactScore=0.8, headPoseScore=0.8,
        headPitch=0.0, headRoll=0.0,
        mouthOpenScore=0.0, smileScore=0.0,
        blinkScore=0.0, browRaiseScore=0.0,
        confusionScore=0.0, stressScore=0.0,
        frownScore=0.0, squintScore=0.0,
        mockingScore=0.0, gazeZone=zone,
        faceWidth=0.5,
    )


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_empty_frames_returns_all_zeros():
    result = gaze_breakdown([])
    assert result == GazeBreakdown(
        center_pct=0, left_pct=0, right_pct=0, down_pct=0, away_pct=0
    )


def test_all_center_frames():
    frames = [make_frame("center", ts=i * 100.0) for i in range(10)]
    result = gaze_breakdown(frames)
    assert result.center_pct == 100.0
    assert result.left_pct == 0.0
    assert result.right_pct == 0.0
    assert result.down_pct == 0.0
    assert result.away_pct == 0.0


def test_all_percentages_sum_to_100():
    frames = [
        make_frame("center"), make_frame("center"),
        make_frame("left"),
        make_frame("right"),
        make_frame("down"),
        make_frame("away"),
        make_frame("away"),
        make_frame("center"),
        make_frame("center"),
        make_frame("left"),
    ]
    result = gaze_breakdown(frames)
    total = result.center_pct + result.left_pct + result.right_pct + result.down_pct + result.away_pct
    assert abs(total - 100.0) < 0.2  # allow rounding tolerance


def test_known_split():
    # 4 center, 1 left, 1 right, 1 down, 1 away = 8 total
    frames = [
        make_frame("center"), make_frame("center"),
        make_frame("center"), make_frame("center"),
        make_frame("left"),
        make_frame("right"),
        make_frame("down"),
        make_frame("away"),
    ]
    result = gaze_breakdown(frames)
    assert result.center_pct == 50.0
    assert result.left_pct == 12.5
    assert result.right_pct == 12.5
    assert result.down_pct == 12.5
    assert result.away_pct == 12.5


def test_single_frame():
    result = gaze_breakdown([make_frame("down")])
    assert result.down_pct == 100.0
    assert result.center_pct == 0.0


def test_no_face_frames_still_counted():
    """gazeZone is sent even when faceDetected=False — gaze_breakdown counts all frames."""
    frames = [make_frame("center", face=False)] * 4 + [make_frame("left", face=True)] * 1
    result = gaze_breakdown(frames)
    assert result.center_pct == 80.0
    assert result.left_pct == 20.0


def test_up_zone_maps_to_away():
    """gazeZone='up' must be folded into away_pct, not silently dropped."""
    frames = [make_frame("center")] * 3 + [make_frame("up")] * 2  # 5 total
    result = gaze_breakdown(frames)
    assert result.center_pct == 60.0
    assert result.away_pct == 40.0   # 2 'up' frames → away


def test_up_zone_percentages_sum_to_100():
    """Percentages must sum to 100 even when 'up' frames are present."""
    frames = [
        make_frame("center"), make_frame("up"), make_frame("left"),
        make_frame("up"), make_frame("down"),
    ]
    result = gaze_breakdown(frames)
    total = result.center_pct + result.left_pct + result.right_pct + result.down_pct + result.away_pct
    assert abs(total - 100.0) < 0.2

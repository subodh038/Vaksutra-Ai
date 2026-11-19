"""
tests/unit/test_emotion.py — Unit tests for core/visual/emotion.py

Run:  python -m pytest tests/unit/test_emotion.py -v
"""

from models.schemas import FrameAnalysisEntry
from core.visual.emotion import emotion_summary


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_frame(
    brow_raise=0.0, confusion=0.0, stress=0.0,
    frown=0.0, squint=0.0, smile=0.0, blink=0.0,
    ts: float = 0.0,
) -> FrameAnalysisEntry:
    return FrameAnalysisEntry(
        timestamp=ts, faceDetected=True,
        eyeContactScore=0.5, headPoseScore=0.5,
        headPitch=0.0, headRoll=0.0,
        mouthOpenScore=0.0,
        smileScore=smile, blinkScore=blink,
        browRaiseScore=brow_raise, confusionScore=confusion,
        stressScore=stress, frownScore=frown,
        squintScore=squint, mockingScore=0.0,
        faceWidth=0.5, gazeZone="center", isReadingScript=False,
    )


# ── Tests ─────────────────────────────────────────────────────────────────────

def test_empty_face_frames_returns_all_zeros():
    result = emotion_summary([])
    assert result.avg_brow_raise == 0.0
    assert result.avg_confusion == 0.0
    assert result.avg_stress == 0.0
    assert result.avg_frown == 0.0
    assert result.avg_squint == 0.0
    assert result.avg_smile == 0.0
    assert result.avg_blink_rate == 0.0


def test_single_frame_returns_exact_values():
    frame = make_frame(brow_raise=0.5, confusion=0.2, stress=0.3,
                       frown=0.1, squint=0.4, smile=0.6, blink=0.05)
    result = emotion_summary([frame])
    assert result.avg_brow_raise == 0.5
    assert result.avg_confusion == 0.2
    assert result.avg_stress == 0.3
    assert result.avg_frown == 0.1
    assert result.avg_squint == 0.4
    assert result.avg_smile == 0.6
    assert result.avg_blink_rate == 0.05


def test_two_frames_average():
    f1 = make_frame(brow_raise=0.2, smile=0.4)
    f2 = make_frame(brow_raise=0.6, smile=0.8)
    result = emotion_summary([f1, f2])
    assert result.avg_brow_raise == 0.4
    assert result.avg_smile == 0.6


def test_all_max_values():
    frames = [make_frame(brow_raise=1.0, stress=1.0, confusion=1.0)] * 5
    result = emotion_summary(frames)
    assert result.avg_brow_raise == 1.0
    assert result.avg_stress == 1.0
    assert result.avg_confusion == 1.0


def test_all_zero_values():
    frames = [make_frame()] * 10
    result = emotion_summary(frames)
    assert result.avg_brow_raise == 0.0
    assert result.avg_smile == 0.0


def test_known_average_rounding():
    # brow_raise: 0.1, 0.2, 0.3 → mean = 0.2
    frames = [make_frame(brow_raise=0.1), make_frame(brow_raise=0.2), make_frame(brow_raise=0.3)]
    result = emotion_summary(frames)
    assert result.avg_brow_raise == 0.2

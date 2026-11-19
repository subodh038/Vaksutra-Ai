"""
tests/unit/test_head_pose.py — Unit tests for core/visual/head_pose.py

Run:  python -m pytest tests/unit/test_head_pose.py -v
"""

from models.schemas import FrameAnalysisEntry
from core.visual.head_pose import head_pose_summary, score_ranges


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_frame(
    eye_contact=0.5, head_pose=0.5, head_pitch=0.0, head_roll=0.0,
    brow_raise=0.0, stress=0.0, smile=0.0,
    ts: float = 0.0,
) -> FrameAnalysisEntry:
    return FrameAnalysisEntry(
        timestamp=ts, faceDetected=True,
        eyeContactScore=eye_contact, headPoseScore=head_pose,
        headPitch=head_pitch, headRoll=head_roll,
        mouthOpenScore=0.0, smileScore=smile, blinkScore=0.0,
        browRaiseScore=brow_raise, confusionScore=0.0,
        stressScore=stress, frownScore=0.0,
        squintScore=0.0, mockingScore=0.0,
        faceWidth=0.5, gazeZone="center", isReadingScript=False,
    )


# ── head_pose_summary tests ───────────────────────────────────────────────────

def test_empty_frames_returns_all_zeros():
    result = head_pose_summary([])
    assert result.avg_eye_contact == 0.0
    assert result.avg_head_pose == 0.0
    assert result.avg_head_pitch == 0.0
    assert result.avg_head_roll == 0.0


def test_single_frame_exact_values():
    frame = make_frame(eye_contact=0.9, head_pose=0.7, head_pitch=-5.0, head_roll=2.5)
    result = head_pose_summary([frame])
    assert result.avg_eye_contact == 0.9
    assert result.avg_head_pose == 0.7
    assert result.avg_head_pitch == -5.0
    assert result.avg_head_roll == 2.5


def test_average_across_frames():
    f1 = make_frame(eye_contact=0.4, head_pose=0.6)
    f2 = make_frame(eye_contact=0.8, head_pose=0.8)
    result = head_pose_summary([f1, f2])
    assert result.avg_eye_contact == 0.6
    assert result.avg_head_pose == 0.7


def test_negative_pitch_averaged_correctly():
    frames = [
        make_frame(head_pitch=-10.0),
        make_frame(head_pitch=10.0),
    ]
    result = head_pose_summary(frames)
    assert result.avg_head_pitch == 0.0


# ── score_ranges tests ────────────────────────────────────────────────────────

def test_score_ranges_empty_frames():
    result = score_ranges([])
    assert result.eye_contact_min == 0.0
    assert result.eye_contact_max == 0.0
    assert result.eye_contact_avg == 0.0


def test_score_ranges_known_values():
    frames = [
        make_frame(eye_contact=0.2, brow_raise=0.1, stress=0.05, smile=0.0),
        make_frame(eye_contact=0.6, brow_raise=0.5, stress=0.3,  smile=0.4),
        make_frame(eye_contact=1.0, brow_raise=0.9, stress=0.7,  smile=0.8),
    ]
    result = score_ranges(frames)

    assert result.eye_contact_min == 0.2
    assert result.eye_contact_max == 1.0
    assert result.eye_contact_avg == round((0.2 + 0.6 + 1.0) / 3, 4)

    assert result.anxiety_min == 0.1
    assert result.anxiety_max == 0.9

    assert result.smile_min == 0.0
    assert result.smile_max == 0.8


def test_score_ranges_single_frame():
    frame = make_frame(eye_contact=0.75, brow_raise=0.25, stress=0.1, smile=0.5)
    result = score_ranges([frame])
    assert result.eye_contact_min == result.eye_contact_max == result.eye_contact_avg == 0.75
    assert result.anxiety_min == result.anxiety_max == result.anxiety_avg == 0.25

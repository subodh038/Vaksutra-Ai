"""
core/visual/head_pose.py — Head pose summary and score range statistics.

Inputs : List[FrameAnalysisEntry]  (face-detected frames only)
Outputs: HeadPoseSummary, ScoreRanges

score_ranges() is intentionally kept here because it reads the same face_frames
as head_pose_summary(). Seeing raw min/max/avg in the API response helps tune
the event detection thresholds in event_detection.py against real data.
"""

from __future__ import annotations

import statistics
from typing import List

from models.schemas import FrameAnalysisEntry, HeadPoseSummary, ScoreRanges


def head_pose_summary(face_frames: List[FrameAnalysisEntry]) -> HeadPoseSummary:
    """Average head-pose and eye-contact scores across face-detected frames."""
    if not face_frames:
        return HeadPoseSummary(
            avg_eye_contact=0, avg_head_pose=0, avg_head_pitch=0, avg_head_roll=0,
        )

    def avg(attr: str) -> float:
        return round(statistics.mean(getattr(f, attr) for f in face_frames), 4)

    return HeadPoseSummary(
        avg_eye_contact=avg("eyeContactScore"),
        avg_head_pose=  avg("headPoseScore"),
        avg_head_pitch= avg("headPitch"),
        avg_head_roll=  avg("headRoll"),
    )


def score_ranges(face_frames: List[FrameAnalysisEntry]) -> ScoreRanges:
    """
    Compute raw min/max/avg for key signals used in event detection.
    Surfaced in the API response to support threshold tuning against real data.
    """
    def _stats(attr: str) -> tuple[float, float, float]:
        vals = [getattr(f, attr) for f in face_frames]
        if not vals:
            return 0.0, 0.0, 0.0
        return round(min(vals), 4), round(max(vals), 4), round(statistics.mean(vals), 4)

    eye_min, eye_max, eye_avg = _stats("eyeContactScore")
    anx_min, anx_max, anx_avg = _stats("browRaiseScore")
    str_min, str_max, str_avg = _stats("stressScore")
    sml_min, sml_max, sml_avg = _stats("smileScore")

    return ScoreRanges(
        eye_contact_min=eye_min, eye_contact_max=eye_max, eye_contact_avg=eye_avg,
        anxiety_min=anx_min,    anxiety_max=anx_max,    anxiety_avg=anx_avg,
        stress_min=str_min,     stress_max=str_max,     stress_avg=str_avg,
        smile_min=sml_min,      smile_max=sml_max,      smile_avg=sml_avg,
    )

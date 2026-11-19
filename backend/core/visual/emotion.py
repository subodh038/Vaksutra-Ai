"""
core/visual/emotion.py — Emotion blendshape averaging.

Inputs : List[FrameAnalysisEntry]  (face-detected frames only)
Outputs: EmotionSummary            (avg per-emotion score, 0–1)
"""

from __future__ import annotations

import statistics
from typing import List

from models.schemas import EmotionSummary, FrameAnalysisEntry


def emotion_summary(face_frames: List[FrameAnalysisEntry]) -> EmotionSummary:
    """Average blendshape scores across face-detected frames."""
    if not face_frames:
        return EmotionSummary(
            avg_brow_raise=0, avg_confusion=0, avg_stress=0,
            avg_frown=0, avg_squint=0, avg_smile=0, avg_blink_rate=0,
        )

    def avg(attr: str) -> float:
        return round(statistics.mean(getattr(f, attr) for f in face_frames), 4)

    return EmotionSummary(
        avg_brow_raise=avg("browRaiseScore"),
        avg_confusion= avg("confusionScore"),
        avg_stress=    avg("stressScore"),
        avg_frown=     avg("frownScore"),
        avg_squint=    avg("squintScore"),
        avg_smile=     avg("smileScore"),
        avg_blink_rate=avg("blinkScore"),
    )

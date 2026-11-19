"""
core/visual/gaze.py — Gaze zone distribution analysis.

Inputs : List[FrameAnalysisEntry]  (all frames, including no-face frames)
Outputs: GazeBreakdown             (per-zone percentage, 0–100)
"""

from __future__ import annotations

from typing import List

from models.schemas import FrameAnalysisEntry, GazeBreakdown


def gaze_breakdown(frames: List[FrameAnalysisEntry]) -> GazeBreakdown:
    """Return percentage of frames spent in each gaze zone (0–100)."""
    if not frames:
        return GazeBreakdown(center_pct=0, left_pct=0, right_pct=0, down_pct=0, away_pct=0)

    counts: dict[str, int] = {"center": 0, "left": 0, "right": 0, "down": 0, "away": 0}
    for f in frames:
        # "up" = looking off-camera (teleprompter/ceiling) → semantically "away"
        zone = f.gazeZone if f.gazeZone != "up" else "away"
        counts[zone] += 1

    n = len(frames)
    return GazeBreakdown(
        center_pct=round(counts["center"] / n * 100, 1),
        left_pct=  round(counts["left"]   / n * 100, 1),
        right_pct= round(counts["right"]  / n * 100, 1),
        down_pct=  round(counts["down"]   / n * 100, 1),
        away_pct=  round(counts["away"]   / n * 100, 1),
    )

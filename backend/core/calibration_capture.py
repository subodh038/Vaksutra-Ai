"""Local, opt-in capture of artifacts needed for threshold calibration."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from models.schemas import AnalysisResponse

CALIBRATION_ROOT = Path("logs") / "calibration_sessions"


def _safe_suffix(filename: str, fallback: str) -> str:
    suffix = Path(filename).suffix.lower()
    return suffix if suffix and suffix[1:].isalnum() else fallback


def save_calibration_session(
    *,
    audio_bytes: bytes,
    audio_filename: str,
    frame_data: str,
    response: AnalysisResponse,
    video_bytes: bytes | None = None,
    video_filename: str | None = None,
    video_url: str | None = None,
) -> Path:
    """
    Persist one local calibration bundle.

    The bundle is opt-in because it contains raw recordings and facial-analysis
    data. The logs directory is already excluded from version control.
    """
    session_id = (
        f"{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}_"
        f"{uuid4().hex[:8]}"
    )
    session_dir = CALIBRATION_ROOT / session_id
    session_dir.mkdir(parents=True, exist_ok=False)

    audio_path = session_dir / f"audio{_safe_suffix(audio_filename, '.webm')}"
    audio_path.write_bytes(audio_bytes)
    (session_dir / "frame_data.json").write_text(frame_data, encoding="utf-8")
    (session_dir / "analysis_response.json").write_text(
        json.dumps(response.model_dump(mode="json"), indent=2),
        encoding="utf-8",
    )

    if video_bytes is not None:
        video_path = session_dir / f"video{_safe_suffix(video_filename or '', '.webm')}"
        video_path.write_bytes(video_bytes)

    (session_dir / "metadata.json").write_text(
        json.dumps(
            {
                "created_at": datetime.now(timezone.utc).isoformat(),
                "audio_filename": audio_filename,
                "video_filename": video_filename,
                "video_url": video_url,
                "frame_count": response.frame_count,
                "pipeline_status": response.pipeline_status.model_dump(mode="json"),
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return session_dir


def save_video_for_calibration_session(
    session_id: str,
    video_bytes: bytes,
    video_filename: str,
) -> Path:
    """Store an uploaded recording video in its existing calibration bundle."""
    if not re.fullmatch(r"\d{8}T\d{6}Z_[0-9a-f]{8}", session_id):
        raise ValueError("Invalid calibration session ID.")

    session_dir = CALIBRATION_ROOT / session_id
    if not session_dir.is_dir():
        raise FileNotFoundError(f"Calibration session '{session_id}' was not found.")

    video_path = session_dir / f"video{_safe_suffix(video_filename, '.webm')}"
    video_path.write_bytes(video_bytes)

    metadata_path = session_dir / "metadata.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    metadata["video_filename"] = video_filename
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return video_path

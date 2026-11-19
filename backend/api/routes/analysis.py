"""
api/routes/analysis.py — POST /analyze route.

Responsibilities (thin layer only):
  1. Resolve the coaching mode from the 'mode' form field.
  2. Validate + parse frame_data and audio.
  3. Enforce upload size limits from config.
  4. Call core/pipeline.py run_analysis() with the active mode.
  5. Return AnalysisResponse.

No business logic or scoring here — that lives in core/ and modes/.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile, BackgroundTasks

from config import get_settings
import uuid

from core.pipeline import run_analysis
from models.schemas import AnalysisResponse, FrameAnalysisPayload, RawSignals
from modes import MODE_REGISTRY
from modes.base import BaseMode
from services.llm_coach import generate_coaching_report
from api.deps.auth import CurrentUser
import json
import asyncio

logger   = logging.getLogger(__name__)
router   = APIRouter(tags=["analysis"])
settings = get_settings()

# How long a saved-but-report-less session is treated as "still processing"
# before the poll endpoint admits the background task failed.
PROCESSING_GRACE_SECONDS = 15 * 60

# Shared rate limiter — imported from api.limiter to avoid circular imports with main.py
from api.limiter import limiter


@router.post(
    "/analyze",
    response_model=AnalysisResponse,
    summary="Analyze audio + frame data",
    description=(
        "Accepts the WebM audio blob (Module A) and the JSON frame-analysis array "
        "(frontend MediaPipe pipeline). Returns a structured coaching report. "
        "Pass mode='impromptu' (default), 'presentation', or 'interview'."
    ),
)
@limiter.limit("5/minute")
async def analyze(
    request: Request,
    user: CurrentUser,
    audio: UploadFile = File(
        ...,
        description="Audio-only WebM blob (128 kbps, audio/webm).",
    ),
    frame_data: str = Form(
        ...,
        description="JSON string of FrameAnalysisPayload from the frontend MediaPipe pipeline.",
    ),
    mode: str = Form(
        default="impromptu",
        description="Coaching mode: 'impromptu' | 'presentation' | 'interview'",
    ),
    topic: str = Form(
        default="",
        max_length=300,
        description="The speaking topic/prompt the user was given (optional but recommended).",
    ),
    video_url: Optional[str] = Form(
        default=None,
        description="Optional URL to the recorded video for this session.",
    ),
    background_tasks: BackgroundTasks = BackgroundTasks(),
) -> AnalysisResponse:
    """Main analysis endpoint. Requires authentication. Rate limited to 5 requests/minute per IP."""

    # ── 1. Resolve coaching mode ──────────────────────────────────────────────
    active_mode = MODE_REGISTRY.get(mode)
    if active_mode is None:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown mode '{mode}'. Valid modes: {list(MODE_REGISTRY.keys())}",
        )

    # ── 2. Parse & validate frame data ───────────────────────────────────────
    try:
        payload = FrameAnalysisPayload.model_validate_json(frame_data)
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid frame_data JSON: {exc}",
        ) from exc

    # ── 3. Read & size-check audio ────────────────────────────────────────────
    audio_bytes: bytes = await audio.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=422, detail="Received empty audio file.")
    if len(audio_bytes) > settings.max_audio_bytes:
        raise HTTPException(
            status_code=413,
            detail=(
                f"Audio file too large ({len(audio_bytes):,} bytes). "
                f"Maximum allowed: {settings.max_audio_bytes:,} bytes."
            ),
        )

    audio_filename: str = audio.filename or "recording.webm"
    # ── 4. Run analysis ───────────────────────────────────────────────────────
    response, signals = await run_analysis(
        audio_bytes=       audio_bytes,
        audio_content_type=audio.content_type or "audio/webm",
        audio_filename=    audio_filename,
        payload=           payload,
        mode=              active_mode,
    )
    session_id = str(uuid.uuid4())
    logger.info("Generated new session_id: %s", session_id)

    # ── 5. Persist deterministic results IMMEDIATELY ─────────────────────────
    # Save-before-return means a crash during LLM coaching can never lose the
    # score/transcript. The report is patched into the row later.
    key_metrics = _build_key_metrics(response, signals)
    try:
        from db.repositories.sessions import save_session
        await save_session(
            session_id=session_id,
            user_id=user["id"],
            mode=active_mode.mode_id,
            score=response.overall_score,
            transcript=signals.transcript or "",
            coaching_report=None,           # patched by background task
            key_metrics=key_metrics,
            topic=topic.strip() or None,
            video_url=video_url,
            full_analysis=response.model_dump(mode="json"),
        )
        logger.info("[ANALYZE] │ Deterministic session saved upfront — %s", session_id)
    except Exception as exc:
        # The score/transcript are still returned to the user, but WITHOUT a
        # saved row the background coach patch would match nothing and the
        # report would be silently lost while the client polls for 15 minutes.
        # Fail loudly so the client knows coaching is unavailable.
        logger.error("Upfront session save failed (%s): %s", session_id, exc)
        raise HTTPException(
            status_code=502,
            detail="Analysis succeeded but the session could not be persisted — coaching unavailable. Please try again.",
        ) from exc

    # ── 6. Background: LLM coaching → patch DB → memory update ───────────────
    background_tasks.add_task(
        run_llm_coaching_bg,
        session_id=session_id,
        signals=signals,
        score=response.overall_score,
        mode=active_mode,
        user_id=user["id"],
        topic=topic.strip() or None,
        key_metrics=key_metrics,
    )

    return response.model_copy(update={"calibration_session_id": session_id})


def _build_key_metrics(response: AnalysisResponse, signals: RawSignals) -> dict:
    """Compact per-session metrics stored alongside the session row.
    gaze_center_pct (0-100) is the reliable presence signal — avg_eye_contact
    is MediaPipe-capped and mis-classified nearly every speaker."""
    ac = signals.acoustic_stats
    ls = signals.linguistic_stats
    return {
        "filler_words_found":  ls.filler_words_found if ls else [],
        "filler_word_ratio":   ls.filler_word_ratio if ls else 0.0,
        "weak_words_found":    ls.weak_words_found if ls else [],
        "gaze_center_pct":     response.gaze.center_pct,
        "gaze_away_count": sum(
            1 for e in response.detected_events if e.type == "gaze_away"
        ),
        "wpm":                 ac.wpm if ac else 0.0,
        "pitch_variation":     ac.pitch_variation if ac else 0.0,
        "pause_count":         ac.pause_count if ac else 0,
        "avg_brow_raise":      response.emotion.avg_brow_raise,
    }


async def run_llm_coaching_bg(
    session_id: str,
    signals: RawSignals,
    score: float,
    mode: BaseMode,
    user_id: str,
    topic: Optional[str] = None,
    key_metrics: Optional[dict] = None,
):
    """Background task: LLM coaching → patch saved row → update coaching memory."""
    key_metrics = key_metrics or {}
    report = None
    try:
        report = await generate_coaching_report(
            signals, score, mode, user_id=user_id, topic=topic
        )
        if report:
            logger.info("[BG COACH] │ Report generated — %s", session_id)
        else:
            logger.error("[BG COACH] │ Report generation returned None — %s", session_id)
    except Exception as e:
        logger.error("[BG COACH] │ Coaching failed — %s: %s", session_id, e)

    # ── Patch the coaching report into the already-saved row ────────────────
    if report:
        try:
            from db.repositories.sessions import update_coaching_report
            patched = await update_coaching_report(session_id, report.model_dump())
            if not patched:
                logger.error(
                    "[BG COACH] │ Report for %s could not be persisted (no row) — "
                    "client polling will exhaust its grace window.", session_id,
                )
        except Exception as exc:
            logger.error("Failed to patch coaching report into %s: %s", session_id, exc)

    # ── Update coaching memory (the Soul) ─────────────────────────────────
    try:
        from services.coaching_memory import on_session_end as _on_session_end
        await _on_session_end(
            user_id=user_id,
            session_data={**key_metrics, "score": score},
            coaching_report=report.model_dump() if report else None,
        )
    except Exception as exc:
        logger.error("Failed to update coaching memory: %s", exc)


@router.get("/analyze/coach/{session_id}", summary="Poll for async LLM coaching report")
@limiter.limit("120/minute")
async def get_coaching_report(request: Request, session_id: str, user: CurrentUser):

    from datetime import datetime, timezone

    from db.repositories.sessions import get_session
    from fastapi.responses import JSONResponse

    session = await get_session(session_id, user["id"])

    if not session:
        # No row yet — extremely brief window before the upfront save lands.
        logger.debug("[POLL] │ %s not visible yet → 202", session_id[:8])
        return JSONResponse(status_code=202, content={"status": "processing"})

    report = session.get("coaching_report")
    if not report:
        # Row exists but no report: still processing OR the background task died.
        # Distinguish via row age — within the grace window we keep saying 202;
        # after it, surface the failure so the frontend stops spinning.
        created_raw = session.get("created_at")
        grace_ok = True
        if created_raw:
            try:
                created = datetime.fromisoformat(str(created_raw).replace("Z", "+00:00"))
                age_s = (datetime.now(timezone.utc) - created).total_seconds()
                grace_ok = age_s < PROCESSING_GRACE_SECONDS
                logger.debug(
                    "[POLL] │ %s report pending, age=%.0fs → %s",
                    session_id[:8], age_s, "202 processing" if grace_ok else "500 failed",
                )
            except ValueError:
                pass  # unparseable timestamp → treat as still-in-grace
        if grace_ok:
            return JSONResponse(status_code=202, content={"status": "processing"})
        raise HTTPException(status_code=500, detail="Coaching report generation failed.")

    return JSONResponse(content=report)

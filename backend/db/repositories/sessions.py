"""
db/repositories/sessions.py — Session CRUD against Supabase.
"""

import logging
from typing import Any, Dict, List, Optional

from db.client import get_admin_db

logger = logging.getLogger(__name__)


async def save_session(
    *,
    session_id: str,
    user_id: str,
    mode: str,
    score: float,
    transcript: str,
    coaching_report: Optional[Dict[str, Any]],
    key_metrics: Dict[str, Any],
    topic: Optional[str] = None,
    video_url: Optional[str] = None,
    full_analysis: Optional[Dict[str, Any]] = None,
) -> None:
    """Insert one analysis session into the sessions table."""
    db = await get_admin_db()
    row: Dict[str, Any] = {
        "session_id":      session_id,
        "user_id":         user_id,
        "mode":            mode,
        "score":           score,
        "transcript":      transcript,
        "coaching_report": coaching_report,
        "key_metrics":     key_metrics,
        "full_analysis":   full_analysis,
    }
    if topic:
        row["topic"] = topic
    if video_url:
        row["video_url"] = video_url
    await db.table("sessions").insert(row).execute()
    logger.info("Session saved → %s  user=%s  score=%.1f  topic=%.40s",
                session_id, user_id, score, topic or "(none)")


async def get_sessions(user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Return the most recent sessions for a user, newest first."""
    db = await get_admin_db()
    result = (
        await db.table("sessions")
        .select("id, session_id, mode, score, transcript, coaching_report, key_metrics, created_at, video_url, topic, full_analysis")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data if result else []


async def update_coaching_report(session_id: str, coaching_report: Dict[str, Any]) -> bool:
    """Patch the coaching_report column after the background LLM finishes.

    Returns True when a row was actually updated. A False return means the
    upfront save failed earlier (or the row vanished) — callers must treat
    the report as LOST rather than assume the client can poll for it.
    """
    db = await get_admin_db()
    result = (
        await db.table("sessions")
        .update({"coaching_report": coaching_report})
        .eq("session_id", session_id)
        .execute()
    )
    updated = bool(result and result.data)
    if updated:
        logger.info("Coaching report patched → %s", session_id)
    else:
        logger.error(
            "Coaching report patch matched NO row — session %s was never "
            "saved; report is lost.", session_id,
        )
    return updated


async def get_session(session_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    """Return a single session, verified to belong to the requesting user.

    Uses .maybe_single() — .single() raises when the row doesn't exist yet,
    which broke the poll endpoint's 202 "still processing" contract.
    """
    db = await get_admin_db()
    result = (
        await db.table("sessions")
        .select("*")
        .eq("session_id", session_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    return result.data if result else None

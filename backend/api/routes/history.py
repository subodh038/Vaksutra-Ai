"""
api/routes/history.py — Session history and coaching profile endpoints.

All routes require authentication (Bearer JWT).

GET  /sessions                  → paginated list of past sessions
GET  /sessions/{session_id}     → single session with full coaching report
GET  /profile                   → user's coaching profile (the Soul)
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from api.deps.auth import CurrentUser
from db.repositories import sessions as session_repo
from db.repositories import profiles as profile_repo

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sessions", tags=["history"])


@router.get("")
async def list_sessions(
    user: CurrentUser,
    limit: int = Query(default=20, ge=1, le=100),
):
    """Return the most recent sessions for the authenticated user."""
    sessions = await session_repo.get_sessions(user["id"], limit=limit)
    return {
        "sessions": sessions,
        "count":    len(sessions),
    }


@router.get("/{session_id}")
async def get_session(session_id: str, user: CurrentUser):
    """Return a single session with full coaching report."""
    session = await session_repo.get_session(session_id, user["id"])
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found.")
    return session


# ── Coaching profile ──────────────────────────────────────────────────────────

profile_router = APIRouter(prefix="/profile", tags=["profile"])


@profile_router.get("")
async def get_profile(user: CurrentUser):
    """
    Return the user's coaching profile (the Soul).
    Returns 404 if no sessions have been recorded yet.
    """
    profile = await profile_repo.get_profile(user["id"])
    if profile is None:
        return {
            "session_count":        0,
            "avg_score":            None,
            "best_score":           None,
            "last_score":           None,
            "score_trend":          "stable",
            "top_filler_words":     [],
            "recurring_weaknesses": [],
            "recurring_strengths":  [],
            "coaching_summary":     None,
            "memory_active":        False,
        }

    from services.coaching_memory import MEMORY_THRESHOLD
    profile["memory_active"] = (profile.get("session_count") or 0) >= MEMORY_THRESHOLD
    return profile

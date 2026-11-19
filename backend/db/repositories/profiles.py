"""
db/repositories/profiles.py — User coaching profile CRUD (the Soul store).

NOTE on concurrency: increment_session() is a read-modify-write without a DB
transaction. Two truly simultaneous sessions from the SAME user could lose one
score. Acceptable at beta scale; move to a Postgres function/trigger if it
ever matters.
"""

import logging
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from db.client import get_admin_db

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    """ISO-8601 UTC timestamp — PostgREST casts this cleanly into timestamptz.
    (The previous literal "now()" string is NOT evaluated by PostgREST and
    breaks timestamptz inserts.)"""
    return datetime.now(timezone.utc).isoformat()


async def get_profile(user_id: str) -> Optional[Dict[str, Any]]:
    """Fetch the coaching profile for a user. Returns None if not yet created."""
    db = await get_admin_db()
    result = (
        await db.table("user_coaching_profiles")
        .select("*")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    return result.data if result else None


async def upsert_profile(user_id: str, updates: Dict[str, Any]) -> None:
    """
    Create or update the coaching profile for a user.
    `updates` should contain only the fields being changed.

    Atomic single-statement upsert: two concurrent callers (e.g. the two
    asyncio.gather'd memory writers) can no longer race between the read and
    the insert/update. Requires a unique constraint on user_coaching_profiles.user_id.
    """
    db = await get_admin_db()

    # Always refresh updated_at
    updates["updated_at"] = _now_iso()

    result = (
        await db.table("user_coaching_profiles")
        .upsert({"user_id": user_id, **updates}, on_conflict="user_id")
        .execute()
    )
    logger.info(
        "Coaching profile upserted → user=%s  sessions=%s",
        user_id, (result.data[0].get("session_count") if result and result.data else "?"),
    )


async def increment_session(
    user_id: str,
    new_score: float,
    filler_words: List[str],
    weaknesses: List[str],
    strengths: List[str],
) -> Dict[str, Any]:
    """
    Update aggregate stats after a new session.
    Returns the updated profile dict (used by coaching_memory to decide
    whether to generate a new coaching_summary).
    """
    db     = await get_admin_db()
    profile = await get_profile(user_id)

    if profile is None:
        scores       = [new_score]
        session_count = 1
    else:
        scores        = (profile.get("scores") or []) + [new_score]
        session_count = len(scores)

    avg_score  = sum(scores) / len(scores)
    best_score = max(scores)
    last_score = new_score

    # Simple trend: compare last 3 sessions vs previous 3
    if len(scores) >= 6:
        recent   = sum(scores[-3:]) / 3
        previous = sum(scores[-6:-3]) / 3
        trend = "improving" if recent > previous + 2 else (
                "declining" if recent < previous - 2 else "stable")
    else:
        trend = "stable"

    # Merge filler words — rank by combined frequency across all sessions,
    # keep top 10 (the name says "top", so order must reflect frequency).
    existing_fillers = profile.get("top_filler_words", []) if profile else []
    filler_freq      = Counter([*existing_fillers, *filler_words])
    merged_fillers   = [w for w, _ in filler_freq.most_common(10)]

    # Weaknesses / strengths — simple union, keep last 5
    existing_w = profile.get("recurring_weaknesses", []) if profile else []
    existing_s = profile.get("recurring_strengths", []) if profile else []
    merged_w   = list(dict.fromkeys(existing_w + weaknesses))[:5]
    merged_s   = list(dict.fromkeys(existing_s + strengths))[:5]

    updates = {
        "session_count":        session_count,
        "scores":               scores,
        "avg_score":            round(avg_score, 1),
        "best_score":           round(best_score, 1),
        "last_score":           round(last_score, 1),
        "score_trend":          trend,
        "top_filler_words":     merged_fillers,
        "recurring_weaknesses": merged_w,
        "recurring_strengths":  merged_s,
        "last_session_at":      _now_iso(),
    }

    await upsert_profile(user_id, updates)

    # Return merged profile for coaching_memory to use
    return {**(profile or {}), **updates, "user_id": user_id}


async def save_user_core(user_id: str, user_core: dict) -> None:
    """Persist the USER_CORE psychological profile JSON block."""
    await upsert_profile(user_id, {"user_core": user_core})
    logger.info("USER_CORE saved → user=%s", user_id)


async def save_skill_memory(user_id: str, skill_memory: dict) -> None:
    """Persist the SKILL_MEMORY technical pattern JSON block."""
    await upsert_profile(user_id, {"skill_memory": skill_memory})
    logger.info("SKILL_MEMORY saved → user=%s", user_id)

"""
api/routes/topics.py — Topic generation endpoint.

GET /topics/generate?mode=impromptu
    Returns a fresh, non-repeating LLM-generated speaking topic for the
    authenticated user. Checks the last 5 topics in their history to avoid
    repetition, and uses their coaching soul for personalisation.
"""

import logging
import time

from fastapi import APIRouter, Query

from api.deps.auth import CurrentUser
from services.topic_generator import generate_topic

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/topics", tags=["topics"])

VALID_MODES = {"impromptu", "interview", "presentation"}


@router.get("/generate")
async def get_topic(
    user: CurrentUser,
    mode: str = Query(default="impromptu", description="Coaching mode"),
):
    """
    Generate a unique speaking topic for the authenticated user.

    - Checks last 5 generated topics to avoid repetition.
    - Uses coaching soul (after 3+ sessions) to personalise difficulty/type.
    - Saves the generated topic to history so it won't repeat.
    """
    t0 = time.perf_counter()
    logger.info("[TOPICS ROUTE] │ Request received — user=%s mode=%s", user["id"][:8], mode)

    if mode not in VALID_MODES:
        logger.warning("[TOPICS ROUTE] Invalid mode '%s', defaulting to 'impromptu'", mode)
        mode = "impromptu"

    topic = await generate_topic(user_id=user["id"], mode=mode)

    elapsed = (time.perf_counter() - t0) * 1000
    logger.info("[TOPICS ROUTE] ✔ Done in %.0fms — topic: %s", elapsed, topic[:60])
    return {"topic": topic, "mode": mode}

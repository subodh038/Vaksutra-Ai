"""
api/routes/feedback.py — Beta feedback collection.

POST /feedback — stores one structured review per user (upsert on user_id).
GET  /feedback/mine — returns the caller's latest submission (for prefill).

Table (run once in Supabase SQL editor):

create table if not exists beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  ease_rating int not null check (ease_rating between 1 and 5),
  report_useful text not null,          -- yes | somewhat | no
  coach_useful text not null,           -- yes | somewhat | no
  weakest_area text not null,           -- eye_contact | filler_words | pacing | confidence | structure
  nps_score int not null check (nps_score between 0 and 10),
  premium_worth text not null,          -- more_modes | history_tracking | deeper_coaching | nothing_free
  biggest_issue text not null,          -- free text
  wanted_feature text,                  -- free text, optional
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table beta_feedback enable row level security;
create policy "own feedback" on beta_feedback for all using (auth.uid() = user_id);
"""

import logging
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from api.deps.auth import CurrentUser
from config import get_settings
from db.client import get_admin_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/feedback", tags=["feedback"])


class FeedbackIn(BaseModel):
    ease_rating: int = Field(..., ge=1, le=5)
    report_useful: Literal["yes", "somewhat", "no"]
    coach_useful: Literal["yes", "somewhat", "no"]
    weakest_area: Literal[
        "eye_contact", "filler_words", "pacing", "confidence", "structure"
    ]
    nps_score: int = Field(..., ge=0, le=10)
    premium_worth: Literal[
        "more_modes", "history_tracking", "deeper_coaching", "nothing_free"
    ]
    biggest_issue: str = Field(..., min_length=3, max_length=1000)
    wanted_feature: Optional[str] = Field(default=None, max_length=500)


@router.post("")
async def submit_feedback(payload: FeedbackIn, request: Request, user: CurrentUser):
    """Upsert one structured review per user."""
    settings = get_settings()
    if settings.supabase_service_role_key == "":
        raise HTTPException(status_code=503, detail="Storage not configured.")
    db = await get_admin_db()

    now = datetime.now(timezone.utc).isoformat()
    row = {"user_id": user["id"], **payload.model_dump(), "updated_at": now}

    result = (
        await db.table("beta_feedback")
        .upsert(row, on_conflict="user_id")
        .execute()
    )
    if not (result and result.data):
        raise HTTPException(status_code=502, detail="Could not save feedback.")
    logger.info("[FEEDBACK] │ received from user=%s nps=%s", user["id"][:8], payload.nps_score)
    return {"ok": True}


@router.get("/mine")
async def my_feedback(request: Request, user: CurrentUser):
    db = await get_admin_db()
    result = (
        await db.table("beta_feedback")
        .select("*")
        .eq("user_id", user["id"])
        .maybe_single()
        .execute()
    )
    return result.data or {}

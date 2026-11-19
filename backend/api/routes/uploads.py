"""
api/routes/uploads.py — Direct-to-Supabase video upload coordination.

The frontend uploads session videos straight to Supabase Storage so the
FastAPI process never receives the heavy payload. This router only issues
short-lived signed URLs (tiny JSON responses):

POST /uploads/video/upload-url        → signed PUT target + storage path
GET  /uploads/video/view-url?path=…   → signed read URL for playback

Both endpoints require a valid Bearer JWT. Video bytes themselves never
touch this server, keeping /analyze light for concurrent users.
"""

import logging
import re
import secrets
import time
from typing import Any, Dict

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from api.deps.auth import CurrentUser
from api.limiter import limiter
from config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/uploads", tags=["uploads"])

VIDEO_BUCKET = "session_videos"
UPLOAD_URL_TTL_S = 120  # time the browser has to start its PUT
VIEW_URL_TTL_S = 3600   # signed playback link validity

# Storage objects are namespaced per user: "{user_id}/{filename}". View paths
# must match that shape AND belong to the requesting user (ownership check in
# the route). The regex rejects separators/traversal beyond that one segment.
_SAFE_PATH_RE = re.compile(r"^[0-9a-fA-F-]{36}/[A-Za-z0-9_.-]+$")


def _validate_path(path: str, user_id: str) -> str:
    """Allow only flat filenames inside the CALLING USER's bucket folder."""
    if (
        not path
        or ".." in path
        or not _SAFE_PATH_RE.fullmatch(path)
        or not path.startswith(f"{user_id}/")
    ):
        raise HTTPException(status_code=400, detail="Invalid storage path.")
    return path


def _require_storage_config() -> None:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(
            status_code=503,
            detail="Video storage is not configured on the server.",
        )


def _service_headers() -> Dict[str, str]:
    settings = get_settings()
    return {
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "apikey": settings.supabase_service_role_key,
    }





class UploadUrlResponse(BaseModel):
    upload_url: str          # absolute URL the browser PUTs the video bytes to
    path: str                # canonical storage path — store this as video_url


@router.post("/video/upload-url", response_model=UploadUrlResponse)
@limiter.limit("10/minute")
async def create_video_upload_url(
    request: Request,
    user: CurrentUser,
) -> UploadUrlResponse:
    """
    Create a short-lived signed upload URL.

    Flow: frontend calls this (tiny JSON), then PUTs the raw video bytes
    directly to `upload_url`. FastAPI never sees the payload.
    """
    _require_storage_config()
    settings = get_settings()

    # Namespace by user id so ownership is enforced structurally (view-url
    # can then verify path prefix == caller's id).
    filename = f"{user['id']}/{int(time.time() * 1000)}_{secrets.token_hex(4)}.webm"

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{settings.supabase_url}/storage/v1/object/upload/sign/{VIDEO_BUCKET}/{filename}",
            headers=_service_headers(),
            json={"expiresIn": UPLOAD_URL_TTL_S},
        )

    if resp.status_code != 200:
        logger.error(
            "[UPLOADS] │ Supabase sign-upload failed (%s): %s",
            resp.status_code, resp.text[:300],
        )
        raise HTTPException(status_code=502, detail="Could not create upload URL.")

    data = resp.json()
    relative = data.get("url") or data.get("signedUrl")
    if not relative:
        logger.error("[UPLOADS] │ Unexpected sign-upload response: %s", data)
        raise HTTPException(status_code=502, detail="Could not create upload URL.")

    upload_url = (
        relative if relative.startswith("http")
        else f"{settings.supabase_url}/storage/v1{relative}"
    )
    logger.info(
        "[UPLOADS] │ Issued upload URL — user=%s path=%s ttl=%ss",
        user["id"][:8], filename, UPLOAD_URL_TTL_S,
    )
    return UploadUrlResponse(upload_url=upload_url, path=filename)


@router.get("/video/view-url")
@limiter.limit("60/minute")
async def create_video_view_url(
    request: Request,
    user: CurrentUser,
    path: str,
) -> Dict[str, Any]:
    """
    Create a short-lived signed read URL for a stored session video.
    Used by History/Review playback since the bucket is private.
    """
    _require_storage_config()
    settings = get_settings()
    _validate_path(path, user["id"])

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{settings.supabase_url}/storage/v1/object/sign/{VIDEO_BUCKET}/{path}",
            headers=_service_headers(),
            json={"expiresIn": VIEW_URL_TTL_S},
        )

    if resp.status_code != 200:
        logger.error(
            "[UPLOADS] │ Supabase sign-read failed (%s) for %s: %s",
            resp.status_code, path, resp.text[:300],
        )
        raise HTTPException(status_code=404, detail="Video not found.")

    data = resp.json()
    relative = data.get("signedURL") or data.get("signedUrl") or data.get("url")
    if not relative:
        raise HTTPException(status_code=502, detail="Could not create view URL.")

    url = (
        relative if relative.startswith("http")
        else f"{settings.supabase_url}/storage/v1{relative}"
    )
    return {"url": url, "expires_in": VIEW_URL_TTL_S}

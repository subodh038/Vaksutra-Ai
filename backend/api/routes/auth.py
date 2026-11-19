"""
api/routes/auth.py — Email/password auth endpoints backed by Supabase Auth.

Endpoints
---------
POST /auth/signup   Create a new account with email + password.
POST /auth/login    Log in and get access + refresh tokens.
POST /auth/logout   Invalidate the current session.
POST /auth/refresh  Exchange a refresh token for a new access token.
GET  /auth/me       Return the current authenticated user.
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr

from api.deps.auth import CurrentUser, get_current_user
from api.limiter import limiter
from db.client import get_anon_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

_bearer = HTTPBearer(auto_error=False)


# ── Request / Response models ─────────────────────────────────────────────────

class AuthRequest(BaseModel):
    email:    EmailStr
    password: str
    name:     str | None = None
    ref:      str | None = None  # marketing attribution, e.g. ?ref=reddit


class TokenResponse(BaseModel):
    access_token:  str
    refresh_token: str
    token_type:    str = "bearer"
    user_id:       str
    email:         str
    name:          str | None = None


class RefreshRequest(BaseModel):
    refresh_token: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def signup(request: Request, body: AuthRequest):
    """Create a new Vocalyze account. Rate limited — signup endpoints are abuse magnets."""
    db = await get_anon_db()
    try:
        kwargs = {"email": body.email, "password": body.password}
        metadata = {"name": body.name} if body.name else {}
        if body.ref:
            metadata["ref"] = body.ref[:64]  # bound length; ignore empty strings
        if metadata:
            kwargs["options"] = {"data": metadata}
        resp = await db.auth.sign_up(kwargs)
    except Exception as exc:
        logger.warning("Signup failed for %s: %s", body.email, exc)
        
        error_str = str(exc).lower()
        if "already registered" in error_str or "already exists" in error_str:
            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists. Please switch to 'Log In'.",
            )
            
        # Mask all other errors
        raise HTTPException(
            status_code=400,
            detail="Signup failed — check email format and ensure password is ≥6 characters.",
        )

    if resp.user is None:
        raise HTTPException(
            status_code=400,
            detail="Signup failed — check email format and ensure password is ≥6 characters.",
        )
    if resp.session is None:
        raise HTTPException(
            status_code=400,
            detail="Signup successful, but please check your email inbox to confirm your address before logging in. (Or disable 'Confirm Email' in Supabase Settings).",
        )
    logger.info("New user signed up: %s", resp.user.email)
    return TokenResponse(
        access_token=resp.session.access_token,
        refresh_token=resp.session.refresh_token,
        user_id=resp.user.id,
        email=resp.user.email,
        name=resp.user.user_metadata.get("name") if resp.user and resp.user.user_metadata else None,
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, body: AuthRequest):
    """Log in with email and password. Rate limited to slow credential stuffing."""
    db = await get_anon_db()
    try:
        resp = await db.auth.sign_in_with_password(
            {"email": body.email, "password": body.password}
        )
    except Exception as exc:
        logger.warning("Login failed for %s: %s", body.email, exc)
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if resp.user is None or resp.session is None:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    logger.info("User logged in: %s", resp.user.email)
    return TokenResponse(
        access_token=resp.session.access_token,
        refresh_token=resp.session.refresh_token,
        user_id=resp.user.id,
        email=resp.user.email,
        name=resp.user.user_metadata.get("name") if resp.user and resp.user.user_metadata else None,
    )


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("30/minute")
async def refresh_token(request: Request, body: RefreshRequest):
    """Exchange a refresh token for a fresh access token."""
    db = await get_anon_db()
    try:
        resp = await db.auth.refresh_session(body.refresh_token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Refresh token invalid or expired.")

    if resp.session is None:
        raise HTTPException(status_code=401, detail="Could not refresh session.")

    return TokenResponse(
        access_token=resp.session.access_token,
        refresh_token=resp.session.refresh_token,
        user_id=resp.user.id,
        email=resp.user.email,
        name=resp.user.user_metadata.get("name") if resp.user and resp.user.user_metadata else None,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(user: CurrentUser):
    """Acknowledge sign-out.

    Token invalidation is not performed server-side: GoTrue revocation would
    require the user's own session client — the shared anon client's
    sign_out() is a no-op for other tokens. The frontend clears its stored
    tokens; the JWT simply expires naturally.
    """
    logger.info("User signed out: %s", user["email"])


@router.get("/me")
async def me(user: CurrentUser):
    """Return the currently authenticated user's basic info."""
    return {
        "user_id": user["id"],
        "email":   user["email"],
        "name":    user.get("name"),
    }

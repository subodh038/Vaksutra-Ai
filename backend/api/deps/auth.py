"""
api/deps/auth.py — FastAPI dependency that verifies Supabase JWT.

Usage in any route:
    from api.deps.auth import get_current_user, CurrentUser

    @router.get("/me")
    async def me(user: CurrentUser):
        return {"user_id": user["id"], "email": user["email"]}
"""

import logging
from typing import Annotated, Any, Dict

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from db.client import get_anon_db

logger = logging.getLogger(__name__)

# FastAPI security scheme — reads Authorization: Bearer <token>
_bearer = HTTPBearer(auto_error=True)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> Dict[str, Any]:
    """
    Verify the Bearer JWT with Supabase and return the user dict.
    Raises 401 if the token is missing, expired, or invalid.
    """
    token = credentials.credentials
    try:
        db   = await get_anon_db()
        resp = await db.auth.get_user(token)
        if resp is None or resp.user is None:
            raise ValueError("no user in response")
        user = resp.user
        return {
            "id":    user.id,
            "email": user.email,
            # Display name lives in auth metadata — surfaced so /auth/me works.
            "name":  (user.user_metadata or {}).get("name"),
        }
    except Exception as exc:
        logger.warning("JWT verification failed: %s", exc)
        # Distinguish "token is actually bad" from "we couldn't reach Supabase
        # to ask". A transient DNS/network outage must NOT read as a login
        # failure — that triggers pointless token refreshes and forces the
        # user to re-authenticate mid-session.
        msg = str(exc).lower()
        is_auth_api_error = type(exc).__name__ == "AuthApiError"
        
        transient = (
            not is_auth_api_error and (
                not msg.strip()  # bare transport exceptions often stringify empty
                or any(
                    s in msg
                    for s in (
                        "getaddrinfo",   # DNS resolution failure
                        "connect",       # ConnectError / connection refused-reset
                        "timed out",
                        "timeout",
                        "unreachable",
                        "network",
                    )
                )
            )
        )
        if transient:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Auth service temporarily unreachable — please retry.",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )


# Convenience type alias for use in route signatures
CurrentUser = Annotated[Dict[str, Any], Depends(get_current_user)]

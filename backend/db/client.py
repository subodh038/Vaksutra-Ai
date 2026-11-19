"""
db/client.py — Supabase async client singletons.

Two clients:
  get_admin_db()  : service_role key — bypasses RLS, for all backend writes.
  get_anon_db()   : anon key — used to verify user JWTs via supabase.auth.get_user().

Both are cached at module level (one instance per process, reused across
every request — avoids re-creating HTTP connection pools).
"""

import logging
from functools import lru_cache

from supabase import AsyncClient, acreate_client

from config import get_settings

logger = logging.getLogger(__name__)

# Module-level singletons — initialised on first call.
_admin_client: AsyncClient | None = None
_anon_client:  AsyncClient | None = None


async def get_admin_db() -> AsyncClient:
    """
    Return the service-role Supabase client (bypasses RLS).
    Use for all server-side reads/writes.
    """
    global _admin_client
    if _admin_client is None:
        settings = get_settings()
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env"
            )
        _admin_client = await acreate_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
        logger.info("Supabase admin client initialised → %s", settings.supabase_url)
    return _admin_client


async def get_anon_db() -> AsyncClient:
    """
    Return the anon-key Supabase client.
    Used to call supabase.auth.get_user(jwt) for JWT verification.
    """
    global _anon_client
    if _anon_client is None:
        settings = get_settings()
        if not settings.supabase_url or not settings.supabase_anon_key:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env"
            )
        _anon_client = await acreate_client(
            settings.supabase_url,
            settings.supabase_anon_key,
        )
        logger.info("Supabase anon client initialised → %s", settings.supabase_url)
    return _anon_client

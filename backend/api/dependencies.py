"""
api/dependencies.py — Shared FastAPI Depends() helpers.

Add authentication, rate-limiting, or per-request config injection here.
Routes import from this file rather than duplicating DI logic.
"""

from fastapi import Depends

from config import Settings, get_settings


def settings_dep(settings: Settings = Depends(get_settings)) -> Settings:
    """Inject the app settings into a route."""
    return settings

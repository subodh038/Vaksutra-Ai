"""
config.py — Centralised settings for the Vocalyze AI Backend.

All environment variables are declared here using pydantic-settings.
No other file should call os.getenv() or os.environ directly —
import `get_settings()` instead.

Add new env vars here first, then use them via `settings.<field>`.
"""

from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── Groq ──────────────────────────────────────────────────────────────────
    # Accepts comma-separated list (GROQ_API_KEYS) OR individual vars
    # (GROQ_API_KEY, GROQ_API_KEY_1, GROQ_API_KEY_2 ...).
    # Key collection logic lives in clients/groq_client.py.
    groq_transcription_model: str = "whisper-large-v3"
    groq_llm_model:           str = "llama-3.1-8b-instant"

    # ── Mistral (LLM coaching — primary) ────────────────────────────────────────
    # Read from MISTRAL_API_KEY in .env.
    mistral_api_key:        str = ""
    mistral_coaching_model: str = "mistral-medium-latest"

    # ── Groq LLM fallback (gpt-oss-120b) ─────────────────────────────────────
    # Uses the same Groq keys as transcription. Model differs from Whisper.
    groq_coaching_model: str = "openai/gpt-oss-120b"

    # ── CORS ───────────────────────────────────────────────────────────────────
    # Add your production domain here before deploying.
    # NEVER set to ["*"] in production.
    cors_origins: str = (
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:3001,http://127.0.0.1:3001,"
        "http://localhost:3002,http://127.0.0.1:3002"
    )

    # ── Upload limits ──────────────────────────────────────────────────────────
    max_audio_bytes: int = Field(default=50 * 1024 * 1024, description="50 MB hard cap")
    max_video_bytes: int = Field(default=250 * 1024 * 1024, description="250 MB calibration-video cap")
    max_audio_duration_ms: int = Field(
        default=10 * 60 * 1000,
        description="Max decoded recording length (10 min) — rejects long audio before Whisper cost is incurred.",
    )

    # ── Supabase ──────────────────────────────────────────────────────────────
    # SUPABASE_URL          : from Supabase Dashboard → Settings → API
    # SUPABASE_ANON_KEY     : public anon key (safe to use on frontend too)
    # SUPABASE_SERVICE_ROLE_KEY : admin key — backend only, never expose to frontend
    supabase_url:              str = ""
    supabase_anon_key:         str = ""
    supabase_service_role_key: str = ""


import logging
import os

logger = logging.getLogger(__name__)

@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings singleton. Use as a FastAPI dependency."""
    settings = Settings()
    # MISTRAL_API_KEY may hold a single key or multiple comma-separated keys —
    # every consumer (llm_coach, topic_generator, coaching_memory) splits and
    # rotates through them, mirroring the Groq client behavior.
    n_mistral_keys = len([k for k in settings.mistral_api_key.split(",") if k.strip()])
    n_groq_keys = len([
        k for k in (
            os.getenv("GROQ_API_KEYS", "")
            or os.getenv("GROQ_API_KEY", "")
        ).split(",") if k.strip()
    ])
    logger.info("🔑 API keys loaded — Groq: %d, Mistral: %d", n_groq_keys, n_mistral_keys)
    if n_mistral_keys == 0:
        logger.warning(
            "MISTRAL_API_KEY not set — LLM coaching will fall back to the "
            "Groq coaching model."
        )
    return settings

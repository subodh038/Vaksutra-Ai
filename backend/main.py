"""
Vocalyze AI — FastAPI entry point.

Registers middleware and routers only. No business logic here.

Routing
-------
  POST /analyze               → api/routes/analysis.py
  POST /auth/signup           → api/routes/auth.py
  POST /auth/login            → api/routes/auth.py
  GET  /auth/me               → api/routes/auth.py
  GET  /topics/generate       → api/routes/topics.py
  GET  /sessions              → api/routes/history.py
  GET  /sessions/{id}         → api/routes/history.py
  GET  /profile               → api/routes/history.py
  POST /uploads/video/upload-url   → api/routes/uploads.py
  GET  /uploads/video/view-url     → api/routes/uploads.py
  GET  /                      → health check
"""

from contextlib import asynccontextmanager
import logging
import time

import numpy as np
import librosa
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from api.limiter import limiter
from config import get_settings
from logging_config import setup_logging
from api.routes.analysis import router as analysis_router
from api.routes.auth import router as auth_router
from api.routes.history import router as history_router, profile_router
from api.routes.topics import router as topics_router
from api.routes.uploads import router as uploads_router
from api.routes.feedback import router as feedback_router
from core.acoustic.waveform_analyzer import PITCH_ANALYSIS_SAMPLE_RATE

settings = get_settings()
logger = logging.getLogger("main")

# ── Rate Limiter ───────────────────────────────────────────────────────────────
# Key per client IP. Limits enforced per-route via @limiter.limit() decorator.


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Runs once at startup, then yields, then runs at shutdown."""
    setup_logging()   # initialise file + console logging before first request

    from core.acoustic.waveform_analyzer import _RUST_AVAILABLE
    if _RUST_AVAILABLE:
        logger.info("▶ Rust extension active — skipping numba JIT warmup")
    else:
        # numba (used internally by librosa.yin) JIT-compiles its accelerated
        # functions on first call — that compilation itself takes several seconds.
        # Without this warmup, the first request pays the cost. Skip if Rust handles pitch.
        logger.info("▶ Warming up numba JIT (librosa.yin) ...")
        t0 = time.perf_counter()
        dummy = np.random.randn(PITCH_ANALYSIS_SAMPLE_RATE).astype(np.float32)  # 1s of noise
        librosa.yin(
            dummy, fmin=50, fmax=500, sr=PITCH_ANALYSIS_SAMPLE_RATE,
            frame_length=2048, hop_length=2048,
        )
        logger.info("✓ numba JIT warmup complete  %.3fs", time.perf_counter() - t0)

    yield
    # shutdown cleanup goes here if needed later

app = FastAPI(
    title="Vocalyze AI Backend",
    description=(
        "Multi-mode AI coaching platform. "
        "Supports impromptu speaking, presentations (Feynman technique), "
        "and interview prep. More modes coming soon."
    ),
    version="0.2.0",
    lifespan=lifespan,
)

from fastapi.responses import JSONResponse

async def cors_rate_limit_handler(request: Request, exc: RateLimitExceeded):
    response = _rate_limit_exceeded_handler(request, exc)
    # Only echo the Origin when it is on the allowlist — reflecting an
    # arbitrary origin together with credentials would be a data-exposure
    # pattern (the main CORSMiddleware does exactly this correctly; this
    # handler exists only because the 429 bypasses it).
    allowed = {o.strip() for o in get_settings().cors_origins.split(",") if o.strip()}
    origin = request.headers.get("origin", "")
    if origin in allowed:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    else:
        response.headers.pop("Access-Control-Allow-Origin", None)
        response.headers.pop("Access-Control-Allow-Credentials", None)
    return response

# Attach rate limiter state and 429 error handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, cors_rate_limit_handler)


# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=    ["*"],
    allow_headers=    ["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(topics_router)
app.include_router(analysis_router)
app.include_router(history_router)
app.include_router(profile_router)
app.include_router(uploads_router)
app.include_router(feedback_router)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/", tags=["health"])
async def health_check() -> dict:
    """Liveness probe."""
    return {
        "status":  "ok",
        "service": "Vocalyze AI Backend",
        "version": app.version,
    }


# ── Cron ──────────────────────────────────────────────────────────────────────
@app.get("/cron", tags=["cron"])
@app.head("/cron", tags=["cron"])
async def cron_keepalive() -> dict:
    """Keep-alive endpoint for external cron services (e.g., Render, Vercel, UptimeRobot)."""
    return {
        "status": "awake",
        "service": "Vocalyze AI Backend Cron",
    }

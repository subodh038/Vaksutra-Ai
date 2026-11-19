"""
logging_config.py — Logging setup for the Vocalyze AI Backend.

Call setup_logging() once at startup (in main.py lifespan).

Output
------
  logs/vocalyze.log          : APPENDS across restarts (mode=a)
                               — each session is separated by a banner line
  Terminal (stderr)          : INFO+ only

Log format
----------
  2026-08-05 00:15:32 | INFO     | core.pipeline | Stage 3/5 — Acoustic  1.23s
"""

from __future__ import annotations

import logging
import logging.handlers
from datetime import datetime
from pathlib import Path


def setup_logging(log_level: str = "INFO") -> None:
    """
    Configure root logger with a file handler + console handler.

    Parameters
    ----------
    log_level : Minimum level written to the log FILE (default INFO).
                The console always shows INFO+ regardless.
    """
    logs_dir = Path("logs")
    logs_dir.mkdir(exist_ok=True)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # ── File Handler (Append, Newest at bottom) ──────────────────────────────
    log_path = logs_dir / "vocalyze.log"
    file_handler = logging.FileHandler(log_path, mode='a', encoding='utf-8')
    file_handler.setFormatter(formatter)
    file_handler.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    # ── Console — INFO+ ───────────────────────────────────────────────────────
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.setLevel(logging.INFO)

    # ── Root logger ───────────────────────────────────────────────────────────
    root = logging.getLogger()
    root.setLevel(logging.DEBUG)
    root.addHandler(file_handler)
    root.addHandler(console_handler)

    # ── Write a session separator so restarts are visible in the file ─────────
    sep = f"\n{'='*80}\n  SERVER START — {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n{'='*80}"
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(sep + "\n")

    # ── Silence truly noisy third-party loggers ───────────────────────────────
    for noisy in (
        "numba",
        "numba.core",
        "numba.core.byteflow",
        "numba.core.interpreter",
        "numba.core.ssa",
        "numba.core.dataflow",
        # audio stack
        "librosa",
        "audioread",
        "soundfile",
        # misc
        "watchfiles",
        "PIL",
        "matplotlib",
        "multipart",
        "httpcore",
        "httpx",  # Silenced to prevent Supabase/LLM HTTP spam
    ):
        logging.getLogger(noisy).setLevel(logging.WARNING)

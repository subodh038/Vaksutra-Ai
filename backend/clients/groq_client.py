"""
clients/groq_client.py — Groq SDK wrapper used by the Vocalyze AI Backend.

Provides:
  get_groq_api_keys()   : collects all GROQ_API_KEY* vars from the environment.
  get_groq_client(key)  : returns a cached AsyncGroq client for a given key —
                          reused across every request instead of building a new
                          one (and its own connection pool) per call. Shared by
                          transcribe_audio() here and core/linguistic/linguistics.py.
  transcribe_audio()    : sends a WebM blob to Groq Whisper (whisper-large-v3).
                          Rotates through available API keys on rate-limit errors.
"""

import logging
import os
import re
from typing import Any, Dict, List

from dotenv import load_dotenv
from groq import AsyncGroq

logger = logging.getLogger(__name__)

# ── Hallucination-loop guard ──────────────────────────────────────────────────
# Whisper occasionally loops filler syllables endlessly on trailing silence
# ("uh, uh, uh, uh …"). Detect a long tail run of pure fillers and strip it.
_LOOP_FILLERS = {"um", "uh", "ah", "er", "erm", "hmm", "mhm", "mm-hmm", "eh"}
_MIN_LOOP_RUN = 6  # fewer than this is legitimate hesitation


def _strip_trailing_filler_loop(
    text: str, words: List[Dict[str, Any]]
) -> tuple:
    """Trim a trailing run of pure filler tokens from text + word list."""
    if not words:
        return text, words

    def _base(w: Dict[str, Any]) -> str:
        return re.sub(r"[^\w'-]", "", str(w.get("word", ""))).lower()

    run: List[int] = []
    for i in range(len(words) - 1, -1, -1):
        if _base(words[i]) in _LOOP_FILLERS:
            run.append(i)
        else:
            break

    if len(run) < _MIN_LOOP_RUN:
        return text, words

    bases = {_base(words[i]) for i in run}
    if len(bases) != 1:
        return text, words  # mixed fillers — likely real speech rhythm

    loop_filler = bases.pop()
    cut_idx = min(run)
    dropped = len(run)
    trimmed_words = words[:cut_idx]

    # Remove the matching repeated suffix from the raw text as well.
    pattern = re.compile(
        rf"(?:\b{re.escape(loop_filler)}\b[^a-z0-9]*){{{dropped},}}\s*$",
        re.IGNORECASE,
    )
    new_text = pattern.sub("", text).rstrip(" ,.!?-")

    logger.warning(
        "Whisper hallucination loop detected and stripped: %dx '%s' "
        "(words %d -> %d).",
        dropped, loop_filler, len(words), len(trimmed_words),
    )
    return new_text, trimmed_words

# Load environment variables from .env
load_dotenv()

# One AsyncGroq client per API key, built lazily and reused for the lifetime of
# the process. Each AsyncGroq instance owns its own httpx connection pool —
# building a fresh one per request means paying a new TCP/TLS handshake on every
# single call instead of reusing keep-alive connections. Keyed by the raw API
# key string so both this module and linguistics.py share the same pool per key.
_client_cache: dict[str, AsyncGroq] = {}


def get_groq_client(api_key: str) -> AsyncGroq:
    """Return a cached AsyncGroq client for this key, creating it on first use."""
    client = _client_cache.get(api_key)
    if client is None:
        # max_retries=0 because we manually rotate keys on failure instantly.
        # timeout=15.0 ensures the UI doesn't hang indefinitely on a dead key.
        client = AsyncGroq(api_key=api_key, max_retries=0, timeout=15.0)
        _client_cache[api_key] = client
    return client


# ── Key collection ───────────────────────────────────────────────────────────────────────

def get_groq_api_keys() -> List[str]:
    """Collects all available Groq API keys from the environment."""
    keys = []
    
    # 1. Check for a comma-separated list (e.g. GROQ_API_KEYS=key1,key2)
    keys_str = os.environ.get("GROQ_API_KEYS", "")
    if keys_str:
        keys.extend([k.strip() for k in keys_str.split(",") if k.strip()])
        
    # 2. Check for individual variables like GROQ_API_KEY, GROQ_API_KEY_1, GROQ_API_KEY_2
    for k, v in os.environ.items():
        if k.startswith("GROQ_API_KEY") and k != "GROQ_API_KEYS":
            val = v.strip()
            if val and val not in keys:
                if "," in val:
                    logger.error(
                        "❌ CONFIGURATION ERROR: You placed multiple comma-separated keys inside a singular variable '%s'. "
                        "This will cause authentication to fail! Please rename the variable to 'GROQ_API_KEYS' on your server.",
                        k
                    )
                keys.append(val)
                
    return keys


import threading

# ── Round-robin counter ───────────────────────────────────────────────────────
# Distributes load evenly across all API keys from the very first request.
# Uses a lock-free atomic increment (threading.Lock is overkill; GIL protects
# the int read+increment on CPython, but we use a lock for correctness across
# all Python implementations).
_rr_lock  = threading.Lock()
_rr_index = 0


def _next_key_index(num_keys: int) -> int:
    """Return the next round-robin index, thread-safe."""
    global _rr_index
    with _rr_lock:
        idx = _rr_index % num_keys
        _rr_index += 1
    return idx


# ── Transcription ──────────────────────────────────────────────────────────────────────

async def transcribe_audio(audio_bytes: bytes, filename: str) -> Dict[str, Any]:
    """
    Transcribes WebM audio using Groq's whisper-large-v3 model.

    Key selection strategy:
      1. Round-robin: each request picks a different key in rotation so all
         keys are used evenly and the per-key rate limit is spread across the
         pool (4 keys = ~4x effective rate limit).
      2. Fallback: if the chosen key fails (rate limit / transient error), the
         remaining keys are tried in order before giving up.
    """
    api_keys = get_groq_api_keys()
    if not api_keys:
        raise RuntimeError(
            "No GROQ API keys found in the environment. Please add them to the .env file."
        )

    num_keys   = len(api_keys)
    start_idx  = _next_key_index(num_keys)

    # Build a rotation starting from the round-robin position
    rotation = [api_keys[(start_idx + i) % num_keys] for i in range(num_keys)]

    last_error = None
    for attempt, key in enumerate(rotation):
        try:
            client = get_groq_client(key)
            if attempt > 0:
                logger.info(
                    "Whisper: retrying with key %d/%d after previous failure",
                    attempt + 1, num_keys,
                )
            transcription = await client.audio.transcriptions.create(
                file=(filename, audio_bytes),
                model="whisper-large-v3",
                language="en",  # English focus for now — revisit when i18n is planned
                prompt="Umm, uh, ah, hmm, like, basically, actually, so, yeah, you know, let me think, okay.",
                response_format="verbose_json",
                timestamp_granularities=["word"],
                temperature=0.0,
            )

            raw_text = (
                transcription.get("text", "")
                if isinstance(transcription, dict)
                else getattr(transcription, "text", "")
            )
            raw_words = [
                {
                    "word":  w.get("word",  "") if isinstance(w, dict) else getattr(w, "word",  ""),
                    "start": w.get("start", 0.0) if isinstance(w, dict) else getattr(w, "start", 0.0),
                    "end":   w.get("end",   0.0) if isinstance(w, dict) else getattr(w, "end",   0.0),
                }
                for w in (
                    transcription.get("words", [])
                    if isinstance(transcription, dict)
                    else getattr(transcription, "words", [])
                )
            ]

            # Guard against filler-loop hallucinations on trailing silence.
            clean_text, clean_words = _strip_trailing_filler_loop(raw_text, raw_words)
            return {"text": clean_text, "words": clean_words}

        except Exception as exc:
            err_msg = str(exc).lower()
            hint = ""
            if "401" in err_msg or "unauthorized" in err_msg:
                hint = " (HINT: Invalid GROQ API key format or unauthorized key)"
            elif "429" in err_msg or "rate limit" in err_msg:
                hint = " (HINT: Hit Groq API rate limit)"
            logger.warning(
                "Whisper key %d/%d failed%s: %s",
                (start_idx + attempt) % num_keys + 1, num_keys, hint, exc,
            )
            last_error = exc

    # Layering: this module must not raise HTTP exceptions — the pipeline
    # catches any Exception here and degrades gracefully.
    raise RuntimeError(
        f"All {num_keys} Groq API keys failed for Whisper. Last error: {last_error}"
    )

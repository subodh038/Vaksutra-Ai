"""
services/topic_generator.py — LLM-powered topic generation for impromptu speaking.

Generates a unique, non-repeating speaking topic for the user by:
  1. Fetching the last N topics given to this user (to avoid repetition).
  2. Fetching the user's coaching profile (soul) if available.
  3. Calling llama-3.1-8b-instant (fast + cheap) with anti-repetition +
     personalisation context.
  4. Saving the generated topic to topic_history for future anti-repetition.

Public API
----------
  generate_topic(user_id, mode) -> str
"""

import logging
import os
import re
from typing import List, Optional

import httpx

from clients.groq_client import get_groq_api_keys
from db.client import get_admin_db
from db.repositories.profiles import get_profile

logger = logging.getLogger(__name__)

# How many recent topics to exclude from the next generation
HISTORY_WINDOW = 5

# Primary model: mistral-small-latest — 24B class, excellent instruction following and JSON compliance.
# Extremely fast for frontend topic generation (usually < 2 seconds).
TOPIC_MODEL = "mistral-small-latest"

# Fallback model: openai/gpt-oss-20b (Reasoning OSS model)
# Will use the official Groq SDK for fallback without max_tokens.
GROQ_FALLBACK_MODEL = "openai/gpt-oss-20b"


def get_mistral_api_keys() -> list:
    """Return list of Mistral API keys from env."""
    raw = os.environ.get("MISTRAL_API_KEY", "")
    return [k.strip() for k in raw.split(",") if k.strip()]

# Topic categories to draw from — gives diversity to the LLM
TOPIC_CATEGORIES = [
    "leadership and decision-making",
    "technology and society",
    "personal growth and resilience",
    "business and entrepreneurship",
    "ethics and values",
    "education and learning",
    "creativity and innovation",
    "communication and relationships",
    "health and well-being",
    "future and change",
    "culture and identity",
    "environment and sustainability",
]


async def _get_recent_topics(user_id: str, mode: str, limit: int) -> List[str]:
    """Return the last N topics generated for this user in this mode."""
    db = await get_admin_db()
    result = (
        await db.table("topic_history")
        .select("topic")
        .eq("user_id", user_id)
        .eq("mode", mode)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return [row["topic"] for row in (result.data or [])]


async def _save_topic(user_id: str, mode: str, topic: str) -> None:
    """Persist the generated topic so it won't be repeated in future sessions."""
    db = await get_admin_db()
    await db.table("topic_history").insert({
        "user_id": user_id,
        "mode":    mode,
        "topic":   topic,
    }).execute()


async def generate_topic(user_id: str, mode: str = "impromptu") -> str:
    """
    Generate a unique speaking topic for the user.

    Steps:
      1. Load last HISTORY_WINDOW topics (anti-repetition).
      2. Load coaching soul (personalisation).
      3. Call LLM to produce one topic.
      4. Save LLM topics to topic_history (static fallbacks are NOT saved —
         they'd pollute anti-repetition with canned lines).
      5. Return the topic string. Falls back to a safe default if the LLM fails.
    """
    import time
    t_start = time.perf_counter()

    # ── 1. Anti-repetition context ────────────────────────────────────────────
    logger.info(f"[TOPIC GEN] ┌ START user={user_id[:8]} mode={mode}")
    t1 = time.perf_counter()
    recent_topics = await _get_recent_topics(user_id, mode, HISTORY_WINDOW)
    logger.info(f"[TOPIC GEN] │ Stage 1 — recent topics loaded ({len(recent_topics)} found) in {(time.perf_counter()-t1)*1000:.0f}ms: {recent_topics}")

    # ── 2. Soul / personalisation context ─────────────────────────────────────
    t2 = time.perf_counter()
    soul_context = ""
    try:
        profile = await get_profile(user_id)
        if profile and (profile.get("session_count") or 0) >= 1:
            weak    = profile.get("recurring_weaknesses") or []
            strong  = profile.get("recurring_strengths") or []
            summary = profile.get("coaching_summary") or ""

            # ── New: USER_CORE psychological profile ──────────────────────
            user_core    = profile.get("user_core") or {}
            skill_memory = profile.get("skill_memory") or {}

            fear_profile = user_core.get("fear_profile", {})
            stance       = user_core.get("coaching_stance", {})
            growth       = user_core.get("growth_trajectory", {})

            parts = []
            if weak:
                parts.append(f"recurring weaknesses: {', '.join(weak)}")
            if strong:
                parts.append(f"recurring strengths: {', '.join(strong)}")
            if summary:
                parts.append(f"coach notes: {summary[:200]}")

            # Add USER_CORE context if available
            if fear_profile.get("triggers"):
                parts.append(f"fear triggers (topics that cause speaking breakdown): {', '.join(fear_profile['triggers'])}")
            if fear_profile.get("confidence_zones"):
                parts.append(f"confidence zones (topics where they excel): {', '.join(fear_profile['confidence_zones'])}")
            if stance.get("priority_focus"):
                parts.append(f"coach priority focus areas: {', '.join(stance['priority_focus'])}")
            if growth.get("stagnating_area"):
                parts.append(f"stagnating skill (not improving): {growth['stagnating_area']}")
            if skill_memory.get("scenario_comprehension"):
                parts.append(f"scenario comprehension pattern: {skill_memory['scenario_comprehension']}")

            if parts:
                soul_context = "\n".join(parts)
    except Exception as exc:
        logger.warning("Could not load soul for topic generation: %s", exc)
    logger.info(f"[TOPIC GEN] │ Stage 2 — soul context loaded in {(time.perf_counter()-t2)*1000:.0f}ms. has_soul={'yes' if soul_context else 'no'}")


    # ── 3. Build prompt ───────────────────────────────────────────────────────
    avoid_block = ""
    if recent_topics:
        avoid_block = (
            "\n\nDo NOT generate any of these topics — they were recently given to this user:\n"
            + "\n".join(f"- {t}" for t in recent_topics)
        )

    personalize_block = ""
    if soul_context:
        personalize_block = (
            "\n\nAbout this speaker (use to personalise difficulty/type, do not mention in the topic):\n"
            + soul_context
        )

    import random
    category = random.choice(TOPIC_CATEGORIES)

    prompt = f"""You are generating a single impromptu speaking prompt for a public speaking practice app.

Mode: {mode}
Category hint: {category}{avoid_block}{personalize_block}

Requirements:
- ONE topic only — no list, no numbering, no options.
- EXTREME BREVITY: The topic MUST be a SINGLE SENTENCE of NO MORE THAN 15 WORDS.
- GENERAL & ACCESSIBLE: The topic must be understandable and approachable by ANY user.
- DISTINCT CONCEPTS: Do NOT repeat the concepts, themes, or "angles" of the avoided topics above.
- Output ONLY a valid JSON object with a single key "topic".

Example:
{{
  "topic": "What is the most important invention of the 21st century?"
}}"""

    logger.info(f"[TOPIC GEN] │ Stage 3 — prompt built. category='{category}' avoid_count={len(recent_topics)}")
    logger.debug(f"[TOPIC GEN] │ Full prompt sent to LLM:\n{prompt}")

    # ── 4. LLM call ───────────────────────────────────────────────────────────
    t4 = time.perf_counter()
    topic: Optional[str] = None
    import json

    # PRIMARY: Mistral
    mistral_keys = get_mistral_api_keys()
    if mistral_keys:
        async with httpx.AsyncClient(base_url="https://api.mistral.ai", timeout=30.0) as mhttp:
            for midx, mkey in enumerate(mistral_keys):
                try:
                    t_mistral = time.perf_counter()
                    logger.info(f"[TOPIC GEN] │ Stage 4 — calling Mistral key #{midx+1} model={TOPIC_MODEL}")
                    mresp = await mhttp.post(
                        "/v1/chat/completions",
                        headers={"Authorization": f"Bearer {mkey}", "Content-Type": "application/json"},
                        json={
                            "model": TOPIC_MODEL,
                            "messages": [{"role": "user", "content": prompt}],
                            "temperature": 0.9,
                            "response_format": {"type": "json_object"},
                        },
                    )
                    mresp.raise_for_status()
                    mraw = mresp.json()["choices"][0]["message"]["content"].strip()
                    mistral_ms = (time.perf_counter() - t_mistral) * 1000
                    logger.info(f"[TOPIC GEN] │ Mistral responded in {mistral_ms:.0f}ms")
                    try:
                        parsed = json.loads(mraw)
                        candidate = _clean_topic(str(parsed.get("topic", "")))
                        if _is_valid_topic(candidate):
                            topic = candidate
                            break
                        logger.warning("[TOPIC GEN] Mistral topic failed sanity gate: %r", candidate[:120])
                    except json.JSONDecodeError:
                        logger.warning(f"[TOPIC GEN] Failed to parse JSON from Mistral: {mraw}")
                except Exception as exc:
                    logger.error(f"[TOPIC GEN] ✗ Mistral call failed for key #{midx+1} — Error: {exc}")
    else:
        logger.warning("[TOPIC GEN] No Mistral keys — skipping primary Mistral call")

    # FALLBACK: Groq
    if not topic:
        keys = get_groq_api_keys()
        if keys:
            logger.warning("[TOPIC GEN] │ Primary Mistral failed — trying Groq fallback...")
            from groq import AsyncGroq
            for idx, key in enumerate(keys):
                try:
                    t_llm = time.perf_counter()
                    client = AsyncGroq(api_key=key)
                    completion = await client.chat.completions.create(
                        model=GROQ_FALLBACK_MODEL,
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.9,
                        response_format={"type": "json_object"}
                    )
                    
                    raw = completion.choices[0].message.content
                    if not raw:
                        logger.warning(f"[TOPIC GEN] ✗ Groq fallback key #{idx+1} returned empty content")
                        continue
                        
                    raw = raw.strip()
                    llm_ms = (time.perf_counter() - t_llm) * 1000
                    logger.info(f"[TOPIC GEN] │ Groq fallback responded in {llm_ms:.0f}ms")
                    
                    # Compound/OSS reasoning models sometimes return reasoning + JSON. Extract JSON using regex if needed.
                    import re
                    json_match = re.search(r'\{.*\}', raw, re.DOTALL)
                    if json_match:
                        raw = json_match.group(0)

                    try:
                        parsed = json.loads(raw)
                        candidate = _clean_topic(str(parsed.get("topic", "")))
                        if _is_valid_topic(candidate):
                            topic = candidate
                            logger.info(f"[TOPIC GEN] │ Stage 4 complete — GROQ FALLBACK topic: \"{topic}\"")
                            break
                        logger.warning("[TOPIC GEN] Groq topic failed sanity gate: %r", candidate[:120])
                    except json.JSONDecodeError:
                        logger.warning(f"[TOPIC GEN] Failed to parse JSON from Groq: {raw}")
                except Exception as exc:
                    logger.error(f"[TOPIC GEN] ✗ Groq fallback key #{idx+1} failed — Error: {exc}")
        else:
            logger.warning("[TOPIC GEN] No Groq keys configured — skipping Groq fallback")

    if not topic:
        topic = _fallback_topic()
        used_fallback = True
        logger.warning(f"[TOPIC GEN] │ All LLM providers failed. Serving STATIC FALLBACK: \"{topic}\"")
    else:
        used_fallback = False
        logger.info(f"[TOPIC GEN] │ Stage 4 complete — CUSTOM LLM topic: \"{topic}\"")
    # ── 5. Save + return ──────────────────────────────────────────────────────
    t5 = time.perf_counter()
    if not used_fallback:
        # Only persist genuine LLM topics — canned fallbacks would poison the
        # anti-repetition window and crowd out fresh generations.
        try:
            await _save_topic(user_id, mode, topic)
            logger.info(f"[TOPIC GEN] │ Stage 5 — topic saved to history in {(time.perf_counter()-t5)*1000:.0f}ms")
        except Exception as exc:
            logger.warning("Could not save topic to history: %s", exc)
    else:
        logger.info("[TOPIC GEN] │ Stage 5 — fallback topic NOT saved to history")

    total_ms = (time.perf_counter() - t_start) * 1000
    logger.info(f"[TOPIC GEN] └ DONE in {total_ms:.0f}ms — returning: \"{topic}\"")
    return topic


def _fallback_topic() -> str:
    """Static fallback if LLM is unavailable."""
    import random
    fallbacks = [
        "Describe your favorite hobby or activity and explain why it is important to you.",
        "If you could travel anywhere in the world tomorrow, where would you go and why?",
        "Talk about a person who has had a positive impact on your life and what you learned from them.",
        "What is your favorite book or movie, and what makes it so special to you?",
        "Describe a memorable experience from your past that still makes you smile.",
    ]
    return random.choice(fallbacks)


def _clean_topic(t: str) -> str:
    """Strip surrounding ASCII and Unicode quotes from LLM output."""
    t = t.strip()
    while t and t[0] in ('"', "'", '“', '”', '‘', '’', '«', '»') and t[-1] in ('"', "'", '“', '”', '‘', '’', '«', '»') and len(t) > 1:
        t = t[1:-1].strip()
    return t


def _is_valid_topic(topic: str) -> bool:
    """Sanity gate: one short sentence, no multi-line dumps from the LLM."""
    clean = _clean_topic(topic)
    return bool(clean) and 10 <= len(clean) <= 200 and "\n" not in clean

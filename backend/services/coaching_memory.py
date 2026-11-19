"""
services/coaching_memory.py — The "Soul" of the AI coach.
Implements a Hermes-style lifecycle hook architecture.

Lifecycle hooks:
  prefetch_memory(user_id)
      Fetch the user's coaching profile (USER_CORE + SKILL_MEMORY + stats)
      and format it as a structured system prompt block to inject before
      the LLM coaching call. Returns "" if user has < MEMORY_THRESHOLD sessions.

  on_session_end(user_id, session_data, coaching_report)
      Called as a background task after each session. Runs two separate
      dedicated LLM calls:
        Call 4 → _update_skill_memory()  (technical data analyst prompt)
        Call 5 → _update_user_core()     (psychological coach prompt)

Logging:
  Every LLM call logs:
    - Full prompt sent
    - Raw response received
    - Tokens: prompt_tokens / completion_tokens / total_tokens
    - Latency in ms
    - Model used
"""

import asyncio
import json
import logging
import os
import re
import time
from typing import Any, Dict, List, Optional

import httpx

from clients.groq_client import get_groq_api_keys
from db.repositories import profiles as profile_repo

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────────
MEMORY_THRESHOLD = 3        # Sessions before memory activates
PRIMARY_MEMORY_MODEL  = "mistral-small-latest"   # Primary — large context, handles detailed prompts
FALLBACK_MEMORY_MODEL = "groq/compound"           # Fallback — only if Mistral exhausted


# ── LLM Helper ───────────────────────────────────────────────────────────────

async def _call_memory_llm(
    prompt: str,
    call_name: str,
    expect_json: bool = True,
) -> Optional[str]:
    """
    Single reusable LLM caller for all background memory calls.
    Tries Mistral first, falls back to Groq compound.
    Logs full prompt, response, tokens (prompt/completion/total), latency, model.
    Returns raw string content or None on total failure.
    """
    t_start = time.perf_counter()

    logger.info(
        "╔══ [%s] LLM CALL START ══════════════════════════════════════════",
        call_name,
    )
    logger.info("[%s] MODEL (primary): %s", call_name, PRIMARY_MEMORY_MODEL)
    logger.debug("[%s] PROMPT SENT:\n%s", call_name, prompt)

    raw: Optional[str] = None

    # ── Primary: Mistral (large context, handles detailed memory prompts) ─
    raw_mistral_key = os.environ.get("MISTRAL_API_KEY", "")
    mistral_keys = [k.strip() for k in raw_mistral_key.split(",") if k.strip()]
    if mistral_keys:
        async with httpx.AsyncClient(base_url="https://api.mistral.ai", timeout=45.0) as mhttp:
            for midx, mkey in enumerate(mistral_keys):
                try:
                    mresp = await mhttp.post(
                        "/v1/chat/completions",
                        headers={"Authorization": f"Bearer {mkey}", "Content-Type": "application/json"},
                        json={
                            "model": PRIMARY_MEMORY_MODEL,
                            "messages": [{"role": "user", "content": prompt}],
                            "temperature": 0.3,
                            **({"response_format": {"type": "json_object"}} if expect_json else {}),
                        },
                    )
                    mresp.raise_for_status()
                    latency_ms = (time.perf_counter() - t_start) * 1000
                    mdata = mresp.json()
                    raw = mdata["choices"][0]["message"]["content"].strip()
                    usage = mdata.get("usage", {})
                    logger.info(
                        "[%s] Mistral key #%d SUCCESS | latency=%.0fms | "
                        "prompt_tokens=%s | completion_tokens=%s | total_tokens=%s",
                        call_name, midx + 1, latency_ms,
                        usage.get("prompt_tokens", "?"),
                        usage.get("completion_tokens", "?"),
                        usage.get("total_tokens", "?"),
                    )
                    logger.debug("[%s] RAW RESPONSE:\n%s", call_name, raw)
                    break
                except Exception as mexc:
                    logger.warning("[%s] Mistral key #%d FAILED: %s", call_name, midx + 1, mexc)
    else:
        logger.warning("[%s] No Mistral keys configured — skipping primary", call_name)

    # ── Fallback: Groq compound ───────────────────────────────────────────
    if raw is None:
        logger.warning("[%s] All Mistral keys failed — trying Groq fallback", call_name)
        keys = get_groq_api_keys()
        if keys:
            async with httpx.AsyncClient(base_url="https://api.groq.com", timeout=45.0) as http:
                for idx, key in enumerate(keys):
                    try:
                        resp = await http.post(
                            "/openai/v1/chat/completions",
                            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                            json={
                                "model": FALLBACK_MEMORY_MODEL,
                                "messages": [{"role": "user", "content": prompt}],
                                "temperature": 0.3,
                                **({"response_format": {"type": "json_object"}} if expect_json else {}),
                            },
                        )
                        resp.raise_for_status()
                        latency_ms = (time.perf_counter() - t_start) * 1000
                        data = resp.json()
                        raw = data["choices"][0]["message"]["content"].strip()
                        usage = data.get("usage", {})
                        logger.info(
                            "[%s] Groq key #%d SUCCESS | latency=%.0fms | "
                            "prompt_tokens=%s | completion_tokens=%s | total_tokens=%s",
                            call_name, idx + 1, latency_ms,
                            usage.get("prompt_tokens", "?"),
                            usage.get("completion_tokens", "?"),
                            usage.get("total_tokens", "?"),
                        )
                        logger.debug("[%s] RAW RESPONSE:\n%s", call_name, raw)
                        break
                    except Exception as exc:
                        logger.warning("[%s] Groq key #%d FAILED: %s", call_name, idx + 1, exc)
        else:
            logger.warning("[%s] No Groq keys — fallback skipped", call_name)

    total_latency_ms = (time.perf_counter() - t_start) * 1000
    if raw is None:
        logger.error(
            "╚══ [%s] LLM CALL FAILED — all providers exhausted | total_latency=%.0fms ══",
            call_name, total_latency_ms,
        )
    else:
        logger.info(
            "╚══ [%s] LLM CALL COMPLETE | total_latency=%.0fms ══════════════════",
            call_name, total_latency_ms,
        )

    return raw


# ── Public API ────────────────────────────────────────────────────────────────

async def prefetch_memory(user_id: str, return_profile: bool = False):
    """
    [Lifecycle Hook: prefetch]
    Return a structured memory block to inject into the LLM system prompt.
    Returns "" if the user has fewer than MEMORY_THRESHOLD sessions.
    Injects: stats, SKILL_MEMORY, and USER_CORE psychological profile.

    When return_profile=True, returns (memory_string, profile_dict) tuple
    so the caller can compute session-over-session deltas.
    """
    profile = await profile_repo.get_profile(user_id)
    if profile is None or (profile.get("session_count") or 0) < MEMORY_THRESHOLD:
        return ("", None) if return_profile else ""

    count   = profile.get("session_count", 0)
    avg     = profile.get("avg_score", 0)
    best    = profile.get("best_score", 0)
    last    = profile.get("last_score", 0)
    trend   = profile.get("score_trend", "stable")
    fillers = profile.get("top_filler_words") or []
    weak    = profile.get("recurring_weaknesses") or []
    strong  = profile.get("recurring_strengths") or []

    # New: structured memory blocks
    skill_memory: Dict = profile.get("skill_memory") or {}
    user_core: Dict    = profile.get("user_core") or {}

    trend_icon = {"improving": "↑", "declining": "↓", "stable": "→"}.get(trend, "→")
    scores = profile.get("scores", [])
    recent_scores = scores[-3:] if scores else []

    lines = [
        f"── COACH MEMORY ({count} sessions) ──────────────────────────────────",
        f"Score: avg={avg:.1f}  best={best:.1f}  last={last:.1f}  trend={trend_icon} {trend}",
    ]
    if recent_scores:
        lines.append(f"Recent Score History (Last {len(recent_scores)} sessions): {[round(s, 1) for s in recent_scores]}")
    if fillers:
        lines.append(f"Recurring fillers: {', '.join(fillers)}")
    if weak:
        lines.append(f"Recurring weaknesses: {', '.join(weak)}")
    if strong:
        lines.append(f"Recurring strengths: {', '.join(strong)}")

    # ── SKILL_MEMORY block ────────────────────────────────────────────────
    if skill_memory:
        lines.append("")
        lines.append("── SKILL MEMORY (technical patterns) ──")
        if skill_memory.get("pacing_pattern"):
            lines.append(f"  Pacing: {skill_memory['pacing_pattern']}")
        if skill_memory.get("verbal_tics"):
            lines.append(f"  Verbal tics: {', '.join(skill_memory['verbal_tics'])}")
        if skill_memory.get("argument_structure"):
            lines.append(f"  Argument structure: {skill_memory['argument_structure']}")
        if skill_memory.get("linguistic_confidence"):
            lines.append(f"  Linguistic confidence: {skill_memory['linguistic_confidence']}")
        if skill_memory.get("vocabulary_diversity"):
            lines.append(f"  Vocabulary: {skill_memory['vocabulary_diversity']}")
        if skill_memory.get("grammar_patterns"):
            lines.append(f"  Grammar issues: {skill_memory['grammar_patterns']}")
        if skill_memory.get("scenario_comprehension"):
            lines.append(f"  Scenario comprehension: {skill_memory['scenario_comprehension']}")
        if skill_memory.get("visual_presence"):
            lines.append(f"  Visual presence: {skill_memory['visual_presence']}")

    # ── USER_CORE block ───────────────────────────────────────────────────
    if user_core:
        lines.append("")
        lines.append("── USER CORE (psychological profile) ──")
        fear = user_core.get("fear_profile", {})
        if fear.get("primary_fear"):
            lines.append(f"  Primary fear: {fear['primary_fear']}")
        if fear.get("triggers"):
            lines.append(f"  Triggers: {', '.join(fear['triggers'])}")
        if fear.get("confidence_zones"):
            lines.append(f"  Confidence zones: {', '.join(fear['confidence_zones'])}")
        motivation = user_core.get("motivation_type", {})
        if motivation.get("type"):
            lines.append(f"  Motivation type: {motivation['type']}")
        if motivation.get("responds_best_to"):
            lines.append(f"  Responds best to: {motivation['responds_best_to']}")
        persona = user_core.get("communication_personality", {})
        if persona.get("style"):
            lines.append(f"  Communication style: {persona['style']}")
        growth = user_core.get("growth_trajectory", {})
        if growth.get("stagnating_area"):
            lines.append(f"  Stagnating area: {growth['stagnating_area']}")
        if growth.get("primary_improvement"):
            lines.append(f"  Primary improvement: {growth['primary_improvement']}")
        stance = user_core.get("coaching_stance", {})
        if stance.get("tone"):
            lines.append(f"  Coach tone for this user: {stance['tone']}")
        if stance.get("priority_focus"):
            lines.append(f"  Priority focus areas: {', '.join(stance['priority_focus'])}")

    lines.append("────────────────────────────────────────────────────────────")

    context = "\n".join(lines)
    logger.debug("prefetch_memory: injecting %d-session memory for user %s", count, user_id)
    return (context, profile) if return_profile else context


async def on_session_end(
    user_id: str,
    session_data: Dict[str, Any],
    coaching_report: Optional[Dict[str, Any]] = None,
) -> None:
    """
    [Lifecycle Hook: on_session_end]
    Called as a background task after each session completes.
    1. Updates aggregate stats (scores, fillers, weaknesses, strengths).
    2. If session_count >= MEMORY_THRESHOLD, fires two dedicated background LLM calls:
       Call 4: _update_skill_memory()  — technical data analyst
       Call 5: _update_user_core()     — psychological coach
    """
    score        = session_data.get("score", 0.0)
    fillers      = session_data.get("filler_words_found") or []
    weak_words   = session_data.get("weak_words_found") or []
    filler_ratio = session_data.get("filler_word_ratio", 0.0)
    # gaze_center_pct (0–100) is the reliable presence signal. The old
    # avg_eye_contact (0–1) is MediaPipe-capped at ~0.55-0.60 regardless of
    # quality, which mis-flagged almost every speaker as weak.
    gaze_center  = session_data.get("gaze_center_pct", 0.0)
    gaze_away    = session_data.get("gaze_away_count", 0)
    wpm          = session_data.get("wpm", 0.0)
    pitch_var    = session_data.get("pitch_variation", 0.0)
    pause_count  = session_data.get("pause_count", 0)
    # Observable facial tension: brow raise (AU1) + lip press (AU24)
    brow_tension = max(
        session_data.get("avg_brow_raise", 0.0),
        session_data.get("avg_stress", 0.0),
    )

    # ── Derive simple weakness / strength labels ──────────────────────────
    weaknesses: List[str] = []
    strengths:  List[str] = []

    if filler_ratio > 0.05:
        weaknesses.append("filler_words")
    if gaze_center < 40:
        weaknesses.append("eye_contact")
    elif gaze_center > 65:
        strengths.append("strong_eye_contact")
    if wpm > 180:
        weaknesses.append("speaking_too_fast")
    elif wpm < 100 and wpm > 0:
        weaknesses.append("speaking_too_slow")
    elif 120 <= wpm <= 160:
        strengths.append("good_pacing")
    if pitch_var < 10:
        weaknesses.append("monotone_delivery")
    elif pitch_var > 25:
        strengths.append("expressive_voice")
    if pause_count == 0:
        weaknesses.append("no_strategic_pauses")
    if brow_tension > 0.5:
        weaknesses.append("visible_anxiety")
    if gaze_away <= 2 and gaze_center > 60:
        strengths.append("confident_presence")

    # ── Update aggregate stats ────────────────────────────────────────────
    updated_profile = await profile_repo.increment_session(
        user_id=user_id,
        new_score=score,
        filler_words=fillers,
        weaknesses=weaknesses,
        strengths=strengths,
    )

    session_count = updated_profile.get("session_count", 0)
    logger.info(
        "on_session_end: stats updated for user=%s session=%d score=%.1f",
        user_id, session_count, score,
    )

    # ── Fire background memory LLM calls if threshold reached ─────────────
    if session_count >= MEMORY_THRESHOLD:
        await asyncio.gather(
            _update_skill_memory(user_id, updated_profile, session_data, coaching_report),
            _update_user_core(user_id, updated_profile, session_data, coaching_report),
        )


# ── Private LLM Memory Updaters ───────────────────────────────────────────────

def _extract_json_object(raw: str) -> dict:
    """
    Extract and parse the first valid JSON object from LLM output,
    robustly ignoring preambles, reasoning traces, or markdown fences.
    """
    text = raw.strip()
    fence_match = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", text)
    if fence_match:
        return json.loads(fence_match.group(1))

    brace_match = re.search(r"(\{[\s\S]*\})", text)
    if brace_match:
        return json.loads(brace_match.group(1))

    return json.loads(text)


async def _update_skill_memory(
    user_id: str,
    profile: Dict[str, Any],
    session_data: Dict[str, Any],
    coaching_report: Optional[Dict[str, Any]],
) -> None:
    """
    [Call 4] Technical Data Analyst LLM.
    Reads RawSignals metrics + CoachingReport to synthesize SKILL_MEMORY JSON.
    """
    existing_skill = profile.get("skill_memory") or {}
    session_count  = profile.get("session_count", 0)
    wpm            = session_data.get("wpm", 0)
    filler_ratio   = session_data.get("filler_word_ratio", 0)
    fillers        = session_data.get("filler_words_found") or []
    pitch_var      = session_data.get("pitch_variation", 0)
    gaze_center    = session_data.get("gaze_center_pct", 0)
    pause_count    = session_data.get("pause_count", 0)
    brow_tension   = session_data.get("avg_brow_raise", 0)

    # Field names MUST match models.schemas.CoachingReport — the old
    # structural_analysis/overall_assessment/coach_final_note keys no longer exist.
    report_summary       = coaching_report.get("executive_summary", "") if coaching_report else ""
    report_scratchpad    = coaching_report.get("analysis_scratchpad", "") if coaching_report else ""
    report_framework     = coaching_report.get("framework_detected") if coaching_report else None
    report_corrections   = coaching_report.get("corrections", []) if coaching_report else []
    report_gap_analysis  = coaching_report.get("gap_analysis", []) if coaching_report else []

    corrections_str = "\n".join(
        f"  - [{c.get('category','')}] before: \"{c.get('before','')}\" → after: \"{c.get('after','')}\" | why: {c.get('why','')}"
        for c in report_corrections[:8]
    ) or "  (none)"

    gap_str = "\n".join(f"  - {g}" for g in report_gap_analysis[:5]) or "  (none)"

    existing_str = json.dumps(existing_skill, indent=2) if existing_skill else '{"note": "No prior skill memory"}'

    prompt = f"""You are a precise technical speech data analyst. Your job is to extract and update a SKILL_MEMORY JSON profile for a speaker.

SESSION #{session_count} DATA:
- WPM: {wpm:.0f} (ideal: 120-160)
- Filler word ratio: {filler_ratio*100:.1f}%
- Filler words found: {', '.join(fillers) if fillers else 'none'}
- Pitch variation: {pitch_var:.1f} Hz (low=monotone, high=expressive)
- Center-gaze percentage: {gaze_center:.0f}% of frames looking at camera (higher = better presence)
- Strategic pause count: {pause_count}
- Brow tension index: {brow_tension:.2f} (brow raise + lip press — observable, not a diagnosis)

AI COACHING REPORT THIS SESSION:
- Executive summary: {report_summary}
- Coach scratchpad analysis: {report_scratchpad}
- Framework detected: {report_framework or 'none'}
- Specific corrections (before → after):
{corrections_str}
- Gap analysis items:
{gap_str}

EXISTING SKILL_MEMORY (update this, do not erase history):
{existing_str}

Your task: Return a JSON object with EXACTLY these keys, updated to reflect patterns across ALL sessions including this one.
Do NOT just describe this session — identify RECURRING PATTERNS across sessions.
If this is the first session, make initial observations.

Return ONLY valid JSON, no preamble:
{{
  "pacing_pattern": "string (e.g. 'Consistently rushes above 180 WPM under pressure, ideal pace when relaxed')",
  "verbal_tics": ["list", "of", "recurring", "filler/weak", "words"],
  "argument_structure": "string (e.g. 'Tends to ramble without a clear thesis, rarely uses structured frameworks')",
  "linguistic_confidence": "string (e.g. 'Heavy use of hedging language: frequently says maybe, I guess, I think')",
  "vocabulary_diversity": "string (e.g. 'Repetitive use of basic adjectives, lacks precise technical vocabulary')",
  "grammar_patterns": "string (e.g. 'Recurring tense mix-ups, broken sentence structures when nervous')",
  "scenario_comprehension": "string (e.g. 'Generally stays on topic, occasional tangent when topic involves finance')",
  "visual_presence": "string (e.g. 'Eye contact improving, still looks away during complex arguments')"
}}"""

    raw = await _call_memory_llm(prompt, call_name="SKILL_MEMORY")
    if raw:
        try:
            skill_data = _extract_json_object(raw)
            await profile_repo.save_skill_memory(user_id, skill_data)
            logger.info("SKILL_MEMORY updated successfully for user=%s session=%d", user_id, session_count)
        except Exception as exc:
            logger.error("SKILL_MEMORY JSON parse failed for user=%s: %s | raw=%s", user_id, exc, raw[:200])


async def _update_user_core(
    user_id: str,
    profile: Dict[str, Any],
    session_data: Dict[str, Any],
    coaching_report: Optional[Dict[str, Any]],
) -> None:
    """
    [Call 5] Psychological Coach LLM.
    Reads CoachingReport + historical stats to synthesize USER_CORE psychological profile.
    """
    existing_core  = profile.get("user_core") or {}
    session_count  = profile.get("session_count", 0)
    scores         = profile.get("scores") or []
    trend          = profile.get("score_trend", "stable")
    weak           = profile.get("recurring_weaknesses") or []
    strong         = profile.get("recurring_strengths") or []

    # Field names MUST match models.schemas.CoachingReport.
    report_summary      = coaching_report.get("executive_summary", "") if coaching_report else ""
    report_scratchpad   = coaching_report.get("analysis_scratchpad", "") if coaching_report else ""
    report_strengths    = coaching_report.get("strengths", []) if coaching_report else []
    report_gap          = coaching_report.get("gap_analysis", []) if coaching_report else []
    report_improvement  = coaching_report.get("improvement_plan", []) if coaching_report else []
    report_framework    = coaching_report.get("framework_detected") if coaching_report else None

    existing_str = json.dumps(existing_core, indent=2) if existing_core else '{"note": "No prior user core"}'

    prompt = f"""You are an expert psychological speaking coach. Your task is to maintain a USER_CORE psychological profile for a speaker, updated after each session.

This is session #{session_count}. Score trend: {trend}. Score history (last 5): {scores[-5:] if scores else []}.

Recurring weaknesses across sessions: {', '.join(weak) if weak else 'none yet'}
Recurring strengths across sessions: {', '.join(strong) if strong else 'none yet'}

THIS SESSION'S AI COACHING REPORT:
- Executive summary: {report_summary}
- Coach scratchpad analysis: {report_scratchpad}
- Strengths identified: {'; '.join(report_strengths[:3]) if report_strengths else 'none'}
- Gaps identified: {'; '.join(report_gap[:3]) if report_gap else 'none'}
- Improvement plan: {'; '.join(report_improvement[:3]) if report_improvement else 'none'}
- Framework detected: {report_framework or 'none'}

EXISTING USER_CORE (update this carefully, preserve historical insights):
{existing_str}

Your task: Return an updated USER_CORE JSON profile. Think like a psychologist who has observed this speaker across {session_count} sessions.
DO NOT repeat the raw numbers — synthesize them into human behavioral insights.
Identify PATTERNS across sessions, not just this one session.
If stagnating_area has appeared 3+ consecutive sessions, escalate it.

Return ONLY valid JSON, no preamble:
{{
  "last_updated_session": {session_count},
  "fear_profile": {{
    "primary_fear": "string (e.g. 'fear_of_being_wrong', 'fear_of_judgment', 'fear_of_losing_control')",
    "triggers": ["topic types or situations that cause breakdown"],
    "avoidance_behaviors": ["what they do to escape discomfort when triggered"],
    "confidence_zones": ["topics or situations where they are most fluent and confident"]
  }},
  "motivation_type": {{
    "type": "challenge_driven | encouragement_driven | data_driven | social_driven",
    "responds_best_to": "string (e.g. direct tough love, specific metrics, encouragement)",
    "responds_poorly_to": "string (e.g. over-praise, vague feedback)",
    "engagement_triggers": ["what motivates them to keep improving"]
  }},
  "communication_personality": {{
    "style": "storyteller | debater | academic | conversational | rambler",
    "information_pattern": "top_down | bottom_up | scattered",
    "emotional_register": "high | medium | low",
    "verbosity": "concise | balanced | over_elaborate"
  }},
  "growth_trajectory": {{
    "primary_improvement": "string (the biggest observable improvement across sessions)",
    "stagnating_area": "string or null (repeated weakness with no improvement)",
    "regression_risk": "string or null (area that had improved but may be slipping)",
    "momentum": "rapidly_improving | improving | stable | declining"
  }},
  "coaching_stance": {{
    "tone": "string (e.g. firm_but_warm, direct_and_challenging, gentle_and_encouraging)",
    "challenge_level": "push_into_discomfort | moderate | gentle",
    "feedback_density": "detailed | concise_and_direct | brief",
    "praise_strategy": "frequent_encouragement | earned_only | minimal",
    "priority_focus": ["top 2-3 things the coach should focus on with this specific user"]
  }}
}}"""

    raw = await _call_memory_llm(prompt, call_name="USER_CORE")
    if raw:
        try:
            core_data = _extract_json_object(raw)
            await profile_repo.save_user_core(user_id, core_data)
            logger.info("USER_CORE updated successfully for user=%s session=%d", user_id, session_count)
        except (json.JSONDecodeError, Exception) as exc:
            logger.error("USER_CORE JSON parse failed for user=%s: %s | raw=%s", user_id, exc, raw[:200])

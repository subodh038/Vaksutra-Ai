"""
core/linguistic/linguistics.py — Linguistic quality analysis for the Vocalyze AI Backend.

Hybrid approach:
  Python (regex/Counter)   : run-on sentence count, top repeated words, filler detection.
  Groq LLM (gpt-oss-20b)  : context-aware extraction of weak/hedging words ONLY.
                             English transcripts only. reasoning_effort='low'.

# Filler detection is done via deterministic Python regex (see Research.md §13).

Key rotation: tries every GROQ_API_KEY* env var in turn. Stops at the first success.

Error handling: if every key fails, Python-computed fields are still returned.

Scope: English-only. Does not detect non-inclusive language (scoped out — see PendingTests.md).
"""

# ── stdlib ────────────────────────────────────────────────────────────────────
import json
import logging
import re
from collections import Counter
from typing import Any, Dict, List

# ── third-party ───────────────────────────────────────────────────────────────
import nltk
from pydantic import BaseModel

# ── local ─────────────────────────────────────────────────────────────────────
from clients.groq_client import get_groq_api_keys, get_groq_client
from models.schemas import LinguisticStats

logger = logging.getLogger(__name__)

# ── NLTK data ─────────────────────────────────────────────────────────────────
try:
    nltk.data.find("corpora/stopwords")
except LookupError:
    nltk.download("stopwords")

from nltk.corpus import stopwords
STOP_WORDS: set[str] = set(stopwords.words("english"))


# ── Filler word patterns (Python detection — NOT LLM) ────────────────────────
# See Research.md §13 for rationale on regex vs LLM extraction.
_FILLER_PATTERNS: list[tuple[str, str]] = [
    (r"\byou know\b",  "you know"),
    (r"\bi mean\b",    "I mean"),
    (r"\bum+\b",       "um"),
    (r"\buh+\b",       "uh"),
    (r"\bah+\b",       "ah"),
    (r"\berm\b",       "erm"),
    (r"\ber\b",        "er"),
    (r"\bhmm+\b",      "hmm"),
    (r"\blike\b",      "like"),
]


def _detect_fillers(text: str) -> List[str]:
    """
    Detect filler words from transcript text using regex.
    Returns every occurrence in transcript order (not deduplicated).
    """
    hits: list[tuple[int, str]] = []
    text_lower = text.lower()
    for pattern, label in _FILLER_PATTERNS:
        for match in re.finditer(pattern, text_lower):
            hits.append((match.start(), label))
    hits.sort(key=lambda x: x[0])
    return [word for _, word in hits]


# ── Internal LLM response model (weak words only) ─────────────────────────────

class _LLMExtraction(BaseModel):
    weak_words_found: List[str]


# ── Public entry point ────────────────────────────────────────────────────────

async def analyze_linguistics(
    transcript_text: str,
    words_list: List[Dict[str, Any]],
) -> LinguisticStats:
    """
    Analyse transcript quality using a hybrid Python + LLM approach.

    Parameters
    ----------
    transcript_text : Full transcript string from Whisper.
    words_list      : Per-word timing list from Whisper verbose_json.

    Returns
    -------
    LinguisticStats — never raises; degrades to Python-only results if LLM fails.
    """
    if not transcript_text.strip():
        return LinguisticStats(
            weak_words_count=0,
            weak_words_found=[],
            run_on_sentences=0,
            top_repeated_words=[],
            filler_words_found=[],
        )

    # ── 1. Python: run-on sentences (> 40 words) ──────────────────────────────
    sentences = re.split(r"[.!?]+", transcript_text)
    run_on_count = sum(1 for s in sentences if len(s.split()) > 40)

    # ── 2. Python: top repeated content words ─────────────────────────────────
    words_only     = re.findall(r"\b[a-zA-Z]+\b", transcript_text.lower())
    filtered_words = [w for w in words_only if w not in STOP_WORDS and len(w) > 2]
    word_counts    = Counter(filtered_words)
    top_repeated   = [
        f"{word} ({count})"
        for word, count in word_counts.most_common(3)
        if count > 1
    ]

    # ── 3. Python: filler detection (regex dictionary) ──────────────────────────
    filler_words_found: List[str] = _detect_fillers(transcript_text)
    logger.info("Fillers detected (Python): %s", filler_words_found)

    # ── 4. LLM: weak/hedging words only (English-only, key rotation) ──────────
    weak_words_found: List[str] = []

    api_keys = get_groq_api_keys()
    if api_keys:
        prompt = (
            f"""You are an expert executive communication coach analyzing a spoken English transcript.
            Your strict task is to identify and extract 'weak words' or hedging phrases DIRECTLY from the text.

            CORE RULES FOR EXTRACTION:
            1. VERBATIM EXACT MATCH: You must extract the exact word or phrase exactly as it appears in the transcript. Do NOT invent, alter, or normalize words.
            2. DEFINITION OF WEAK WORDS: These are phrases that express doubt, minimization, lack of confidence, or uncertainty about a claim.
            3. CONTEXT MATTERS: Only extract a word if it acts as a hedge in that specific context (e.g., flag "just" in "I just think", but do NOT flag "just" in "a just decision").
            4. CONSERVATIVE APPROACH: If the transcript is short (under 50 words), be extremely conservative. Only flag unambiguous instances of hedging. When in doubt, leave it out.

            TARGET EXAMPLES (Flag these if used to hedge):
            "just", "I think", "I guess", "kind of", "sort of", "basically", "maybe", "perhaps", "I believe", "I feel like", "it seems", "possibly", "probably", "somewhat", "tend to", "hopefully", "slightly", "to some extent"

            NEGATIVE EXAMPLES (Do NOT flag these under any circumstances):
            - Plain pronoun+verb contractions ("I'm", "I've", "I'll", "I'd") when NOT part of a larger hedge.
            - Time or frequency adverbs ("right now", "currently", "usually", "often", "today").
            - Plain statements of fact, professional titles, or literal descriptions.

            TRANSCRIPT TO ANALYZE:
            "{transcript_text}"

            OUTPUT INSTRUCTIONS:
            Return strictly a raw JSON object. Do not wrap the JSON in markdown code blocks (e.g., no ```json). Do not include any preambles, explanations, or conversational text.
            Format exactly like this:
            {{"weak_words_found": ["phrase 1", "phrase 2"]}}"""
        )

        last_error: Exception | None = None
        for idx, key in enumerate(api_keys):
            try:
                client = get_groq_client(key)
                response = await client.chat.completions.create(
                    model="openai/gpt-oss-20b",
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    temperature=0.0,
                    max_tokens=4096, 
                    reasoning_effort="low",
                )
                raw_content = response.choices[0].message.content
                usage = getattr(response, "usage", None)
                logger.info(
                    "LLM raw response  key=%d  tokens_in=%s  tokens_out=%s  finish=%s",
                    idx + 1,
                    getattr(usage, "prompt_tokens", "?"),
                    getattr(usage, "completion_tokens", "?"),
                    response.choices[0].finish_reason,
                )
                logger.info("LLM raw content: %s", raw_content)
                extracted = _LLMExtraction.model_validate_json(raw_content)
                weak_words_found = extracted.weak_words_found
                break  # success — stop rotating
            except Exception as exc:
                logger.warning("Groq API key %d failed for linguistic extraction: %s", idx + 1, exc)
                last_error = exc
                continue
        else:
            logger.error(
                "LLM linguistic extraction failed on all %d key(s). Last error: %s",
                len(api_keys), last_error,
            )

    # ── 5. Python: assemble final stats ───────────────────────────────────────
    total_words = len(words_list) if words_list else max(1, len(transcript_text.split()))
    filler_word_ratio = len(filler_words_found) / total_words if total_words > 0 else 0.0

    return LinguisticStats(
        weak_words_count=    len(weak_words_found),
        weak_words_found=    weak_words_found,
        run_on_sentences=    run_on_count,
        top_repeated_words=  top_repeated,
        filler_words_found=  filler_words_found,
        filler_word_ratio=   filler_word_ratio,
    )

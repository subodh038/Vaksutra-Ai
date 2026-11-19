"""
Unit tests for coaching_memory JSON extraction.
Verifies that LLMs prepending reasoning text, thoughts, or markdown fences
do not crash profile synthesis.
"""

import pytest
from services.coaching_memory import _extract_json_object


def test_clean_json():
    raw = '{"key": "value", "count": 42}'
    data = _extract_json_object(raw)
    assert data["key"] == "value"
    assert data["count"] == 42


def test_fenced_markdown_json():
    raw = """```json
{
  "style": "conversational",
  "verbosity": "balanced"
}
```"""
    data = _extract_json_object(raw)
    assert data["style"] == "conversational"
    assert data["verbosity"] == "balanced"


def test_reasoning_preamble_before_json():
    """Matches the exact failure case where groq/compound outputs reasoning thoughts first."""
    raw = """**Reasoning and synthesis**
- **Score trend & performance:** Over the last five sessions the speaker’s scores have fluctuated (64.5 → 50 → 62.2 → 54.7 → 64.5) but overall remain stable.
- **Key observation:** The user struggles with initial momentum but gains confidence by minute 1.

{
  "last_updated_session": 7,
  "fear_profile": {
    "primary_fear": "fear_of_judgment",
    "triggers": ["abrupt starts"],
    "avoidance_behaviors": ["rapid pacing"],
    "confidence_zones": ["storytelling"]
  },
  "growth_trajectory": {
    "momentum": "improving"
  }
}"""
    data = _extract_json_object(raw)
    assert data["last_updated_session"] == 7
    assert data["fear_profile"]["primary_fear"] == "fear_of_judgment"
    assert data["growth_trajectory"]["momentum"] == "improving"


def test_reasoning_preamble_with_code_fence():
    raw = """I will now synthesize the user profile based on recent performance.
Here are the findings:

```json
{
  "communication_personality": {
    "style": "storyteller",
    "emotional_register": "high"
  }
}
```

Hope this feedback is helpful!"""
    data = _extract_json_object(raw)
    assert data["communication_personality"]["style"] == "storyteller"
    assert data["communication_personality"]["emotional_register"] == "high"

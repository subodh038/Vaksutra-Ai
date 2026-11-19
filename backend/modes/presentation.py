"""
modes/presentation.py — Presentation / Feynman technique coaching mode.  [STUB — Phase 4]

Planned scoring weights (different from impromptu)
---------------------------------------------------
  Pacing / articulation_rate   0.25  (Feynman: explain slowly and clearly)
  Filler word ratio            0.20  (stricter than impromptu)
  Eye contact                  0.20
  Pitch variation              0.15  (monotone = disengaging)
  Low anxiety                  0.10
  Face visible                 0.10

Required context fields (from frontend)
----------------------------------------
  topic : str   — what is the presentation about?

TODO Phase 4:
  - Implement Feynman clarity scoring (simple vocabulary ratio via LLM)
  - Detect long pauses between key points (slide transition signal)
  - Stricter filler word threshold
"""

from __future__ import annotations

from typing import List

from modes.base import BaseMode, CoachingRubric
from models.schemas import RawSignals


class PresentationMode(BaseMode):

    @property
    def mode_id(self) -> str:
        return "presentation"

    def compute_score(self, signals: RawSignals) -> float:
        raise NotImplementedError(
            "PresentationMode scoring is not yet implemented. "
            "Use mode='impromptu' for now."
        )

    def generate_feedback(self, signals: RawSignals, score: float) -> List[str]:
        raise NotImplementedError(
            "PresentationMode feedback is not yet implemented."
        )

    def required_context(self) -> List[str]:
        return ["topic"]

    def coaching_rubric(self) -> CoachingRubric:
        return CoachingRubric(
            mode_label="Structured Presentation",
            focus_description=(
                "The speaker was delivering a structured presentation. "
                "Focus on clarity, pacing, smooth transitions, audience engagement signposts, "
                "and whether the key message was delivered memorably. "
                "Apply Before/After/Why to help the speaker polish their delivery."
            ),
            correction_categories=[
                "Clarity & Simplicity",
                "Transitions & Signposting",
                "Pacing",
                "Technical Vocabulary Accessibility",
            ],
            framework_hint=(
                "Look for a clear introduction, structured body with sections, and a strong conclusion. "
                "Did the speaker use signpost phrases like 'first', 'moving on', 'to summarise'?"
            ),
            key_coaching_question=(
                "Could a non-expert follow, stay engaged, and leave with the key message?"
            ),
        )

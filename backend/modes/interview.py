"""
modes/interview.py — Interview coaching mode.  [STUB — Phase 4]

Planned scoring weights (different from impromptu)
---------------------------------------------------
  Eye contact / confidence     0.35  (interviewers judge directness heavily)
  Low stress                   0.20  (high stress = nervous candidate signal)
  Low filler words             0.20  (fillers hurt professional impression)
  Articulation rate            0.15  (too fast = anxious, too slow = uncertain)
  Head pose                    0.10

Required context fields (from frontend)
----------------------------------------
  job_role    : str   — what role is being interviewed for?
  company     : str   — company name (optional, for personalised feedback)

TODO Phase 4:
  - STAR method detection via LLM (Situation, Task, Action, Result)
  - Directness score (run_on_sentences + weak_words as anti-signals)
  - Confidence composite (eye contact + low anxiety + low filler ratio)
"""

from __future__ import annotations

from typing import List

from modes.base import BaseMode, CoachingRubric
from models.schemas import RawSignals


class InterviewMode(BaseMode):

    @property
    def mode_id(self) -> str:
        return "interview"

    def compute_score(self, signals: RawSignals) -> float:
        raise NotImplementedError(
            "InterviewMode scoring is not yet implemented. "
            "Use mode='impromptu' for now."
        )

    def generate_feedback(self, signals: RawSignals, score: float) -> List[str]:
        raise NotImplementedError(
            "InterviewMode feedback is not yet implemented."
        )

    def required_context(self) -> List[str]:
        return ["job_role"]

    def coaching_rubric(self) -> CoachingRubric:
        return CoachingRubric(
            mode_label="Job Interview",
            focus_description=(
                "The speaker was answering interview questions. "
                "Focus on the STAR method (Situation-Task-Action-Result), "
                "directness, professional vocabulary, quantified impact, and conciseness. "
                "Apply Before/After/Why to help the speaker give sharper, more impressive answers."
            ),
            correction_categories=[
                "STAR Structure",
                "Specificity & Quantified Impact",
                "Professional Language",
                "Filler & Hesitation Reduction",
            ],
            framework_hint="Look for STAR: Situation, Task, Action, Result.",
            key_coaching_question="Would this answer impress a hiring manager?",
        )

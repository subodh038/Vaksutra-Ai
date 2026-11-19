"""
modes/base.py — Abstract base class for all Vocalyze coaching modes.

Adding a new mode
-----------------
1. Create  modes/<name>.py  and subclass BaseMode.
2. Add the mode slug to  models/mode.py  ModeEnum.
3. Register an instance in  modes/__init__.py  MODE_REGISTRY.

That's it — no changes needed in the pipeline or API layer.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List

from models.schemas import RawSignals


@dataclass
class CoachingRubric:
    """
    Mode-specific coaching configuration consumed by services/llm_coach.py
    to build a mode-aware LLM prompt.

    Fields
    ------
    mode_label              : Human-readable mode name for the prompt header.
    focus_description       : Paragraph describing what the LLM should focus on.
    correction_categories   : Ordered list of Before/After/Why categories to fill.
    framework_hint          : What structural framework to look for.
    key_coaching_question   : North-star question that anchors the whole report.
    """
    mode_label:            str
    focus_description:     str
    correction_categories: List[str]
    framework_hint:        str
    key_coaching_question: str


class BaseMode(ABC):
    """
    Strategy interface for coaching modes.

    The core pipeline produces a RawSignals bundle that is mode-agnostic.
    Each concrete mode interprets those signals differently, applying its own
    scoring weights and generating contextually appropriate feedback.
    """

    @property
    @abstractmethod
    def mode_id(self) -> str:
        """
        Unique slug matching a ModeEnum value.
        Examples: 'impromptu', 'feynman', 'presentation', 'interview'
        """

    @abstractmethod
    def compute_score(self, signals: RawSignals) -> float:
        """
        Produce a 0–100 composite coaching score from raw signals.
        Scoring weights are mode-specific.

        Parameters
        ----------
        signals : RawSignals bundle from core/pipeline.py

        Returns
        -------
        float in [0.0, 100.0]
        """

    @abstractmethod
    def generate_feedback(self, signals: RawSignals, score: float) -> List[str]:
        """
        Return an ordered list of human-readable coaching tips.
        Convention: first item is always a summary/overall line.

        Parameters
        ----------
        signals : RawSignals bundle from core/pipeline.py
        score   : result of compute_score() for this session
        """

    @abstractmethod
    def coaching_rubric(self) -> CoachingRubric:
        """
        Return the mode-specific coaching rubric consumed by services/llm_coach.py
        to build a mode-tailored LLM prompt.
        """

    def required_context(self) -> List[str]:
        """
        Names of extra form fields the frontend must include for this mode.
        Default: none.  Override in modes that need job_role, topic, etc.

        Example:
            return ["job_role", "company_name"]
        """
        return []

"""
modes/__init__.py — Mode registry.

All concrete modes are registered in MODE_REGISTRY.
The analysis route resolves mode_id strings to mode instances via this dict.

To add a new mode:
  1. Create modes/<name>.py + subclass BaseMode
  2. Add mode slug to models/mode.py ModeEnum
  3. Import and register below — that's it.
"""

from modes.base import BaseMode
from modes.feynman import FeynmanMode
from modes.impromptu import ImpromptuMode
from modes.interview import InterviewMode
from modes.presentation import PresentationMode

MODE_REGISTRY: dict[str, BaseMode] = {
    "impromptu":    ImpromptuMode(),
    "feynman":      FeynmanMode(),
    "presentation": PresentationMode(),
    "interview":    InterviewMode(),
}

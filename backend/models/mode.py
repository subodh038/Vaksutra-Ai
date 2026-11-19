"""
models/mode.py — Coaching mode definitions.

ModeEnum is the canonical list of supported coaching modes.
Add a new value here whenever you add a new file to modes/.
"""

from enum import Enum


class ModeEnum(str, Enum):
    IMPROMPTU    = "impromptu"
    FEYNMAN      = "feynman"
    PRESENTATION = "presentation"
    INTERVIEW    = "interview"

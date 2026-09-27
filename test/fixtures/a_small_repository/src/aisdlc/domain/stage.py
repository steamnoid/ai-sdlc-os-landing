from __future__ import annotations

from enum import Enum


class Stage(Enum):
    """Where something is, in a domain small enough to hold in one head."""

    ARRIVED = "ARRIVED"
    DEPARTED = "DEPARTED"

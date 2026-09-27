from __future__ import annotations


class LaunchPlan:
    """Not a pydantic model, so a collector has no declared fields to read.

    A repository whose artifacts are not pydantic models is a real possibility, and a
    collector that assumed they all are would report nothing at all rather than saying
    so. The page says "no declared fields" here and moves on.
    """

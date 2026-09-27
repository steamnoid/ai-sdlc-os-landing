from __future__ import annotations

from aisdlc.domain.stage import Stage

STAGES_WITHOUT_AN_AGENT = (Stage.ARRIVED,)
STAGES_WITH_AN_AGENT = (Stage.DEPARTED,)

LEGAL_TRANSITIONS: dict[Stage, frozenset[Stage]] = {
    Stage.ARRIVED: frozenset({Stage.DEPARTED}),
    Stage.DEPARTED: frozenset(),
}

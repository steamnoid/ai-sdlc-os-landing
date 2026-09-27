"""Ask a repository of AI SDLC what it is, and print the answer as JSON.

**The page this script feeds is a view of the repository, not a description of
it.** Every stage, every role, every legal move and every gate the page shows is
imported from the code that declares them, so a change to the domain reaches the
page without anybody editing the page. A table written out by hand would look the
same on screen and be wrong the first time the domain moved, which is the one
failure this whole repository is arranged to prevent.

**Four things are read and all four are required**: the stages, the roles, the
table of legal moves, and the routes a gate's answer leads to. When one of them is
missing this script stops and says which file is not there, because a page that
quietly drops a section is a page that is quietly lying. What *is* allowed to be
absent is a fact about the world — no gate declared, a class with no declared
fields — because that absence is itself the truth and the page can print it.

**The tree that answers is checked against the tree that was asked for.** An
install of the same package on the path would otherwise answer with another
checkout's code, and the page would then be confident and wrong, which is the
worst of the two failures available here.

Run it the way the build runs it:

    python scripts/ask_the_code.py --repository ../ai-sdlc-os
"""

from __future__ import annotations

import argparse
import json
import pkgutil
import sys
from enum import Enum
from importlib import import_module
from pathlib import Path
from typing import Any


class TheStagesAreNotReadableError(Exception):
    """`aisdlc.domain.stage` declares no `Stage` for the page to draw."""


class TheRolesAreNotReadableError(Exception):
    """`aisdlc.domain.role` declares no `Role` for the page to name."""


class TheTableOfLegalMovesIsNotReadableError(Exception):
    """`aisdlc.domain.state_machine` declares no `LEGAL_TRANSITIONS`."""


class TheRoutesAreNotReadableError(Exception):
    """`aisdlc.graph.router` declares no `WHERE_AN_APPROVED_ARTIFACT_LEADS`."""


class TheInvariantSaysNothingAboutAStageError(Exception):
    """A stage that neither tuple names, or that both name.

    The page prints who must be holding each stage, and that answer comes from the
    two tuples rather than from a third place. A stage in neither would have to be
    guessed and a stage in both would have two owners, and either of those is a hole
    in the domain rather than a fact about it.
    """


class TheCodeAnsweredFromAnotherRepositoryError(Exception):
    """`import aisdlc` found a tree other than the one that was asked for."""


def the_source_directory_of(a_repository: Path) -> Path:
    """Where the code of a repository is, which is `<repository>/src`.

    Named as a function rather than used inline because the path is what the tree is
    checked against, and a reader has to be able to see the two are the same value.
    """
    return a_repository / "src"


def forget_any_aisdlc_already_imported() -> None:
    """Drop every `aisdlc` module this interpreter brought in before it was asked.

    An editable install of the same package is a real thing on the machine that
    builds this page, and it may already have answered a previous import. A module
    already in `sys.modules` is not looked up again, so without this the tree read
    would be whichever one an earlier import happened to find.
    """
    for a_module_name in [name for name in sys.modules if name == "aisdlc" or name.startswith("aisdlc.")]:
        del sys.modules[a_module_name]


def the_tree_that_answered(must_be_inside: Path) -> Path:
    """Import `aisdlc` and prove it came from the tree that was asked for.

    The check is not defensive decoration. A checkout on the path answers in
    preference to the tree named on the command line, and a page built from
    another repository's domain would be indistinguishable from a correct one.
    """
    forget_any_aisdlc_already_imported()
    the_package = import_module("aisdlc")
    where_it_came_from = Path(the_package.__file__).resolve()

    if not where_it_came_from.is_relative_to(must_be_inside):
        raise TheCodeAnsweredFromAnotherRepositoryError(
            f"the code that answered came from {where_it_came_from}, which is outside the "
            f"source directory that was asked for, {must_be_inside}. A copy of this package "
            "is installed on the path, so the page would be describing a different "
            "repository than the one it was told to read."
        )

    return where_it_came_from


def the_stage_that_was_declared(a_stage: Any) -> str:
    """The stage's own name, which is what the domain persists and what the page prints."""
    return str(a_stage.value)


def read_the_stages() -> list[dict[str, Any]]:
    """Every stage, in the order the enum declares them, each with who must hold it.

    The order is the enum's own, and not an order chosen for the page. A reader of
    the domain's code should recognise the page's table, and rearranging it to suit
    a layout would break that in the one place it can be checked.
    """
    try:
        stage_module = import_module("aisdlc.domain.stage")
        state_machine_module = import_module("aisdlc.domain.state_machine")
    except ImportError as the_import_error:
        raise TheStagesAreNotReadableError(
            f"the stages could not be read, because {the_import_error}. The file this "
            "collector needs is aisdlc/domain/stage.py, and the one naming who holds a "
            "stage is aisdlc/domain/state_machine.py."
        ) from the_import_error

    the_stage_type = getattr(stage_module, "Stage", None)
    if not isinstance(the_stage_type, type) or not issubclass(the_stage_type, Enum):
        raise TheStagesAreNotReadableError(
            "aisdlc.domain.stage.Stage is not an enumeration of stages, so there is no "
            "closed set for the page to draw and the list of stages would be whatever "
            "the code happened to expose."
        )

    every_stage = list(the_stage_type)
    stages_without_an_agent = set(getattr(state_machine_module, "STAGES_WITHOUT_AN_AGENT", ()))
    stages_with_an_agent = set(getattr(state_machine_module, "STAGES_WITH_AN_AGENT", ()))

    if not every_stage:
        raise TheStagesAreNotReadableError(
            "aisdlc.domain.stage.Stage is an enumeration with no members, so the page "
            "would have nothing to draw and a reader would be looking at an empty table."
        )

    the_stages: list[dict[str, Any]] = []
    for a_stage in every_stage:
        without = a_stage in stages_without_an_agent
        with_ = a_stage in stages_with_an_agent
        if without == with_:
            raise TheInvariantSaysNothingAboutAStageError(
                f"the stage {the_stage_that_was_declared(a_stage)} is "
                + ("in both of the tuples that say who holds it" if without else "in neither of the tuples that say who holds it")
                + ", so the page would have to guess whether an agent must be holding "
                "it. The tuples are STAGES_WITHOUT_AN_AGENT and STAGES_WITH_AN_AGENT in "
                "aisdlc/domain/state_machine.py."
            )
        the_stages.append(
            {
                "name": the_stage_that_was_declared(a_stage),
                "an_agent_must_be_holding_it": with_,
            }
        )

    return the_stages


def read_the_roles() -> list[str]:
    """Every role, in the order the enum declares them."""
    try:
        role_module = import_module("aisdlc.domain.role")
    except ImportError as the_import_error:
        raise TheRolesAreNotReadableError(
            f"the roles could not be read, because {the_import_error}. The file this "
            "collector needs is aisdlc/domain/role.py."
        ) from the_import_error

    the_role_type = getattr(role_module, "Role", None)
    if not isinstance(the_role_type, type) or not issubclass(the_role_type, Enum):
        raise TheRolesAreNotReadableError(
            "aisdlc.domain.role.Role is not an enumeration of roles, so the page would "
            "print whatever names the code happened to expose."
        )

    every_role = list(the_role_type)
    if not every_role:
        raise TheRolesAreNotReadableError(
            "aisdlc.domain.role.Role is an enumeration with no members, so the page "
            "would name no discipline at all."
        )

    return [str(a_role.value) for a_role in every_role]


def read_the_transitions() -> list[dict[str, Any]]:
    """Every legal move, from the table itself, with a terminal stage listing nothing.

    A stage with no way out reports an empty list rather than no entry at all, so
    that the page can tell "nowhere to go" from "nobody looked", and the two look
    the same on a page that leaves a row blank.
    """
    try:
        state_machine_module = import_module("aisdlc.domain.state_machine")
    except ImportError as the_import_error:
        raise TheTableOfLegalMovesIsNotReadableError(
            f"the table of legal moves could not be read, because {the_import_error}. "
            "The file this collector needs is aisdlc/domain/state_machine.py, and the "
            "name it is declared under is LEGAL_TRANSITIONS."
        ) from the_import_error

    the_table = getattr(state_machine_module, "LEGAL_TRANSITIONS", None)
    if not isinstance(the_table, dict) or not the_table:
        raise TheTableOfLegalMovesIsNotReadableError(
            "aisdlc.domain.state_machine.LEGAL_TRANSITIONS is not a non-empty mapping of "
            "stages to stages, so there is no table for the page to print and the page "
            "would be drawing one nobody declared."
        )

    return [
        {
            "from": the_stage_that_was_declared(a_stage),
            "to": sorted(the_stage_that_was_declared(a_target) for a_target in the_targets),
        }
        for a_stage, the_targets in the_table.items()
    ]


def read_the_gates() -> list[dict[str, Any]]:
    """What each approved artifact leads to, in the order the router declares them.

    The order is the router's, because the router's order is the pipeline's, and a
    page that sorted it alphabetically would read as though the pipeline were a
    sequence of names rather than a sequence of stages.
    """
    try:
        router_module = import_module("aisdlc.graph.router")
    except ImportError as the_import_error:
        raise TheRoutesAreNotReadableError(
            f"the routes could not be read, because {the_import_error}. The file this "
            "collector needs is aisdlc/graph/router.py, and the name it is declared "
            "under is WHERE_AN_APPROVED_ARTIFACT_LEADS."
        ) from the_import_error

    the_routes = getattr(router_module, "WHERE_AN_APPROVED_ARTIFACT_LEADS", None)
    if not isinstance(the_routes, dict):
        raise TheRoutesAreNotReadableError(
            "aisdlc.graph.router.WHERE_AN_APPROVED_ARTIFACT_LEADS is not a mapping of "
            "artifacts to nodes, so the page cannot say where a gate's answer leads."
        )

    return [
        {"artifact": str(the_artifact), "leads_to": str(the_node)}
        for the_artifact, the_node in the_routes.items()
    ]


def read_the_types_the_agents_package_defines() -> list[dict[str, Any]]:
    """Every class the agents package defines, with the fields it declares if any.

    This is a **superset** of the artifacts, deliberately. A plan is written as a
    wrapper around a list of files, and that wrapper is not an artifact, so the
    collector does not guess which classes are artifacts — the glossary names the
    pipeline's artifacts and this is the list of what the code actually has, and the
    page says which of the named ones were found.

    A class that is not a pydantic model reports `null` for its fields rather than an
    empty list, because a class with no declared fields and a class whose fields
    could not be read are different facts.
    """
    the_agents_package = import_module("aisdlc.agents")
    the_types: list[dict[str, Any]] = []

    for a_module in _every_module_in(the_agents_package):
        for a_name, a_thing in vars(a_module).items():
            if not isinstance(a_thing, type):
                continue
            if a_thing.__module__ != a_module.__name__:
                continue
            if a_name.startswith("_"):
                continue
            the_declared_fields = getattr(a_thing, "model_fields", None)
            the_types.append(
                {
                    "name": a_name,
                    "module": a_module.__name__,
                    "declared_fields": list(the_declared_fields) if the_declared_fields is not None else None,
                }
            )

    return sorted(the_types, key=lambda a_type: a_type["name"])


def _every_module_in(a_package: Any) -> list[Any]:
    """Every module inside a package, itself included, imported in a stable order."""
    the_paths = list(getattr(a_package, "__path__", []))
    found = [a_package]
    for a_module in pkgutil.iter_modules(the_paths, prefix=f"{a_package.__name__}."):
        try:
            found.append(import_module(a_module.name))
        except ImportError:
            continue
    return found


def the_answer_about(a_repository: Path) -> dict[str, Any]:
    """Everything the page may say about a repository, asked of the repository itself.

    Built as one value and returned, never printed from here, so that a collector
    which fails halfway through has printed nothing at all. A page built from half an
    answer is the failure this script's refusals exist to prevent.
    """
    the_source_directory = the_source_directory_of(a_repository)
    where_the_code_came_from = the_tree_that_answered(must_be_inside=the_source_directory)

    return {
        "the_repository_on_disk": str(a_repository.resolve()),
        "which_code_answered": str(where_the_code_came_from),
        "stages": read_the_stages(),
        "roles": read_the_roles(),
        "transitions": read_the_transitions(),
        "gates": read_the_gates(),
        "artifacts": read_the_types_the_agents_package_defines(),
    }


def main() -> int:
    what_was_asked_for = argparse.ArgumentParser(description=__doc__)
    what_was_asked_for.add_argument(
        "--repository",
        required=True,
        help="the checkout to read, whose `src` holds the code the page describes",
    )
    what_they_asked = what_was_asked_for.parse_args()

    the_repository = Path(what_they_asked.repository).expanduser().resolve()
    sys.path.insert(0, str(the_source_directory_of(the_repository)))

    try:
        the_answer = the_answer_about(the_repository)
    except Exception as the_refusal:
        print(f"{type(the_refusal).__name__}: {the_refusal}", file=sys.stderr)
        return 1

    print(json.dumps(the_answer, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

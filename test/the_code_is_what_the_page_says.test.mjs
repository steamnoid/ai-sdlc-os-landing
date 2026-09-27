import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const the_collector = resolve(here, "..", "scripts", "ask_the_code.py");
const a_small_repository = resolve(here, "fixtures", "a_small_repository");
const the_python = process.env.PYTHON ?? "python3";

/** What the collector said, and how it said it. Nothing is thrown away. */
function asking_about(a_repository) {
	return spawnSync(the_python, [the_collector, "--repository", a_repository], {
		encoding: "utf8",
	});
}

/** The collector's answer, having first insisted that it has one. */
function the_answer_from(a_repository) {
	const answer = asking_about(a_repository);
	assert.equal(
		answer.status,
		0,
		`the collector refused a repository it should have read, and said:\n${answer.stderr}`,
	);
	return JSON.parse(answer.stdout);
}

/** A throwaway copy of the fixture, so a test may break it on purpose. */
function a_copy_of_the_fixture() {
	const where = mkdtempSync(join(tmpdir(), "a-small-repository-"));
	cpSync(a_small_repository, where, { recursive: true });
	return where;
}

const the_stage_of = (the_answer, name) =>
	the_answer.stages.find((a_stage) => a_stage.name === name);

test("the stages it reports are the stages the code defines", () => {
	const the_answer = the_answer_from(a_small_repository);

	assert.deepEqual(
		the_answer.stages.map((a_stage) => a_stage.name),
		["ARRIVED", "DEPARTED"],
		"the fixture defines two stages, in that order, and the collector reported something else",
	);
	assert.equal(
		the_stage_of(the_answer, "IDLE"),
		undefined,
		"a stage of the real repository appeared while reading the fixture, so the list is hard-coded",
	);
});

test("each stage says whether an agent must be holding it", () => {
	const the_answer = the_answer_from(a_small_repository);

	assert.equal(the_stage_of(the_answer, "ARRIVED").an_agent_must_be_holding_it, false);
	assert.equal(the_stage_of(the_answer, "DEPARTED").an_agent_must_be_holding_it, true);
});

test("the transitions it reports are the table the code defines", () => {
	const the_answer = the_answer_from(a_small_repository);

	assert.deepEqual(the_answer.transitions, [
		{ from: "ARRIVED", to: ["DEPARTED"] },
		{ from: "DEPARTED", to: [] },
	]);
});

test("a terminal stage reports no way out, rather than an absent one", () => {
	const the_answer = the_answer_from(a_small_repository);
	const terminal = the_answer.transitions.find((a_move) => a_move.from === "DEPARTED");

	assert.ok(Array.isArray(terminal.to), "the moves out of a terminal stage are not a list at all");
	assert.deepEqual(terminal.to, []);
});

test("the gates it reports are the routes the router declares", () => {
	const the_answer = the_answer_from(a_small_repository);

	assert.deepEqual(the_answer.gates, [
		{ artifact: "LaunchPlan", leads_to: "prepare_the_launch" },
		{ artifact: "LaunchReport", leads_to: "end_the_run" },
	]);
});

test("the artifacts it reports are the classes the agents package defines", () => {
	const the_answer = the_answer_from(a_small_repository);
	const the_names = the_answer.artifacts.map((an_artifact) => an_artifact.name);

	assert.ok(the_names.includes("LaunchPlan"), `the fixture's LaunchPlan is missing from ${the_names}`);
	assert.deepEqual(
		the_answer.artifacts.find((an_artifact) => an_artifact.name === "LaunchPlan").declared_fields,
		null,
		"a class with no declared fields was given some, which means the fields are invented",
	);
});

test("it names the tree that answered, and the tree is the one it was told to read", () => {
	const the_answer = the_answer_from(a_small_repository);
	const from_where = the_answer.which_code_answered;

	assert.ok(
		from_where.startsWith(a_small_repository),
		`the code that answered came from ${from_where}, which is outside the repository it was told to read`,
	);
	assert.match(from_where, /aisdlc[/\\]__init__\.py$/);
});

test("a repository with no stages is refused by name", (t) => {
	const broken = a_copy_of_the_fixture();
	t.after(() => rmSync(broken, { recursive: true, force: true }));
	rmSync(join(broken, "src", "aisdlc", "domain", "stage.py"));

	const answer = asking_about(broken);

	assert.notEqual(answer.status, 0, "a repository without a stage was read anyway");
	assert.match(answer.stderr, /stage\.py/, "the refusal does not name the file that is not there");
	assert.equal(answer.stdout, "", "a refused collector still printed an answer, which is the one way to lie here");
});

test("a repository that is not importable at all is refused", (t) => {
	const empty = mkdtempSync(join(tmpdir(), "not-a-repository-"));
	t.after(() => rmSync(empty, { recursive: true, force: true }));

	const answer = asking_about(empty);

	assert.notEqual(answer.status, 0, "a directory with no source in it was read as a repository");
	assert.match(answer.stderr, /aisdlc/, "the refusal does not say which package it could not find");
});

test("a stage that neither tuple claims is refused, because the page would print a lie", (t) => {
	const broken = a_copy_of_the_fixture();
	t.after(() => rmSync(broken, { recursive: true, force: true }));
	writeFileSync(
		join(broken, "src", "aisdlc", "domain", "state_machine.py"),
		[
			"from __future__ import annotations",
			"",
			"from aisdlc.domain.stage import Stage",
			"",
			"# ARRIVED is in neither tuple, which is a hole in the invariant rather than a fact.",
			"STAGES_WITHOUT_AN_AGENT = ()",
			"STAGES_WITH_AN_AGENT = (Stage.DEPARTED,)",
			"",
			"LEGAL_TRANSITIONS: dict[Stage, frozenset[Stage]] = {",
			"    Stage.ARRIVED: frozenset({Stage.DEPARTED}),",
			"    Stage.DEPARTED: frozenset(),",
			"}",
			"",
		].join("\n"),
	);

	const answer = asking_about(broken);

	assert.notEqual(answer.status, 0, "a stage with no owner was reported as if it had one");
	assert.match(answer.stderr, /ARRIVED/, "the refusal does not name the stage nothing claimed");
});

test("it reads the tree it is pointed at, not one that happens to be installed", (t) => {
	// An installed `aisdlc` is the reason this guard exists: a checkout on the path
	// would otherwise answer with another repository's code, and the page would be
	// confident and wrong. So a second tree is given a different answer and both are
	// read, one at a time.
	const the_other = a_copy_of_the_fixture();
	t.after(() => rmSync(the_other, { recursive: true, force: true }));
	writeFileSync(
		join(the_other, "src", "aisdlc", "domain", "stage.py"),
		[
			"from __future__ import annotations",
			"",
			"from enum import Enum",
			"",
			"",
			"class Stage(Enum):",
			'    """A different domain entirely, so the two answers cannot be confused."""',
			"",
			'    BORROWED = "BORROWED"',
			'    RETURNED = "RETURNED"',
			"",
		].join("\n"),
	);
	writeFileSync(
		join(the_other, "src", "aisdlc", "domain", "state_machine.py"),
		[
			"from __future__ import annotations",
			"",
			"from aisdlc.domain.stage import Stage",
			"",
			"STAGES_WITHOUT_AN_AGENT = (Stage.BORROWED, Stage.RETURNED)",
			"STAGES_WITH_AN_AGENT = ()",
			"",
			"LEGAL_TRANSITIONS: dict[Stage, frozenset[Stage]] = {",
			"    Stage.BORROWED: frozenset(),",
			"    Stage.RETURNED: frozenset(),",
			"}",
			"",
		].join("\n"),
	);

	const first_answer = the_answer_from(a_small_repository);
	const second_answer = the_answer_from(the_other);

	assert.deepEqual(
		first_answer.stages.map((a_stage) => a_stage.name),
		["ARRIVED", "DEPARTED"],
	);
	assert.deepEqual(
		second_answer.stages.map((a_stage) => a_stage.name),
		["BORROWED", "RETURNED"],
		"the second tree answered with the first tree's stages, so the import was cached between runs",
	);
	assert.notEqual(first_answer.which_code_answered, second_answer.which_code_answered);
});

test("it reports a repository's own idea of where it is, in full", () => {
	const the_answer = the_answer_from(a_small_repository);

	assert.equal(relative(a_small_repository, the_answer.the_repository_on_disk), "");
});

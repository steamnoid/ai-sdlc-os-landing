import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
	what_the_build_says,
	what_the_ci_says,
	what_the_deliveries_say,
	what_the_history_says,
	what_the_licence_says,
	what_the_phases_say,
	what_the_state_machine_says,
	what_the_suite_says,
} from "../src/page/what_the_page_says.mjs";

/** A state, written out by hand so that every test says exactly which fact it is about.
 *
 * The real one is read from a repository and has a hundred fields; a test that used it
 * would be testing whatever that repository happens to say today, and would keep passing
 * for the wrong reason when it changed. This is the smallest state the page can render.
 */
function a_state(overrides = {}) {
	return {
		the_repository: { owner: "steamnoid", name: "ai-sdlc-os", url: "https://github.com/steamnoid/ai-sdlc-os", on_disk: "/tmp/one" },
		the_code_that_answered: "/tmp/one/src/aisdlc/__init__.py",
		the_build: { read_at: "2026-09-27T05:22:09.687Z", branch: "phase-1-foundation", tip_commit: "13325ba", was_cloned: true },
		the_history: { is_a_git_repository: true, why_not: null, commits: [{}, {}, {}], recent: [], commits_saying_they_are_red: 2, commits_making_something_pass: 3, red_commits_answered_by_the_next_commit: 1 },
		the_suite: { was_run: true, is_green: true, why_not: null, passed: 485, failed: null, errors: null, skipped: null, deselected: 63, what_it_printed: "485 passed, 63 deselected in 3.03s\n" },
		the_domain: { stages: [], roles: [], transitions: [], gates: [], agents: [], artifacts: [], errors: [] },
		phases: [{ number: "3", slice: "discovery", gate: "e2e green", is_marked_done: true }],
		planned_and_not_yet_built: [],
		deliveries: [],
		the_github: { is_stated: true, url: null, stars: 0, forks: 0, description: null, licence: null, why_not: null, check_runs: { count: 0, why_not: null } },
		the_stack: { python: ">=3.12", dependencies: [{ name: "pydantic", version: "2.0" }], optional_dependencies: [] },
		the_licence: { is_stated: true, name: "All Rights Reserved" },
		the_commands_the_readme_gives: [{ language: "bash", lines: ["uv run pytest -q"] }],
		...overrides,
	};
}

test("a suite that exited zero is green, with its numbers", () => {
	const verdict = what_the_suite_says(a_state().the_suite);

	assert.equal(verdict.verdict, "green");
	assert.equal(verdict.passed, 485);
	assert.equal(verdict.deselected, 63);
	assert.equal(verdict.detail, null, "a green suite came with an explanation of what was wrong with it");
});

test("a suite that exited non-zero is not green, and says the exit code", () => {
	const verdict = what_the_suite_says(
		a_state().the_suite && { was_run: true, is_green: false, why_not: "the suite exited 1", passed: 449, failed: 1, deselected: 63, what_it_printed: "1 failed, 449 passed" },
	);

	assert.equal(verdict.verdict, "not green");
	assert.match(verdict.detail, /exited 1/, "the verdict does not carry the one fact that settles it");
	assert.equal(verdict.passed, 449, "the count is the one the suite printed, and hiding it would hide the failure");
});

test("a suite that was not run is a third thing, not a failure", () => {
	const verdict = what_the_suite_says({ was_run: false, is_green: false, why_not: "pass --run-the-suite to run it" });

	assert.equal(verdict.verdict, "not run");
	assert.notEqual(verdict.verdict, "not green", "a suite nobody ran is being reported as a suite that failed");
	assert.match(verdict.detail, /--run-the-suite/, "the verdict does not say what to do about it");
});

test("a directory that is not a checkout is not a project with no work in it", () => {
	const verdict = what_the_history_says(
		a_state().the_history && { is_a_git_repository: false, why_not: "not a git checkout", commits: [], recent: [] },
	);

	assert.equal(verdict.verdict, "no history");
	assert.notEqual(verdict.commits, 0, "an absent history was reported as a count of zero, which is a different claim");
	assert.match(verdict.detail, /not a git checkout/);
});

test("a history is counted, and the pairing is reported as three numbers rather than a verdict", () => {
	const verdict = what_the_history_says(a_state().the_history);

	assert.equal(verdict.verdict, "counted");
	assert.equal(verdict.commits, 3);
	assert.equal(verdict.commits_saying_they_are_red, 2);
	assert.equal(verdict.red_commits_answered_by_the_next_commit, 1);
	assert.ok(verdict.commits_saying_they_are_red > verdict.red_commits_answered_by_the_next_commit, "the fixture has an unanswered red commit and the verdict hid it");
});

test("a repository with no check runs is not a repository whose checks passed", () => {
	const verdict = what_the_ci_says(a_state().the_github);

	assert.equal(verdict.verdict, "no workflow");
	assert.notEqual(verdict.verdict, "green", "an absent CI was reported as a passing one");
	assert.equal(verdict.count, 0);
});

test("check runs that exist are counted, and still not called green on the repository's behalf", () => {
	const verdict = what_the_ci_says({ ...a_state().the_github, check_runs: { count: 4, why_not: null } });

	assert.equal(verdict.verdict, "counted");
	assert.equal(verdict.count, 4);
});

test("check runs that could not be read are unread, not zero", () => {
	const verdict = what_the_ci_says({ ...a_state().the_github, check_runs: { count: null, why_not: "the API answered 403" } });

	assert.equal(verdict.verdict, "unread");
	assert.equal(verdict.count, null, "a call that was refused was turned into a count of zero");
});

test("a pull request nobody could ask about is not a pull request no agent wrote", () => {
	const verdicts = what_the_deliveries_say([
		{ number: 1, url: "https://github.com/o/r/pull/1", was_written_by_an_agent: null, why_unread: "the API answered 403", what_the_repository_says: "an agent" },
	]);

	assert.equal(verdicts[0].verdict, "unread");
	assert.equal(verdicts[0].was_written_by_an_agent, null, "a refused call produced an answer about the author");
	assert.equal(
		verdicts[0].what_the_repository_says,
		"an agent",
		"the repository's own claim was dropped, so a disagreement could not have been reported",
	);
});

test("a pull request the body contradicts the repository about keeps both answers", () => {
	const verdicts = what_the_deliveries_say([
		{ number: 2, url: "https://github.com/o/r/pull/2", was_written_by_an_agent: true, why_unread: null, what_the_repository_says: "a person, by hand" },
	]);

	assert.equal(verdicts[0].verdict, "the pull request says an agent wrote it");
	assert.equal(verdicts[0].what_the_repository_says, "a person, by hand", "the contradicting claim was replaced by the finding");
	assert.equal(verdicts[0].they_agree, false, "the disagreement was resolved instead of reported");
});

test("a licence the file does not state is not a licence nobody has", () => {
	const verdict = what_the_licence_says({ is_stated: false, name: null });

	assert.equal(verdict.verdict, "not stated");
	assert.equal(verdict.name, null, "an absent licence file was given a name");
});

test("a licence is printed in the file's own words", () => {
	const verdict = what_the_licence_says({ is_stated: true, name: "All Rights Reserved" });

	assert.equal(verdict.verdict, "stated");
	assert.equal(verdict.name, "All Rights Reserved");
});

test("a phase is done because the document struck it through, not because it says the word", () => {
	const verdicts = what_the_phases_say([
		{ number: "3", slice: "discovery", gate: "green", is_marked_done: true },
		{ number: "8", slice: "the remaining eight agents, one responsibility each", gate: "each ships a test", is_marked_done: false },
	]);

	assert.equal(verdicts[0].verdict, "done");
	assert.equal(verdicts[1].verdict, "next", 'a phase whose gate says "each ships a test" was called done because a word appeared in it');
});

test("the state machine on the page is the one in the code, stage for stage and move for move", () => {
	const the_state_machine = what_the_state_machine_says({
		stages: [
			{ name: "IDLE", an_agent_must_be_holding_it: false },
			{ name: "DONE", an_agent_must_be_holding_it: false },
		],
		roles: ["PO"],
		transitions: [
			{ from: "IDLE", to: ["DONE"] },
			{ from: "DONE", to: [] },
		],
		gates: [{ artifact: "DiscoveryReport", leads_to: "the planner" }],
	});

	assert.deepEqual(
		the_state_machine.stages.map((a_stage) => a_stage.name),
		["IDLE", "DONE"],
	);
	assert.deepEqual(
		the_state_machine.moves,
		[
			{ from: "IDLE", to: ["DONE"], is_terminal: false },
			{ from: "DONE", to: [], is_terminal: true },
		],
		"a stage with no way out is not marked terminal, so a reader cannot tell it from a stage nobody examined",
	);
	assert.equal(the_state_machine.gates.length, 1);
});

test("the build says which commit, which branch and when, and never drops the time", () => {
	const verdict = what_the_build_says(a_state().the_build);

	assert.equal(verdict.commit, "13325ba");
	assert.equal(verdict.branch, "phase-1-foundation");
	assert.ok(verdict.read_at, "a page that does not say when it read cannot be stale and does not know it");
});

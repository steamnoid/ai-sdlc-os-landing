import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const the_collector = resolve(here, "..", "scripts", "ask_the_repository.mjs");
const a_small_repository = resolve(here, "fixtures", "a_small_repository");

/** What the collector did, and where it was told to put what it found. */
function asking_about(a_repository, ...what_it_was_asked) {
	const where_the_state_should_land = join(mkdtempSync(join(tmpdir(), "the-state-")), "the_repository.json");
	const answer = spawnSync(
		process.execPath,
		[the_collector, "--repository", a_repository, "--out", where_the_state_should_land, ...what_it_was_asked],
		{ encoding: "utf8" },
	);
	return { answer, where_the_state_should_land };
}

/** The state the collector wrote, having first insisted that it wrote one. */
function the_state_of(a_repository, ...what_it_was_asked) {
	const { answer, where_the_state_should_land } = asking_about(a_repository, ...what_it_was_asked);
	assert.equal(answer.status, 0, `the collector refused, and said:\n${answer.stderr}`);
	assert.ok(existsSync(where_the_state_should_land), "the collector reported success and wrote nothing");
	return JSON.parse(readFileSync(where_the_state_should_land, "utf8"));
}

/** A copy of the fixture, so that a test may break it on purpose. */
function a_copy_of_the_fixture() {
	const where = mkdtempSync(join(tmpdir(), "a-small-repository-"));
	spawnSync("cp", ["-R", a_small_repository, where]);
	spawnSync("mv", [join(where, "a_small_repository"), join(where, "repository")]);
	const repository = join(where, "repository");
	return {
		repository,
		put(relative_path, the_text) {
			writeFileSync(join(repository, relative_path), the_text);
		},
		remove(relative_path) {
			rmSync(join(repository, relative_path), { force: true });
		},
		keep() {
			rmSync(where, { recursive: true, force: true });
		},
	};
}

/** A program that stands in for the interpreter, so a test can decide what the suite says. */
function a_suite_that_says(what_it_prints, how_it_exits, t) {
	const where = mkdtempSync(join(tmpdir(), "a-pretend-interpreter-"));
	t.after(() => rmSync(where, { recursive: true, force: true }));
	const the_program = join(where, "the-interpreter");
	writeFileSync(the_program, ["#!/bin/sh", ...what_it_prints, `exit ${how_it_exits}`, ""].join("\n"));
	spawnSync("chmod", ["+x", the_program]);
	return the_program;
}

test("it says where it read from, so a reader can go and check", () => {
	const the_state = the_state_of(a_small_repository);

	assert.match(the_state.the_repository.on_disk, /a_small_repository$/);
	assert.match(the_state.the_code_that_answered, /aisdlc[/\\]__init__\.py$/);
});

test("a repository with no glossary is refused by name, and no state file is left behind", (t) => {
	const broken = a_copy_of_the_fixture();
	t.after(() => broken.keep());
	broken.remove("docs/domain-glossary.md");

	const { answer, where_the_state_should_land } = asking_about(broken.repository);

	assert.notEqual(answer.status, 0, "a repository with no glossary was read anyway");
	assert.match(answer.stderr, /domain-glossary\.md/, "the refusal does not name the file that is missing");
	assert.equal(existsSync(where_the_state_should_land), false, "a state file was written by a collector that refused");
});

test("a role the code does not have is refused, which is the old page's bug caught by a machine", (t) => {
	const broken = a_copy_of_the_fixture();
	t.after(() => broken.keep());
	broken.put(
		"docs/domain-glossary.md",
		[
			"# Domain glossary",
			"",
			"## The roles",
			"",
			"| Role | Meaning |",
			"|---|---|",
			"| `PILOT` | flies the thing |",
			"| `AI` | a handoff, which is not a discipline |",
			"",
		].join("\n"),
	);

	const { answer } = asking_about(broken.repository);

	assert.notEqual(answer.status, 0, "a role that exists only in prose was printed as if it were part of the domain");
	assert.match(answer.stderr, /AI/, "the refusal does not name the role the code does not have");
	assert.match(answer.stderr, /PILOT/, "the refusal does not say what the code does have");
});

test("a stage the code does not have is refused", (t) => {
	const broken = a_copy_of_the_fixture();
	t.after(() => broken.keep());
	broken.put(
		"docs/domain-glossary.md",
		[
			"# Domain glossary",
			"",
			"## The stages",
			"",
			"| Value | Meaning |",
			"|---|---|",
			"| `ARRIVED` | here |",
			"| `BOARDING` | not a stage |",
			"",
		].join("\n"),
	);

	const { answer } = asking_about(broken.repository);

	assert.notEqual(answer.status, 0, "a stage that exists only in prose was printed as a stage of the domain");
	assert.match(answer.stderr, /BOARDING/);
});

test("the phases are read as rows of a table, each with a number and a name", () => {
	const the_state = the_state_of(a_small_repository);

	assert.ok(Array.isArray(the_state.phases), "the phases are not a list, so the page cannot print a table of them");
	assert.ok(the_state.phases.length > 0, "no phases were read, so the page would print an empty progress table");
	for (const a_phase of the_state.phases) {
		assert.ok(a_phase.number, "a phase has no number, so the table would have an unnumbered row");
		assert.ok(a_phase.slice, "a phase has no name, so the table would have an unnamed row");
	}
});

test("what is not built yet is its own thing, and whether it is there is checked rather than assumed", () => {
	const the_state = the_state_of(a_small_repository);

	assert.ok(
		Array.isArray(the_state.planned_and_not_yet_built),
		"the list of what is not built is not a list, so the page cannot print it as unfinished",
	);
	assert.ok(
		the_state.planned_and_not_yet_built.length > 0,
		"the list came back empty, which is the one emptiness that would read as good news",
	);
	for (const a_path of the_state.planned_and_not_yet_built) {
		assert.equal(
			typeof a_path.exists_on_disk,
			"boolean",
			`${a_path.named_as} has no verdict about whether it is there, so the page would say "not built" about a path nobody looked for`,
		);
	}
});

test("with no suite to run, the page is told it was not run", () => {
	const the_state = the_state_of(a_small_repository);

	assert.equal(the_state.the_suite.was_run, false);
	assert.equal(the_state.the_suite.is_green, false, "a suite that never ran was reported as green");
	assert.match(
		String(the_state.the_suite.why_not),
		/--run-the-suite/,
		"the state does not say what to do about it, so a reader cannot tell it apart from a suite that failed",
	);
});

test("a suite that exited zero is green, and the terminal block is what it printed", (t) => {
	const the_interpreter = a_suite_that_says(
		['echo "collected 2/2 tests collected (0 deselected) in 0.01s"', 'echo "2 passed in 0.02s"'],
		0,
		t,
	);

	const the_state = the_state_of(a_small_repository, "--run-the-suite", "--python", the_interpreter);

	assert.equal(the_state.the_suite.was_run, true);
	assert.equal(the_state.the_suite.is_green, true);
	assert.equal(the_state.the_suite.passed, 2);
	assert.equal(
		the_state.the_suite.what_it_printed,
		"collected 2/2 tests collected (0 deselected) in 0.01s\n2 passed in 0.02s\n",
		"the terminal block on the page is not the output the suite printed",
	);
});

test("a suite that exited non-zero is not green, whatever it says about how many passed", (t) => {
	const the_interpreter = a_suite_that_says(['echo "1 failed, 449 passed in 4.00s"'], 1, t);

	const the_state = the_state_of(a_small_repository, "--run-the-suite", "--python", the_interpreter);

	assert.equal(the_state.the_suite.is_green, false);
	assert.match(
		String(the_state.the_suite.why_not),
		/exited 1/,
		"the state does not carry the suite's own exit code, which is the only fact that settles it",
	);
});

test("a pull request is called agent-written only when its own body says so", async (t) => {
	const the_bodies = {
		"/repos/someone/some-repository/pulls/1": "By an agent, and not by hand — which is the part worth scrutinising.",
		"/repos/someone/some-repository/pulls/2": "A person wrote this, by hand, on a laptop.",
	};
	const what_was_asked_for = [];
	const the_api = createServer((a_request, a_response) => {
		what_was_asked_for.push(a_request.url);
		const the_body = the_bodies[a_request.url];
		const the_number = Number(a_request.url.split("/").pop());
		if (the_body === undefined) {
			a_response.writeHead(404).end("{}");
			return;
		}
		a_response.writeHead(200, { "content-type": "application/json" }).end(
			JSON.stringify({
				number: the_number,
				title: "a delivery",
				html_url: `https://github.com/someone/some-repository/pull/${the_number}`,
				additions: 111,
				deletions: 0,
				changed_files: 1,
				body: the_body,
			}),
		);
	});
	await new Promise((done) => the_api.listen(0, done));
	t.after(() => the_api.close());

	const the_state = the_state_of(a_small_repository, "--github-api", `http://127.0.0.1:${the_api.address().port}`);

	assert.equal(the_state.deliveries.length, 2, `the fixture's two deliveries came back as ${the_state.deliveries.length}`);
	const written_by_an_agent = the_state.deliveries.filter((a_delivery) => a_delivery.was_written_by_an_agent);
	assert.equal(written_by_an_agent.length, 1, "a pull request was called agent-written without its body saying so");
	assert.equal(written_by_an_agent[0].number, 1);
	assert.ok(what_was_asked_for.length > 0, "nothing was asked of the API, so the two deliveries were printed from nothing");
	assert.equal(
		written_by_an_agent[0].what_the_repository_says,
		"an agent",
		"the repository's own account of who wrote it is missing, so the page cannot show the claim the code is checking",
	);
	assert.equal(
		the_state.deliveries[1].what_the_repository_says,
		"a person, by hand",
		"the second delivery's own account of its author was not read, so the fixture's table is not being parsed",
	);
});

test("a pull request the API cannot be asked about is unread, never known not to be an agent's", async (t) => {
	const the_api = createServer((_a_request, a_response) => {
		a_response.writeHead(403).end("{}");
	});
	await new Promise((done) => the_api.listen(0, done));
	t.after(() => the_api.close());

	const the_state = the_state_of(a_small_repository, "--github-api", `http://127.0.0.1:${the_api.address().port}`);

	for (const a_delivery of the_state.deliveries) {
		assert.equal(a_delivery.was_written_by_an_agent, null, "an unread pull request was given an answer about its author");
		assert.match(String(a_delivery.why_unread), /403/);
	}
});

test("the state says when it read, and which branch it read", () => {
	const the_state = the_state_of(a_small_repository);

	assert.ok(the_state.the_build.read_at, "the build does not say when it read, so a stale page would look current");
	assert.match(String(the_state.the_build.branch), /\S/);
});

test("a directory that is not a git repository is reported as one, not as a repository with no commits", () => {
	const the_state = the_state_of(a_small_repository);

	assert.equal(the_state.the_history.is_a_git_repository, false);
	assert.deepEqual(the_state.the_history.commits, []);
	assert.match(
		String(the_state.the_history.why_not),
		/git/,
		"the history does not say why it is empty, so a count of zero reads as a project that has done nothing",
	);
});

test("a git repository's history is counted, and its recent commits are named newest first", (t) => {
	const a_repository = a_copy_of_the_fixture();
	t.after(() => a_repository.keep());
	spawnSync("git", ["init", "-q", "-b", "main"], { cwd: a_repository.repository });
	for (const a_subject of ["first", "second", "third"]) {
		spawnSync("git", ["add", "-A"], { cwd: a_repository.repository });
		spawnSync(
			"git",
			["-c", "user.name=A Reader", "-c", "user.email=reader@example.com", "commit", "-q", "-m", a_subject],
			{ cwd: a_repository.repository },
		);
	}

	const the_state = the_state_of(a_repository.repository);

	assert.equal(the_state.the_history.is_a_git_repository, true);
	assert.equal(the_state.the_history.commits.length, 3);
	assert.deepEqual(
		the_state.the_history.recent.map((a_commit) => a_commit.subject),
		["third", "second", "first"],
		"the commits are not newest first, so the page would read the history backwards",
	);
	assert.equal(the_state.the_history.why_not, null);
});

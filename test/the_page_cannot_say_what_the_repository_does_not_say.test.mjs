import { strict as assert } from "node:assert";
import { execFile, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";

const run = promisify(execFile);

const here = dirname(fileURLToPath(import.meta.url));
const the_collector = resolve(here, "..", "scripts", "ask_the_repository.mjs");
const a_small_repository = resolve(here, "fixtures", "a_small_repository");

/** What the collector did, and where it was told to put what it found.
 *
 * Asynchronous on purpose, and not for tidiness: two of these tests hand the collector
 * an API served by this process, and a collector started with `spawnSync` would block
 * the event loop that has to answer it. The test would then wait for a reply that this
 * process is the only one able to send.
 */
async function asking_about(a_repository, ...what_it_was_asked) {
	const where_the_state_should_land = join(mkdtempSync(join(tmpdir(), "the-state-")), "the_repository.json");
	try {
		const { stdout, stderr } = await run(
			process.execPath,
			[the_collector, "--repository", a_repository, "--out", where_the_state_should_land, ...what_it_was_asked],
			{ encoding: "utf8" },
		);
		return { how_it_ended: 0, stdout, stderr, where_the_state_should_land };
	} catch (the_failure) {
		return {
			how_it_ended: the_failure.code ?? 1,
			stdout: the_failure.stdout ?? "",
			stderr: the_failure.stderr ?? "",
			where_the_state_should_land,
		};
	}
}

/** The state the collector wrote, having first insisted that it wrote one. */
async function the_state_of(a_repository, ...what_it_was_asked) {
	const { how_it_ended, stderr, where_the_state_should_land } = await asking_about(a_repository, ...what_it_was_asked);
	assert.equal(how_it_ended, 0, `the collector refused, and said:\n${stderr}`);
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

/** A program that stands in for the interpreter, so a test can decide what the suite says.
 *
 * The collector uses one interpreter for two jobs — reading the code and running the
 * suite — because they are the same repository and one interpreter is the honest answer.
 * So this stand-in is asked both things: the code is read by a real python, and the
 * suite is whatever this program says it is. It dispatches on its own arguments rather
 * than a flag the collector checks for, so the collector runs its own code path.
 */
function an_interpreter_whose_suite_says(what_it_prints, how_it_exits, t) {
	const where = mkdtempSync(join(tmpdir(), "a-pretend-interpreter-"));
	t.after(() => rmSync(where, { recursive: true, force: true }));
	const the_program = join(where, "the-interpreter");
	writeFileSync(
		the_program,
		[
			"#!/bin/sh",
			'for an_argument in "$@"; do',
			'  case "${an_argument##*/}" in',
			"    ask_the_code.py) exec python3 \"$@\" ;;",
			"  esac",
			"done",
			...what_it_prints,
			`exit ${how_it_exits}`,
			"",
		].join("\n"),
	);
	spawnSync("chmod", ["+x", the_program]);
	return the_program;
}

test("it says where it read from, so a reader can go and check", async () => {
	const the_state = await the_state_of(a_small_repository);

	assert.match(the_state.the_repository.on_disk, /a_small_repository$/);
	assert.match(the_state.the_code_that_answered, /aisdlc[/\\]__init__\.py$/);
});

test("a repository with no glossary is refused by name, and no state file is left behind", async (t) => {
	const broken = a_copy_of_the_fixture();
	t.after(() => broken.keep());
	broken.remove("docs/domain-glossary.md");

	const { how_it_ended, stderr, where_the_state_should_land } = await asking_about(broken.repository);

	assert.notEqual(how_it_ended, 0, "a repository with no glossary was read anyway");
	assert.match(stderr, /domain-glossary\.md/, "the refusal does not name the file that is missing");
	assert.equal(existsSync(where_the_state_should_land), false, "a state file was written by a collector that refused");
});

test("a role the code does not have is refused, which is the old page's bug caught by a machine", async (t) => {
	const broken = a_copy_of_the_fixture();
	t.after(() => broken.keep());
	broken.put("docs/domain-glossary.md", a_glossary_naming("| `ARRIVED` | here |", "| `AI` | a handoff, not a discipline |"));

	const { how_it_ended, stderr } = await asking_about(broken.repository);

	assert.notEqual(how_it_ended, 0, "a role that exists only in prose was printed as if it were part of the domain");
	assert.match(stderr, /AI/, "the refusal does not name the role the code does not have");
	assert.match(stderr, /PILOT/, "the refusal does not say what the code does have");
});

test("a stage the code does not have is refused", async (t) => {
	const broken = a_copy_of_the_fixture();
	t.after(() => broken.keep());
	broken.put("docs/domain-glossary.md", a_glossary_naming("| `BOARDING` | not a stage |", "| `PILOT` | flies the thing |"));

	const { how_it_ended, stderr } = await asking_about(broken.repository);

	assert.notEqual(how_it_ended, 0, "a stage that exists only in prose was printed as a stage of the domain");
	assert.match(stderr, /BOARDING/);
});

/** A glossary whose stages and roles are both present, so a test can break exactly one.
 *
 * Both sections are there on purpose. A replacement glossary carrying only the section
 * under test is refused for a *missing* section before the thing under test is ever
 * examined, and the test would then be passing for the wrong reason — which is the one
 * way a refusal test stops meaning anything.
 */
function a_glossary_naming(a_stage_row, a_role_row) {
	return [
		"# Domain glossary",
		"",
		"## The stages",
		"",
		"| Value | Meaning |",
		"|---|---|",
		a_stage_row,
		"",
		"## The roles",
		"",
		"| Role | Meaning |",
		"|---|---|",
		a_role_row,
		"",
	].join("\n");
}

test("the phases are read as rows of a table, each with a number and a name", async () => {
	const the_state = await the_state_of(a_small_repository);

	assert.ok(Array.isArray(the_state.phases), "the phases are not a list, so the page cannot print a table of them");
	assert.ok(the_state.phases.length > 0, "no phases were read, so the page would print an empty progress table");
	for (const a_phase of the_state.phases) {
		assert.ok(a_phase.number, "a phase has no number, so the table would have an unnumbered row");
		assert.ok(a_phase.slice, "a phase has no name, so the table would have an unnamed row");
	}
});

test("what is not built yet is its own thing, and whether it is there is checked rather than assumed", async () => {
	const the_state = await the_state_of(a_small_repository);

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

test("with no suite to run, the page is told it was not run", async () => {
	const the_state = await the_state_of(a_small_repository);

	assert.equal(the_state.the_suite.was_run, false);
	assert.equal(the_state.the_suite.is_green, false, "a suite that never ran was reported as green");
	assert.match(
		String(the_state.the_suite.why_not),
		/--run-the-suite/,
		"the state does not say what to do about it, so a reader cannot tell it apart from a suite that failed",
	);
});

test("a suite that exited zero is green, and the terminal block is what it printed", async (t) => {
	const the_interpreter = an_interpreter_whose_suite_says(
		['echo "collected 2/2 tests collected (0 deselected) in 0.01s"', 'echo "2 passed in 0.02s"'],
		0,
		t,
	);

	const the_state = await the_state_of(a_small_repository, "--run-the-suite", "--python", the_interpreter);

	assert.equal(the_state.the_suite.was_run, true);
	assert.equal(the_state.the_suite.is_green, true);
	assert.equal(the_state.the_suite.passed, 2);
	assert.equal(
		the_state.the_suite.what_it_printed,
		"collected 2/2 tests collected (0 deselected) in 0.01s\n2 passed in 0.02s\n",
		"the terminal block on the page is not the output the suite printed",
	);
});

test("a suite that exited non-zero is not green, whatever it says about how many passed", async (t) => {
	const the_interpreter = an_interpreter_whose_suite_says(['echo "1 failed, 449 passed in 4.00s"'], 1, t);

	const the_state = await the_state_of(a_small_repository, "--run-the-suite", "--python", the_interpreter);

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

	const the_state = await the_state_of(a_small_repository, "--github-api", `http://127.0.0.1:${the_api.address().port}`);

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

	const the_state = await the_state_of(a_small_repository, "--github-api", `http://127.0.0.1:${the_api.address().port}`);

	for (const a_delivery of the_state.deliveries) {
		assert.equal(a_delivery.was_written_by_an_agent, null, "an unread pull request was given an answer about its author");
		assert.match(String(a_delivery.why_unread), /403/);
	}
});

test("a claim the pull request contradicts is kept, not resolved in favour of the nicer one", async (t) => {
	// The repository's table calls its second delivery a person's, and this pull request
	// says otherwise. Neither answer may win: the page shows the claim and the finding,
	// and a disagreement between them is the most interesting thing it could report.
	const the_api = createServer((a_request, a_response) => {
		const the_number = Number(a_request.url.split("/").pop());
		a_response.writeHead(200, { "content-type": "application/json" }).end(
			JSON.stringify({
				number: the_number,
				title: "a delivery",
				html_url: `https://github.com/someone/some-repository/pull/${the_number}`,
				additions: 1,
				deletions: 0,
				changed_files: 1,
				body: the_number === 2 ? "By an agent, whatever the table above says." : "By a person.",
			}),
		);
	});
	await new Promise((done) => the_api.listen(0, done));
	t.after(() => the_api.close());

	const the_state = await the_state_of(a_small_repository, "--github-api", `http://127.0.0.1:${the_api.address().port}`);

	const the_contradicted = the_state.deliveries.find((a_delivery) => a_delivery.number === 2);
	assert.equal(the_contradicted.what_the_repository_says, "a person, by hand", "the repository's own claim was overwritten");
	assert.equal(the_contradicted.was_written_by_an_agent, true, "the pull request's own body was not read");
});

test("with no API to ask, the page is still built, and says which fields it could not read", async () => {
	// The default run of this repository's own tests must reach no network, so the
	// collector asks GitHub only when it is told where to ask. A build that cannot be
	// run offline cannot be checked, and a page missing whole sections reads as a
	// project with nothing to report rather than as a build that read less.
	const the_state = await the_state_of(a_small_repository);

	assert.equal(the_state.deliveries.length, 2, "the deliveries the repository lists were not read at all");
	for (const a_delivery of the_state.deliveries) {
		assert.equal(a_delivery.was_written_by_an_agent, null, "an API that was never asked produced an answer");
		assert.match(String(a_delivery.why_unread), /--github-api/, "the reason does not say what to do about it");
	}
	assert.equal(the_state.the_github.is_stated, false);
	assert.ok(the_state.the_domain.stages.length > 0, "the page lost the domain because the API was not asked");
});

test("the state says when it read, and which branch it read", async () => {
	const the_state = await the_state_of(a_small_repository);

	assert.ok(the_state.the_build.read_at, "the build does not say when it read, so a stale page would look current");
	assert.match(String(the_state.the_build.branch), /\S/);
});

test("a directory that is not a git repository is reported as one, not as a repository with no commits", async () => {
	const the_state = await the_state_of(a_small_repository);

	assert.equal(the_state.the_history.is_a_git_repository, false);
	assert.deepEqual(the_state.the_history.commits, []);
	assert.match(
		String(the_state.the_history.why_not),
		/git/,
		"the history does not say why it is empty, so a count of zero reads as a project that has done nothing",
	);
});

test("a git repository's history is counted, and its recent commits are named newest first", async (t) => {
	const a_repository = a_copy_of_the_fixture();
	t.after(() => a_repository.keep());
	spawnSync("git", ["init", "-q", "-b", "main"], { cwd: a_repository.repository });
	spawnSync("mkdir", ["-p", join(a_repository.repository, "notes")]);
	for (const a_subject of ["first", "second", "third"]) {
		// Each commit needs something to commit, or git refuses it and the history comes
		// back with one commit instead of three — which is a broken test rather than a
		// broken reader, and reads exactly like one. A *new* file each time, so the
		// documents the collector needs are left whole and stay whole.
		a_repository.put(`notes/${a_subject}.md`, `# ${a_subject}\n`);
		spawnSync("git", ["add", "-A"], { cwd: a_repository.repository });
		spawnSync(
			"git",
			["-c", "user.name=A Reader", "-c", "user.email=reader@example.com", "commit", "-q", "-m", a_subject],
			{ cwd: a_repository.repository },
		);
	}

	const the_state = await the_state_of(a_repository.repository);

	assert.equal(the_state.the_history.is_a_git_repository, true);
	assert.equal(the_state.the_history.commits.length, 3);
	assert.deepEqual(
		the_state.the_history.recent.map((a_commit) => a_commit.subject),
		["third", "second", "first"],
		"the commits are not newest first, so the page would read the history backwards",
	);
	assert.equal(the_state.the_history.why_not, null);
});

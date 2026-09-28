import { strict as assert } from "node:assert";
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { before, test } from "node:test";

const run = promisify(execFile);

const here = dirname(fileURLToPath(import.meta.url));
const the_repository = resolve(here, "..");
const the_astro = resolve(the_repository, "node_modules", "astro", "bin", "astro.mjs");
const where_the_state_lives = resolve(the_repository, "src", "state", "the_repository.json");

// The state is a build artifact and is deliberately not committed, so a page can never
// be built from a snapshot nobody read today. A fresh checkout therefore has to read
// the project first, and this is the message that says so — a missing file with no
// explanation is the same silence as a page with a wrong number in it.
if (!existsSync(where_the_state_lives)) {
	test("the state exists before the page is judged", () => {
		assert.fail(
			`there is no state at ${where_the_state_lives}. Run \`npm run collect\` first: the page is built ` +
				"from what the collectors read, and that file is never committed on purpose.",
		);
	});
}

const the_state = JSON.parse(readFileSync(where_the_state_lives, "utf8"));

let the_page_as_text = "";
let where_the_build_landed = "";

before(async () => {
	where_the_build_landed = mkdtempSync(join(tmpdir(), "the-built-page-"));
	await run(process.execPath, [the_astro, "build", "--outDir", where_the_build_landed], {
		cwd: the_repository,
		encoding: "utf8",
	});
	// The tags come off, because a word split across elements reads as absent when it
	// is on the page, and a test that cannot see it will send somebody looking for a
	// bug that is not there.
	the_page_as_text = readFileSync(join(where_the_build_landed, "index.html"), "utf8")
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ");
});

test("every stage the code declares is on the page", () => {
	for (const a_stage of the_state.the_domain.stages) {
		assert.ok(the_page_as_text.includes(a_stage.name), `${a_stage.name} is declared in the code and is not on the page`);
	}
});

test("every legal move the code declares is on the page", () => {
	for (const a_move of the_state.the_domain.transitions) {
		for (const a_target of a_move.to) {
			assert.ok(
				the_page_as_text.includes(a_target),
				`${a_move.from} → ${a_target} is a legal move in the code and is not on the page`,
			);
		}
	}
});

test("the page does not count the deliveries in prose, because prose does not get rebuilt", () => {
	assert.doesNotMatch(
		the_page_as_text,
		/\bTwo pull requests\b/i,
		"the page counts its deliveries in a sentence somebody typed, and the count goes stale the moment a third one ships",
	);
	assert.doesNotMatch(
		the_page_as_text,
		/\bThe second one\b/i,
		"the page refers to a delivery by its position, which reorders the moment one is merged",
	);
	assert.match(
		the_page_as_text,
		new RegExp(`${the_state.deliveries.length} pull requests`, "i"),
		"the page does not carry the count the state has",
	);
});

test("the counted sentence is readable, because a newline between two expressions vanishes", () => {
	// A paragraph written as `{a} things and\n{b} of them\n{was} written` renders as
	// `and1 of themwas written`. Nothing raises: the count is present, the words are
	// present, and a test looking for either finds it. Only a test looking for the
	// spaces notices, which is why this one looks for the whole sentence.
	assert.match(
		the_page_as_text,
		/against a real repository, and \d+ of them (was|were) written by an agent/i,
		"the counted sentence lost a space, which on a page reads as a typo in the middle of the claim",
	);
	assert.doesNotMatch(
		the_page_as_text,
		/\band\d|\dof them\b|\bthem(was|were)\b/i,
		"an expression is welded to the word beside it, so the page reads as though it were machine output",
	);
});

test("the page does not conclude the project is not open source, because the file decides that", () => {
	assert.doesNotMatch(
		the_page_as_text,
		/this project is not open source/i,
		"the page states a conclusion about the licence that no file it reads says, and the licence is a file it does read",
	);
	assert.match(
		the_page_as_text,
		new RegExp(the_state.the_licence.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
		"the page does not print the licence in the file's own words",
	);
});

test("the suite's verdict on the page is the verdict the state carries", () => {
	if (the_state.the_suite.is_green) {
		assert.match(the_page_as_text, /exited 0/, "the suite is green in the state and the page does not say so");
	} else {
		assert.doesNotMatch(the_page_as_text, /exited 0/, "the suite is not green in the state and the page claims it is");
	}
});

test("the page names the commit and the branch it was built from", () => {
	assert.ok(the_page_as_text.includes(the_state.the_build.tip_commit), "the build's commit is not on the page");
	assert.ok(the_page_as_text.includes(the_state.the_build.branch), "the build's branch is not on the page");
});

test("the build publishes the state it was built from, so the page can be checked by hand", () => {
	// The page's whole argument is that its numbers came from a machine reading the
	// project. Publishing the state makes that checkable by a reader rather than a claim,
	// and it is also what lets the next run ask what is already published without a
	// previous run, a token or a deployment history.
	const where_the_published_state_should_be = join(where_the_build_landed, "the_repository.json");
	assert.ok(
		existsSync(where_the_published_state_should_be),
		"the build published no state, so the next run has nothing to compare against and publishes every hour",
	);

	const the_published = JSON.parse(readFileSync(where_the_published_state_should_be, "utf8"));
	assert.deepEqual(
		the_published.the_build.tip_commit,
		the_state.the_build.tip_commit,
		"the published state is not the state this page was built from",
	);
	assert.equal(the_published.the_suite.passed, the_state.the_suite.passed);
});

test("every delivery offers its pull request, instead of hiding it in a small number", () => {
	// The card used to carry its link on a two-character `#2` in the corner, which is the
	// least findable place a link can be and the only thing on the card a reader is
	// invited to press. The count is checked because a card that lost its affordance
	// would still show the number, and the number is not the affordance.
	const how_many_are_offered = (the_page_as_text.match(/Open the pull request/g) ?? []).length;
	assert.equal(
		how_many_are_offered,
		the_state.deliveries.length,
		`the page offers ${how_many_are_offered} pull requests and describes ${the_state.deliveries.length}`,
	);
});

test("no delivery link sits inside another link", () => {
	// A card that is itself a link cannot contain the old `#2` link: nested anchors are
	// invalid, browsers break the inner one, and the count of `href` is what shows it.
	//
	// Only `href` is counted, and not the URL wherever it appears. The project's own
	// backlog quotes pull request #2 inside a phase's gate, so its address is on the page
	// as plain text — and the first version of this test counted that, and failed for a
	// reason that had nothing to do with what it was checking.
	const the_page_as_markup = readFileSync(join(where_the_build_landed, "index.html"), "utf8");
	for (const a_delivery of the_state.deliveries) {
		const the_escaped = a_delivery.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const how_many = (the_page_as_markup.match(new RegExp(`href="${the_escaped}"`, "g")) ?? []).length;
		assert.equal(
			how_many,
			1,
			`${a_delivery.url} is an href ${how_many} times, so one of the links is inside another`,
		);
	}
});

test("the page promises no rhythm, because the schedule does not keep one", () => {
	// GitHub documents `schedule` as best-effort, and this page watched it stop keeping
	// one: cron runs came every 3.4 hours, then 4.7, then 6.1, then not at all for 8.4
	// hours, while the project it describes took three commits an hour. A page that says
	// "every hour" is describing a guarantee it does not have and cannot check.
	for (const a_promise of [/\bevery hour\b/i, /\bhourly\b/i, /\bevery six hours\b/i]) {
		assert.doesNotMatch(the_page_as_text, a_promise, "the page promises a rhythm it cannot keep");
	}
	assert.match(
		the_page_as_text,
		/Published only when a fact changed/i,
		"the skip is the part of the mechanism that holds, and it should still be said",
	);
});

test("when the facts were read sits beside the commit they were read at", () => {
	// A reader looking at the numbers at the top should be able to see how old they are
	// without scrolling to a footnote. The commit alone does not say how fresh it is: a
	// commit from six hours ago and one from six minutes ago look identical in it.
	const when_read = new Date(the_state.the_build.read_at);
	const the_read_at = `${when_read.toISOString().slice(0, 10)} ${when_read.toISOString().slice(11, 16)} UTC`;

	assert.ok(
		the_page_as_text.includes(the_read_at),
		`the page does not say when it read the project, and this build read it at ${the_read_at}`,
	);

	const where_the_commit_is = the_page_as_text.indexOf(the_state.the_build.tip_commit);
	const where_the_time_is = the_page_as_text.indexOf(the_read_at);
	assert.ok(where_the_commit_is !== -1 && where_the_time_is !== -1);
	assert.ok(
		Math.abs(where_the_commit_is - where_the_time_is) < 200,
		`the commit and the time it was read are ${Math.abs(where_the_commit_is - where_the_time_is)} characters apart, so freshness is a footnote again`,
	);
});

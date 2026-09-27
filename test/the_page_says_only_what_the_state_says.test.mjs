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

before(async () => {
	const where_the_build_should_land = mkdtempSync(join(tmpdir(), "the-built-page-"));
	await run(process.execPath, [the_astro, "build", "--outDir", where_the_build_should_land], {
		cwd: the_repository,
		encoding: "utf8",
	});
	// The tags come off, because a word split across elements reads as absent when it
	// is on the page, and a test that cannot see it will send somebody looking for a
	// bug that is not there.
	the_page_as_text = readFileSync(join(where_the_build_should_land, "index.html"), "utf8")
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

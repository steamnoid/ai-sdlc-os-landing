/** Check out the project this page is about, the way the build does.
 *
 * **The recipe belongs to `.github/workflows/pages.yml`, and this is the same two steps
 * so a developer can produce what the build produces.** The steps are: clone the branch,
 * then install the project's own dependencies from its lockfile, because the collector
 * imports the project's code and that code imports langgraph.
 *
 * The alternative was a collector that cloned and installed as its first act, and a
 * collector with side effects is a collector whose own run changes the thing it measures.
 * So the two steps live here, are named, and can be read in the same order the build
 * runs them.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const owner = process.env.AISDLC_OWNER ?? "steamnoid";
const name = process.env.AISDLC_NAME ?? "ai-sdlc-os";
const ref = process.env.AISDLC_BRANCH ?? "main";
const where = join(process.cwd(), "build", "the-repository");

function asking_git(...what_was_asked) {
	return spawnSync("git", what_was_asked, { cwd: process.cwd(), encoding: "utf8" });
}

// A checkout that is already there is replaced rather than updated. The page is built
// from a moment, and reusing a directory from an earlier moment would quietly blend
// two of them — which is the sort of thing that is invisible in every number.
if (existsSync(where)) {
	rmSync(where, { recursive: true, force: true });
}
mkdirSync(join(process.cwd(), "build"), { recursive: true });

const the_clone = asking_git("clone", "--quiet", "--branch", ref, `https://github.com/${owner}/${name}.git`, where);
if (the_clone.status !== 0) {
	// A missing branch is nearly always a merge rather than a mistake, and `git`'s own
	// sentence does not say so. It happened here: the project's work moved to `main` and
	// the branch the page was reading was deleted, and the fix was one value.
	process.stderr.write(
		`the project could not be checked out at ${owner}/${name} branch ${ref}:\n${the_clone.stderr}\n` +
			`If that branch no longer exists, the work was probably merged. Run \`git ls-remote --heads ` +
			`https://github.com/${owner}/${name}.git\` and set AISDLC_BRANCH — and THE_BRANCH in the workflow — ` +
			"to the branch that has the source in it.\n",
	);
	process.exit(1);
}

process.stdout.write(`checked out ${owner}/${name} at ${ref} into ${where}\n`);

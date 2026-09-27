/** What a repository's own test suite says, by running it.
 *
 * **Green is the exit code, not the number of passes.** A run that printed
 * `1 failed, 449 passed` is a run that failed, and the exit code is the one fact that
 * settles it; a page that reported "449 passed" there would be quoting the best line
 * of a failure. A suite that was not run is neither green nor red, and it says which
 * flag to pass, because a page with an empty number reads as a project with nothing
 * to report.
 *
 * **The output is kept whole.** The page prints what the suite printed, byte for byte,
 * so a reader can compare it with their own run. Anything the collector tidied up
 * would be a claim about the run rather than the run.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/** A name with a separator in it is a path and means one place; anything else is a program on PATH. */
const as_a_path_or_as_a_program = (what_was_named) =>
	what_was_named.includes("/") ? resolve(what_was_named) : what_was_named;

/** The interpreter to run the suite with: the repository's own, if it made one. */
export function the_interpreter_to_run_the_suite_with(repository, what_was_asked_for) {
	if (what_was_asked_for !== undefined) {
		return as_a_path_or_as_a_program(what_was_asked_for);
	}
	const its_own = join(repository, ".venv", "bin", "python");
	return existsSync(its_own) ? its_own : "python3";
}

/** The counts pytest prints on its last line, and `null` for any it does not print. */
function the_counts_in(the_last_line) {
	const count_of = (what_it_says) => {
		const the_number = new RegExp(`(\\d+) ${what_it_says}`).exec(the_last_line);
		return the_number === null ? null : Number(the_number[1]);
	};
	return {
		passed: count_of("passed"),
		failed: count_of("failed"),
		errors: count_of("error"),
		skipped: count_of("skipped"),
		deselected: count_of("deselected"),
	};
}

/** What the page says about the suite when it was not asked to run it. */
export function a_suite_that_was_not_run() {
	return {
		was_run: false,
		is_green: false,
		why_not: "pass --run-the-suite to run it, and this page will report what it says",
		passed: null,
		failed: null,
		skipped: null,
		deselected: null,
		what_it_printed: null,
	};
}

/** Run the suite in the repository, and report what it said.
 *
 * `PYTHONPATH` points at the repository's own `src`, so the suite runs against the
 * checkout it was run in rather than against a copy installed somewhere on the
 * machine — the same reason `ask_the_code.py` checks which tree answered.
 */
export function read_the_suite(repository, { how_to_run_it, was_it_asked_for }) {
	if (!was_it_asked_for) {
		return a_suite_that_was_not_run();
	}

	const the_run = spawnSync(how_to_run_it, ["-m", "pytest", "-q", "-p", "no:cacheprovider"], {
		cwd: repository,
		encoding: "utf8",
		env: {
			...process.env,
			PYTHONPATH: join(repository, "src"),
			// Running another repository's suite is not a licence to write into it.
			PYTHONDONTWRITEBYTECODE: "1",
		},
	});

	const what_it_printed = `${the_run.stdout ?? ""}${the_run.stderr ?? ""}`;
	const the_last_line = what_it_printed.trimEnd().split("\n").at(-1) ?? "";
	const the_counts = the_counts_in(the_last_line);
	const how_it_ended = the_run.status;

	return {
		was_run: true,
		is_green: how_it_ended === 0,
		why_not:
			how_it_ended === 0
				? null
				: `the suite exited ${how_it_ended}, and only an exit code of 0 is green: ${the_last_line}`,
		...the_counts,
		what_it_printed,
	};
}

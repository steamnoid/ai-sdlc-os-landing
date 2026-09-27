/** Has anything the page prints changed since the page was published?
 *
 * The page is rebuilt hourly so it cannot go stale quietly, and a run that finds the
 * project exactly where it was would otherwise publish a byte-identical artifact. So
 * this asks the live site for the state it was built from and compares, and the build
 * and deploy steps are skipped when nothing moved.
 *
 * **The comparison needs no previous run, no API token and no history of deployments:**
 * the live site publishes the state it was built from, and that file *is* the previous
 * answer. It also means a reader can do the same thing — fetch
 * `the_repository.json` from the site and check the numbers above it against it.
 *
 * **A state that cannot be read is a change, never a "no change".** A site with nothing
 * published yet, a 404, a rate limit, a truncated file: every one of those means the
 * comparison did not happen, and a comparison that did not happen must not be reported
 * as agreement. Publishing again is cheap and being wrong is not.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { what_differs_between } from "./compare_the_states.mjs";

/** Ask the live site for the state it was built from. */
async function the_published_state(at) {
	try {
		const the_answer = await fetch(`${at.replace(/\/$/, "")}/the_repository.json`, {
			headers: { accept: "application/json", "user-agent": "ai-sdlc-os-landing" },
		});
		if (!the_answer.ok) {
			return { was_read: false, why_not: `the published page answered ${the_answer.status}`, state: null };
		}
		return { was_read: true, why_not: null, state: await the_answer.json() };
	} catch (the_failure) {
		return { was_read: false, why_not: `the published page could not be read: ${the_failure.message}`, state: null };
	}
}

export async function has_anything_changed({ the_state, the_published_site }) {
	const the_previous = await the_published_state(the_published_site);
	if (!the_previous.was_read) {
		return {
			has_changed: true,
			why: the_previous.why_not,
			differences: [],
		};
	}
	const differences = what_differs_between(the_state, the_previous.state);
	return {
		has_changed: differences.length > 0,
		why:
			differences.length === 0
				? "every fact on the page is the fact already published"
				: `${differences.length} fact${differences.length === 1 ? "" : "s"} differ, starting with ${differences[0]}`,
		differences,
	};
}

const what_was_asked_for = { publish_at: "https://steamnoid.github.io/ai-sdlc-os-landing" };
for (let where_it_is = 2; where_it_is < process.argv.length; where_it_is += 1) {
	const the_flag = process.argv[where_it_is];
	if (the_flag === "--state") {
		what_was_asked_for.state = process.argv[where_it_is + 1];
		where_it_is += 1;
	}
	if (the_flag === "--published-at") {
		what_was_asked_for.publish_at = process.argv[where_it_is + 1];
		where_it_is += 1;
	}
}

if (what_was_asked_for.state !== undefined) {
	const the_state = JSON.parse(readFileSync(resolve(what_was_asked_for.state), "utf8"));
	const the_answer = await has_anything_changed({ the_state, the_published_site: what_was_asked_for.publish_at });
	// Written to $GITHUB_OUTPUT when there is one, and printed either way: a run on
	// somebody's laptop should say the same thing as a run on a runner.
	const the_line = `has_changed=${the_answer.has_changed}`;
	if (process.env.GITHUB_OUTPUT !== undefined) {
		process.stdout.write(`${the_line}\n`);
		const { appendFileSync } = await import("node:fs");
		appendFileSync(process.env.GITHUB_OUTPUT, `${the_line}\n`);
	} else {
		process.stdout.write(`${the_line}\n`);
	}
	process.stderr.write(`${the_answer.why}\n`);
}

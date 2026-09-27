/** What the page is allowed to say, decided from the state and nowhere else.
 *
 * **This is where a claim is either earned or refused, and it is the only place.** The
 * collectors gather facts; the page prints them. Between the two sits a handful of
 * decisions that a template is the wrong place to make, because a template that says
 * "green" for anything that is not a failure is one careless ternary away from
 * saying it for a suite that was never run.
 *
 * Every function here takes one part of the state and returns the words the page may
 * use about it. A function returns a **verdict** alongside the numbers, and the verdict
 * is the part a reader acts on:
 *
 * | verdict | what it means | what it must never be confused with |
 * |---|---|---|
 * | `green` | the suite exited zero | a suite that printed a lot of passes |
 * | `not green` | the suite exited something else | a suite that mostly passed |
 * | `not run` | the suite was never asked to run | a suite that failed |
 * | `no history` | the directory read is not a checkout | a project with no commits |
 * | `no workflow` | the repository has no CI | a repository whose CI is green |
 * | `unread` | nothing could be asked | an answer of no |
 *
 * **A refusal is a value, not an absence.** Where the state says a fact could not be
 * read, the page says so in words, because a field that is simply missing on a page
 * reads as a project with nothing to report.
 */

export function what_the_suite_says(the_suite) {
	return { verdict: null, passed: null, deselected: null, detail: null, what_it_printed: null };
}

export function what_the_history_says(the_history) {
	return {
		verdict: null,
		commits: null,
		commits_saying_they_are_red: null,
		commits_making_something_pass: null,
		red_commits_answered_by_the_next_commit: null,
		detail: null,
	};
}

export function what_the_ci_says(the_github) {
	return { verdict: null, count: null, detail: null };
}

export function what_the_deliveries_say(the_deliveries) {
	return the_deliveries.map(() => ({
		verdict: null,
		number: null,
		url: null,
		was_written_by_an_agent: null,
		what_the_repository_says: null,
		they_agree: null,
		additions: null,
		deletions: null,
		changed_files: null,
		title: null,
		detail: null,
	}));
}

export function what_the_licence_says(the_licence) {
	return { verdict: null, name: null };
}

export function what_the_phases_say(the_phases) {
	return the_phases.map(() => ({ verdict: null, number: null, slice: null, gate: null }));
}

export function what_the_state_machine_says(the_domain) {
	return { stages: [], roles: [], moves: [], gates: [] };
}

export function what_the_build_says(the_build) {
	return { commit: null, branch: null, read_at: null, was_cloned: null };
}

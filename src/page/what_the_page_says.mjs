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
	if (!the_suite.was_run) {
		return { verdict: "not run", passed: null, deselected: null, detail: the_suite.why_not, what_it_printed: null };
	}
	return {
		verdict: the_suite.is_green ? "green" : "not green",
		passed: the_suite.passed,
		deselected: the_suite.deselected,
		// The exit code, in words, and the numbers the suite printed even when they are
		// unflattering: "not green" with nothing under it would be a claim the reader
		// cannot check against their own run.
		detail: the_suite.why_not,
		what_it_printed: the_suite.what_it_printed,
	};
}

export function what_the_history_says(the_history) {
	if (!the_history.is_a_git_repository) {
		// `commits: null` rather than 0. A project with no commits is the most alarming
		// thing a page can say, and it is not what a directory that is not a checkout
		// means.
		return {
			verdict: "no history",
			commits: null,
			commits_saying_they_are_red: null,
			commits_making_something_pass: null,
			red_commits_answered_by_the_next_commit: null,
			detail: the_history.why_not,
		};
	}
	return {
		verdict: "counted",
		commits: the_history.commits.length,
		commits_saying_they_are_red: the_history.commits_saying_they_are_red,
		commits_making_something_pass: the_history.commits_making_something_pass,
		red_commits_answered_by_the_next_commit: the_history.red_commits_answered_by_the_next_commit,
		detail: null,
	};
}

export function what_the_ci_says(the_github) {
	if (the_github.check_runs.count === null) {
		return { verdict: "unread", count: null, detail: the_github.check_runs.why_not };
	}
	if (the_github.check_runs.count === 0) {
		return {
			verdict: "no workflow",
			count: 0,
			detail: "the repository has no workflow, so nothing ran on its commits",
		};
	}
	return { verdict: "counted", count: the_github.check_runs.count, detail: null };
}

export function what_the_deliveries_say(the_deliveries) {
	return the_deliveries.map((a_delivery) => {
		if (a_delivery.was_written_by_an_agent === null) {
			return {
				...a_delivery,
				verdict: "unread",
				they_agree: null,
				detail: a_delivery.why_unread,
			};
		}
		// Both answers, and whether they agree. A repository that calls a change a
		// person's and a pull request that says an agent wrote it is a disagreement worth
		// showing, not a thing to resolve in favour of the tidier story.
		const what_the_pull_request_says = a_delivery.was_written_by_an_agent
			? "the pull request says an agent wrote it"
			: "the pull request says a person wrote it";
		return {
			...a_delivery,
			verdict: what_the_pull_request_says,
			they_agree:
				a_delivery.what_the_repository_says.toLowerCase().includes("agent") === a_delivery.was_written_by_an_agent,
			detail: null,
		};
	});
}

export function what_the_licence_says(the_licence) {
	return the_licence.is_stated
		? { verdict: "stated", name: the_licence.name }
		: { verdict: "not stated", name: null };
}

export function what_the_phases_say(the_phases) {
	return the_phases.map((a_phase) => ({
		...a_phase,
		verdict: a_phase.is_marked_done ? "done" : "next",
	}));
}

export function what_the_state_machine_says(the_domain) {
	return {
		stages: the_domain.stages,
		roles: the_domain.roles,
		moves: the_domain.transitions.map((a_move) => ({
			...a_move,
			is_terminal: a_move.to.length === 0,
		})),
		gates: the_domain.gates,
	};
}

export function what_the_build_says(the_build) {
	return {
		commit: the_build.tip_commit,
		branch: the_build.branch,
		read_at: the_build.read_at,
		was_cloned: the_build.was_cloned,
	};
}

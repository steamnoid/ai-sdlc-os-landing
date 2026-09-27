/** What GitHub says, asked of the API over HTTP.
 *
 * **A pull request's author is read from the pull request, not from the repository's
 * table about it.** The repository's own table is a claim; the pull request's body is
 * the thing itself. The two answers are kept in separate fields so the page can show
 * the claim and the finding without either overwriting the other, and so a
 * disagreement between them is visible rather than resolved in favour of the nicer one.
 *
 * **A pull request that could not be read is `null`, not `false`.** "Nobody could be
 * asked" and "nobody wrote it by hand" are different answers, and an API that answered
 * 403 is a fact about this build rather than about the pull request. Every call
 * therefore returns a reason with the answer, and no call throws: a page that could
 * not reach the API has less to show, which is honest, rather than nothing at all.
 */

/** The phrase the repository itself uses, in its own table, for a change an agent made. */
const WHAT_AN_AGENT_SAYS = /\bby an agent\b/i;

/** What every unread field says when nothing was asked at all. */
const NO_API_WAS_ASKED = "no API was asked for, so nothing was read about it; pass --github-api to read it";

/** Ask the API one question, and answer with either what it said or why it would not say. */
async function asking_the_api(the_api, what_was_asked) {
	try {
		const the_answer = await fetch(`${the_api}${what_was_asked}`, {
			headers: {
				accept: "application/vnd.github+json",
				"user-agent": "ai-sdlc-os-landing",
				...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
			},
		});
		if (!the_answer.ok) {
			return { was_read: false, why_not: `the API answered ${the_answer.status}`, what_it_said: null };
		}
		return { was_read: true, why_not: null, what_it_said: await the_answer.json() };
	} catch (the_failure) {
		return { was_read: false, why_not: `the API could not be reached: ${the_failure.message}`, what_it_said: null };
	}
}

/** `owner/name/pull/number`, which is the only shape of link the delivered table holds. */
function the_parts_of(a_pull_request_url) {
	const the_parts = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)$/.exec(a_pull_request_url);
	if (the_parts === null) {
		return null;
	}
	return { owner: the_parts[1], name: the_parts[2], number: Number(the_parts[3]) };
}

/** Everything about one delivered pull request, and whether its body says an agent wrote it. */
async function read_one_delivery(the_api, a_delivery) {
	const the_parts = the_parts_of(a_delivery.url);
	if (the_parts === null) {
		return { ...a_delivery, was_written_by_an_agent: null, why_unread: `not a pull request link: ${a_delivery.url}` };
	}

	const { was_read, why_not, what_it_said } = await asking_the_api(
		the_api,
		`/repos/${the_parts.owner}/${the_parts.name}/pulls/${the_parts.number}`,
	);

	if (!was_read) {
		return { ...a_delivery, was_written_by_an_agent: null, why_unread: why_not };
	}

	const the_body = String(what_it_said.body ?? "");
	return {
		...a_delivery,
		number: what_it_said.number ?? the_parts.number,
		url: what_it_said.html_url ?? a_delivery.url,
		title: what_it_said.title ?? null,
		additions: what_it_said.additions ?? null,
		deletions: what_it_said.deletions ?? null,
		changed_files: what_it_said.changed_files ?? null,
		was_written_by_an_agent: WHAT_AN_AGENT_SAYS.test(the_body),
		why_unread: null,
	};
}

/** Every delivered pull request, each with the repository's claim and the finding kept apart. */
export async function read_the_deliveries(the_api, what_the_repository_lists) {
	if (the_api === null) {
		return what_the_repository_lists.map((a_delivery) => ({
			...a_delivery,
			was_written_by_an_agent: null,
			why_unread: NO_API_WAS_ASKED,
		}));
	}
	const one_after_another = [];
	for (const a_delivery of what_the_repository_lists) {
		one_after_another.push(await read_one_delivery(the_api, a_delivery));
	}
	return one_after_another;
}

/** What the described repository is, as the API counts it: stars, forks, and whether it has CI. */
export async function read_the_described_repository(the_api, owner, name) {
	if (the_api === null) {
		return {
			is_stated: false,
			stars: null,
			forks: null,
			description: null,
			licence: null,
			check_runs: { count: null, why_not: NO_API_WAS_ASKED },
			why_not: NO_API_WAS_ASKED,
		};
	}

	const { was_read, what_it_said } = await asking_the_api(the_api, `/repos/${owner}/${name}`);
	if (!was_read) {
		return { is_stated: false, stars: null, forks: null, description: null, check_runs: null, why_not: "the repository could not be read" };
	}

	const the_check_runs = await asking_the_api(the_api, `/repos/${owner}/${name}/commits/${what_it_said.default_branch}/check-runs`);
	return {
		is_stated: true,
		url: what_it_said.html_url ?? null,
		stars: what_it_said.stargazers_count ?? null,
		forks: what_it_said.forks_count ?? null,
		description: what_it_said.description || null,
		licence: what_it_said.license?.spdx_id ?? null,
		why_not: null,
		// No check runs is a fact about the repository and the page prints it as one: a
		// repository with no CI must not look like a repository whose CI is green.
		check_runs: the_check_runs.was_read
			? { count: the_check_runs.what_it_said.total_count ?? 0, why_not: null }
			: { count: null, why_not: the_check_runs.why_not },
	};
}

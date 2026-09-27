/** What the repository's own git history says, asked of git rather than of a file.
 *
 * A checkout is a fact about a moment, and the page says which moment: the branch,
 * the commit and the number of commits are all read here, so a page built from an
 * old checkout says so rather than looking current.
 *
 * **The RED/GREEN count is computed, and it is the reason this file exists.** The
 * repository's rule is that a cycle is one commit that fails and one commit that makes
 * it pass, so the count of commits that say they are red, and how many of them are
 * answered by the very next commit, is a fact a reader can check and a marketing page
 * would otherwise have to assert. It is also not a clean number: some red commits are
 * refined by another test commit and some are answered by a repair, and the page
 * prints the count rather than a verdict the history does not support.
 */

import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";

/** What git was asked, and what it said. An exit code is part of the answer. */
function asking_git(inside, ...what_was_asked) {
	return spawnSync("git", what_was_asked, { cwd: inside, encoding: "utf8" });
}

/** The same directory, without the symlinks — `/tmp` and `/private/tmp` are one place. */
function the_same_directory_as_it_really_is(a_directory) {
	try {
		return realpathSync(a_directory);
	} catch {
		return a_directory;
	}
}

/** Whether a directory *is* a checkout, rather than merely sitting inside one.
 *
 * `git rev-parse --git-dir` succeeds for any directory below a repository's root, so
 * a subdirectory — or a test fixture committed inside this page's own repository —
 * would answer with an enclosing project's history, and the page would then report
 * another project's commits as its own. The top level is asked for and compared,
 * because "this directory is the root" is the only answer that means what it says.
 */
export function is_a_git_repository(inside) {
	const the_top_level = asking_git(inside, "rev-parse", "--show-toplevel");
	if (the_top_level.status !== 0) {
		return false;
	}
	return the_same_directory_as_it_really_is(the_top_level.stdout.trim()) === the_same_directory_as_it_really_is(inside);
}

/** The branch and the commit the checkout stands on, as git spells them. */
export function read_where_the_checkout_stands(inside) {
	return {
		branch: asking_git(inside, "rev-parse", "--abbrev-ref", "HEAD").stdout.trim(),
		tip_commit: asking_git(inside, "rev-parse", "--short", "HEAD").stdout.trim(),
	};
}

/** Every commit, oldest first, which is the order the RED/GREEN pairing is counted over. */
function read_every_commit(inside) {
	const the_log = asking_git(inside, "log", "--reverse", "--format=%h%x1f%s%x1f%aI");
	return the_log.stdout
		.split("\n")
		.filter((a_line) => a_line.trim().length > 0)
		.map((a_line) => {
			const [the_commit, the_subject, the_date] = a_line.split("\x1f");
			return { commit: the_commit, subject: the_subject, authored_at: the_date };
		});
}

const is_red = (a_subject) => a_subject.startsWith("test(") && a_subject.includes("RED");
const is_green = (a_subject) => a_subject.startsWith("feat(") || a_subject.startsWith("fix(");

/** How the repository's own commits hold up against its own rule, counted rather than claimed.
 *
 * The repository's rule is that a cycle is one commit that fails and one commit that
 * makes it pass, so the count of commits that say they are red, and how many of those are
 * answered by the very next commit, is a fact a reader can check — where a marketing page
 * would otherwise have to assert it. It is deliberately three numbers and no verdict: the
 * history does not support a single clean number, some red commits are refined by another
 * test commit and some are answered by a repair, and the page prints the count rather than
 * a conclusion the history does not carry.
 */
function how_the_history_holds_up_against_its_own_rule(the_commits) {
	const the_subjects = the_commits.map((a_commit) => a_commit.subject);
	const the_where_a_red_commit_is = the_subjects
		.map((a_subject, where_it_is) => (is_red(a_subject) ? where_it_is : -1))
		.filter((where_it_is) => where_it_is !== -1);

	return {
		commits_saying_they_are_red: the_where_a_red_commit_is.length,
		commits_making_something_pass: the_subjects.filter(is_green).length,
		red_commits_answered_by_the_next_commit: the_where_a_red_commit_is.filter(
			(where_it_is) => is_green(the_subjects[where_it_is + 1] ?? ""),
		).length,
	};
}

/** How many commits the page names at the end, which is all a reader scrolls to. */
const how_many_are_named_in_full = 8;

/** The whole history in one value, with the reason it is empty when it is empty.
 *
 * A directory that is not a checkout is not a repository with no commits, and the page
 * has to be able to tell those apart: the first is a fact about how the page was built
 * and the second would be the most alarming thing it could say about a project.
 */
export function read_the_history(inside) {
	if (!is_a_git_repository(inside)) {
		return {
			is_a_git_repository: false,
			why_not: "the directory read is not a git checkout, so there is no history to count",
			commits: [],
			recent: [],
			commits_saying_they_are_red: 0,
			commits_making_something_pass: 0,
			red_commits_answered_by_the_next_commit: 0,
		};
	}

	const the_commits = read_every_commit(inside);
	return {
		is_a_git_repository: true,
		why_not: null,
		...read_where_the_checkout_stands(inside),
		...how_the_history_holds_up_against_its_own_rule(the_commits),
		commits: the_commits,
		recent: the_commits.slice(-how_many_are_named_in_full).reverse(),
	};
}

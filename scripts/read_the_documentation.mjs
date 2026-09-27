/** What the repository's own documents say, read between markers and never guessed at.
 *
 * **A table is read by its heading.** Every section read here is found by a heading
 * that has to be there, and its absence is a refusal rather than an empty table. An
 * empty table on a page reads as "nothing to report", which is the one answer a
 * document that has been reorganised would give by accident.
 *
 * **Nothing is inferred from a document that only prose carries.** What a phase is,
 * what a command is, who wrote a delivery and what an error protects exist in
 * markdown and nowhere else, so they are read from markdown. What a stage is and
 * where a gate leads exist in code and are read there instead — see
 * `scripts/ask_the_code.py` — and the two are cross-checked rather than trusted.
 */

/** Thrown when a document a repository must have is not there, or says less than the page needs. */
export class TheRepositoryDoesNotSayWhatThePageNeedsError extends Error {
	constructor(what_is_missing, where_it_was_looked_for) {
		super(
			`${what_is_missing} — looked for in ${where_it_was_looked_for}. A document that has been ` +
				"reorganised is the likely cause, and the page is stopped rather than quietly " +
				"missing a section.",
		);
		this.name = "TheRepositoryDoesNotSayWhatThePageNeedsError";
	}
}

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The text of a file, or a refusal naming the file that is not there. */
export function the_text_of(relative_path, inside) {
	const where_it_should_be = join(inside, relative_path);
	if (!existsSync(where_it_should_be)) {
		throw new TheRepositoryDoesNotSayWhatThePageNeedsError(
			`there is no ${relative_path}`,
			where_it_should_be,
		);
	}
	return readFileSync(where_it_should_be, "utf8");
}

/** The lines of a section, from a heading that starts with a given phrase until the next heading. */
export function the_section_starting_with(the_text, what_the_heading_starts_with) {
	const lines = the_text.split("\n");
	const first = lines.findIndex((a_line) => a_line.startsWith("#") && a_line.includes(what_the_heading_starts_with));
	if (first === -1) {
		throw new TheRepositoryDoesNotSayWhatThePageNeedsError(
			`no heading beginning "${what_the_heading_starts_with}"`,
			"the document",
		);
	}
	const rest = lines.slice(first + 1);
	const next = rest.findIndex((a_line) => a_line.startsWith("# "));
	return (next === -1 ? rest : rest.slice(0, next)).join("\n");
}

/** The rows of the first markdown table in some text, as arrays of cells with the edges trimmed. */
function the_rows_of_a_table(in_text) {
	const lines = in_text.split("\n");
	const first_row = lines.findIndex((a_line) => a_line.trim().startsWith("|"));
	if (first_row === -1) {
		return [];
	}
	const the_rows = [];
	for (const a_line of lines.slice(first_row)) {
		const trimmed = a_line.trim();
		if (!trimmed.startsWith("|")) {
			break;
		}
		if (/^\|[\s|:-]+\|$/.test(trimmed)) {
			continue;
		}
		the_rows.push(trimmed.slice(1, -1).split("|").map((a_cell) => a_cell.trim()));
	}
	return the_rows;
}

/** A cell as a name: no backticks, no emphasis, no bold. */
function the_name_in(a_cell) {
	return a_cell.replace(/[`*]/g, "").trim();
}

/** A table read as a list of names, the first cell of every row being one.
 *
 * The first row of a markdown table is its headings, not a row of the domain, so it is
 * skipped: a stage called "Value" is what a table that forgot to skip its own header
 * produces, and the page would then print it.
 */
function the_names_of_a_table(in_text) {
	return the_rows_of_a_table(in_text)
		.slice(1)
		.map((a_row) => the_name_in(a_row[0]))
		.filter((a_name) => a_name.length > 0);
}

/** A table read as a list of `{ name, ... }`, one per row, keyed by its own headings. */
function the_rows_keyed_by_their_headings(in_text) {
	const the_rows = the_rows_of_a_table(in_text);
	if (the_rows.length < 2) {
		return [];
	}
	const the_headings = the_rows[0].map(the_name_in);
	return the_rows.slice(1).map((a_row) => {
		const one_row = {};
		the_headings.forEach((a_heading, where_it_is) => {
			one_row[a_heading] = a_row[where_it_is] ?? "";
		});
		return one_row;
	});
}

/** The stages the glossary names, which the code then has to agree with. */
export function read_the_stages_named_in_the_glossary(at) {
	return the_names_of_a_table(the_section_starting_with(the_text_of("docs/domain-glossary.md", at), "## The stages"));
}

/** The roles the glossary names, which the code then has to agree with. */
export function read_the_roles_named_in_the_glossary(at) {
	return the_names_of_a_table(the_section_starting_with(the_text_of("docs/domain-glossary.md", at), "## The roles"));
}

/** The agents the glossary names, with what each is for. The glossary is the only place this is written. */
export function read_the_agents_named_in_the_glossary(at) {
	return the_rows_keyed_by_their_headings(
		the_section_starting_with(the_text_of("docs/domain-glossary.md", at), "## The agents"),
	)
		.map((a_row) => ({
			name: the_name_in(a_row["Identifier"] ?? ""),
			responsibility: (a_row["Responsibility"] ?? "").replace(/[`*]/g, "").trim(),
		}))
		.filter((an_agent) => an_agent.name.length > 0);
}

/** The artifacts the glossary names, with who produces each and what it holds. */
export function read_the_artifacts_named_in_the_glossary(at) {
	return the_rows_keyed_by_their_headings(
		the_section_starting_with(the_text_of("docs/domain-glossary.md", at), "## The artifacts"),
	).map((a_row) => ({
		name: the_name_in(a_row["Artifact"] ?? ""),
		produced_by: the_name_in(a_row["Produced by"] ?? ""),
		contents: (a_row["Contents"] ?? "").replace(/[`*]/g, "").trim(),
	}));
}

/** The errors the glossary names, and what each one protects. */
export function read_the_errors_named_in_the_glossary(at) {
	return the_rows_keyed_by_their_headings(
		the_section_starting_with(the_text_of("docs/domain-glossary.md", at), "## The errors"),
	).map((a_row) => ({
		name: the_name_in(a_row["Error"] ?? ""),
		protects: (a_row["Protects"] ?? "").replace(/[`*]/g, "").trim(),
	}));
}

/** The deliveries the repository's own table lists, and what it says about who wrote each.
 *
 * The table is transposed: its columns are the deliveries and its rows are the
 * attributes, so a delivery's author is found by the row called "who wrote the
 * change" and the cell in that delivery's column. The pull request's own body is
 * asked separately in `read_github.mjs`, and the two answers are kept apart: one is
 * what the repository claims and one is what the pull request says.
 */
export function read_the_deliveries_the_repository_lists(at) {
	const the_section = the_section_starting_with(the_text_of("AGENTS.md", at), "## What has been delivered");
	const the_rows = the_rows_of_a_table(the_section);
	if (the_rows.length < 2) {
		throw new TheRepositoryDoesNotSayWhatThePageNeedsError(
			"the table of what has been delivered has no rows",
			"AGENTS.md, under 'What has been delivered'",
		);
	}

	const the_header = the_rows[0].map(the_name_in);
	const the_author_row = the_rows.find((a_row) => the_name_in(a_row[0]).startsWith("who wrote the change"));
	if (the_author_row === undefined) {
		throw new TheRepositoryDoesNotSayWhatThePageNeedsError(
			"the table of what has been delivered has no row saying who wrote the change",
			"AGENTS.md, under 'What has been delivered'",
		);
	}

	const the_deliveries = [];
	the_header.forEach((a_cell, where_it_is) => {
		const a_pull_request = /\[.*\]\((https:\/\/github\.com\/[^)]+\/pull\/\d+)\)/.exec(a_cell);
		if (a_pull_request === null) {
			return;
		}
		the_deliveries.push({
			url: a_pull_request[1],
			what_the_repository_says: (the_author_row[where_it_is] ?? "").replace(/[`*]/g, "").trim(),
		});
	});

	if (the_deliveries.length === 0) {
		throw new TheRepositoryDoesNotSayWhatThePageNeedsError(
			"no pull request is linked in the table of what has been delivered",
			"AGENTS.md, under 'What has been delivered'",
		);
	}
	return the_deliveries;
}

/** The phases, in the order the backlog lists them, with a struck-through slice marked done.
 *
 * A phase is marked done in the document by writing its name between two tildes, so
 * the tildes are read rather than a word being guessed at: "done" appears in a
 * backlog row about something that is *not* done.
 */
export function read_the_phases(at) {
	const the_rows = the_rows_of_a_table(the_section_starting_with(the_text_of("AGENTS.md", at), "## Backlog"));
	const the_phases = the_rows
		.slice(1)
		.map((a_row) => ({
			number: a_row[0]?.trim() ?? "",
			slice: a_row[1]?.trim() ?? "",
			gate: a_row[2]?.trim() ?? "",
			is_marked_done: /~~.+~~/.test(a_row[1] ?? ""),
		}))
		.filter((a_phase) => /^\d+$/.test(a_phase.number));
	if (the_phases.length === 0) {
		throw new TheRepositoryDoesNotSayWhatThePageNeedsError(
			"no numbered phase was found in the backlog",
			"AGENTS.md, under 'Backlog'",
		);
	}
	return the_phases;
}

/** The paths the repository names as not built, each with a checked verdict about whether it is there.
 *
 * The sentence is one paragraph, and it is quoted by the repository precisely so the
 * target shape is visible without being mistaken for existing code. So the page does
 * not decide which of the paths in it are really unbuilt: it looks for every one of
 * them on disk and prints the answer, which is how a path that turns out to exist gets
 * reported as existing rather than as missing.
 */
export function read_what_is_planned_and_not_yet_built(at) {
	const the_text = the_text_of("AGENTS.md", at);
	const the_lines = the_text.split("\n");
	const first = the_lines.findIndex((a_line) => a_line.includes("Planned and not yet built:"));
	if (first === -1) {
		throw new TheRepositoryDoesNotSayWhatThePageNeedsError(
			'no sentence beginning "Planned and not yet built:"',
			"AGENTS.md",
		);
	}

	const the_paragraph = [];
	for (const a_line of the_lines.slice(first)) {
		if (a_line.trim() === "") {
			break;
		}
		the_paragraph.push(a_line);
	}

	const the_named = [...the_paragraph.join(" ").matchAll(/`([^`]+)`/g)].map((a_match) => a_match[1]);
	if (the_named.length === 0) {
		throw new TheRepositoryDoesNotSayWhatThePageNeedsError(
			'the sentence "Planned and not yet built:" names nothing between backticks',
			"AGENTS.md",
		);
	}

	return the_named.map((a_path) => ({ named_as: a_path, exists_on_disk: existsSync(join(at, a_path)) }));
}

/** The commands the README shows, which is what a visitor may run and expect the page's numbers. */
export function read_the_commands_the_readme_gives(at) {
	const the_text = the_text_of("README.md", at);
	const the_blocks = [...the_text.matchAll(/```(\w*)\n([\s\S]*?)```/g)];
	if (the_blocks.length === 0) {
		throw new TheRepositoryDoesNotSayWhatThePageNeedsError(
			"no command block to run",
			"README.md",
		);
	}
	return the_blocks
		.map((a_block) => ({ language: a_block[1] || "sh", lines: a_block[2].replace(/\n$/, "").split("\n") }))
		.filter((a_block) => a_block.language === "bash" || a_block.language === "sh");
}

/** The Python the repository asks for, and the packages it depends on.
 *
 * Read with a pattern rather than a TOML parser because the two things the page shows
 * are both one line each, and a parser would be a dependency added to be certain of
 * something a pattern already states.
 */
export function read_the_stack(at) {
	const the_text = the_text_of("pyproject.toml", at);

	const the_python = /requires-python\s*=\s*"([^"]+)"/.exec(the_text);
	if (the_python === null) {
		throw new TheRepositoryDoesNotSayWhatThePageNeedsError(
			"no requires-python to say which Python it needs",
			"pyproject.toml",
		);
	}

	const the_dependencies_block = /\[project\.dependencies\]([\s\S]*?)(?=\n\[|\s*$)/.exec(the_text);
	const the_dependencies =
		the_dependencies_block === null
			? []
			: [...the_dependencies_block[1].matchAll(/^\s*"([^"]+)"\s*=\s*"([^"]+)"/gm)].map((a_match) => ({
					name: a_match[1],
					version: a_match[2],
				}));

	return { python: the_python[1], dependencies: the_dependencies };
}

/** The licence, named from the file itself rather than from what a badge would say. */
export function read_the_licence(at) {
	if (!existsSync(join(at, "LICENSE"))) {
		return { is_stated: false, name: null };
	}
	const the_first_line = readFileSync(join(at, "LICENSE"), "utf8").split("\n")[0].trim();
	return { is_stated: true, name: the_first_line.replace(/\s+Licence$/, "").trim() };
}

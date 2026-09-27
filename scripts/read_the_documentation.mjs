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

/** Whether a line is a markdown heading, at any level. */
const is_a_heading = (a_line) => /^#{1,6}\s/.test(a_line);

/** The words of a heading, without its hashes. */
const the_words_of = (a_heading) => a_heading.replace(/^#{1,6}\s+/, "").trim();

/** The lines of a section whose heading's words begin with a phrase, or nothing.
 *
 * Nothing rather than a refusal, because some sections are genuinely optional and a
 * caller has to be able to tell "this document says nothing about it" from "this
 * document is broken".
 */
export function the_section_if_there_is_one(the_text, what_the_heading_starts_with) {
	const lines = the_text.split("\n");
	const first = lines.findIndex(
		(a_line) => is_a_heading(a_line) && the_words_of(a_line).startsWith(what_the_heading_starts_with),
	);
	if (first === -1) {
		return null;
	}
	const rest = lines.slice(first + 1);
	const next = rest.findIndex(is_a_heading);
	return (next === -1 ? rest : rest.slice(0, next)).join("\n");
}

/** The lines of a section the page cannot do without, and a refusal when there is none. */
export function the_section_starting_with(the_text, what_the_heading_starts_with) {
	const the_section = the_section_if_there_is_one(the_text, what_the_heading_starts_with);
	if (the_section === null) {
		throw new TheRepositoryDoesNotSayWhatThePageNeedsError(
			`no heading beginning "${what_the_heading_starts_with}"`,
			"the document",
		);
	}
	return the_section;
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
	return the_names_of_a_table(the_section_starting_with(the_text_of("docs/domain-glossary.md", at), "The stages"));
}

/** The roles the glossary names, which the code then has to agree with. */
export function read_the_roles_named_in_the_glossary(at) {
	return the_names_of_a_table(the_section_starting_with(the_text_of("docs/domain-glossary.md", at), "The roles"));
}

/** The agents the glossary names, with what each is for. The glossary is the only place this is written. */
export function read_the_agents_named_in_the_glossary(at) {
	return the_rows_keyed_by_their_headings(
		the_section_starting_with(the_text_of("docs/domain-glossary.md", at), "The agents"),
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
		the_section_starting_with(the_text_of("docs/domain-glossary.md", at), "The artifacts"),
	).map((a_row) => ({
		name: the_name_in(a_row["Artifact"] ?? ""),
		produced_by: the_name_in(a_row["Produced by"] ?? ""),
		contents: (a_row["Contents"] ?? "").replace(/[`*]/g, "").trim(),
	}));
}

/** The errors the glossary names, and what each one protects. */
export function read_the_errors_named_in_the_glossary(at) {
	return the_rows_keyed_by_their_headings(
		the_section_starting_with(the_text_of("docs/domain-glossary.md", at), "The errors"),
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
	const the_section = the_section_starting_with(the_text_of("AGENTS.md", at), "What has been delivered");
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
	const the_rows = the_rows_of_a_table(the_section_starting_with(the_text_of("AGENTS.md", at), "Backlog"));
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

/** The lines of a TOML table, from `[name]` until the next table, or nothing.
 *
 * A TOML table and a markdown heading are different things that happen to both be a
 * labelled region of a document, and reading a `pyproject.toml` with a heading matcher
 * finds nothing in it at all. A file is read by the shape it actually has.
 */
function the_lines_of_a_toml_table(in_text, the_name_of_the_table) {
	const lines = in_text.split("\n");
	const first = lines.findIndex((a_line) => a_line.trim() === `[${the_name_of_the_table}]`);
	if (first === -1) {
		return null;
	}
	const rest = lines.slice(first + 1);
	const next = rest.findIndex((a_line) => a_line.trim().startsWith("["));
	return next === -1 ? rest : rest.slice(0, next);
}

/** The lines of an array inside some lines, from `name = [` until the line that closes it.
 *
 * The closing line is a line that *is* a bracket, not a line that has one somewhere in
 * it: `"psycopg[binary]>=3.0",` carries a closing bracket of its own, and a reader that
 * looks for the first one it sees ends the array three packages into eight and reports
 * the result as complete.
 */
function the_lines_of_an_array_named(in_these_lines, what_the_array_is_called) {
	const first = in_these_lines.findIndex((a_line) => a_line.trim().startsWith(`${what_the_array_is_called} = [`));
	if (first === -1) {
		return null;
	}
	const the_lines = [];
	for (const a_line of in_these_lines.slice(first + 1)) {
		if (a_line.trim() === "]") {
			break;
		}
		the_lines.push(a_line);
	}
	return the_lines;
}

/** The packages inside a TOML array, given the lines the array spans. */
function the_packages_in(lines) {
	return [...lines.join("\n").matchAll(/^\s*"([^"]+)"/gm)].map((a_match) => {
		const [the_name, the_version] = a_match[1].split(/[<>=!~ ]/);
		return { name: the_name, version: the_version };
	});
}

/** The Python the repository asks for, the packages it needs, and the extras it keeps aside.
 *
 * The extras are a separate list and not a footnote on the required one: the repository
 * deliberately keeps the graph and the model factory out of the default install so the
 * domain layer can be used without them, and a page that printed one flat list of
 * packages would say the opposite of what the project decided.
 *
 * Read with patterns rather than a TOML parser because the three things the page shows
 * are each one small table, and a parser would be a dependency added to be certain of
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

	const the_project_table = the_lines_of_a_toml_table(the_text, "project");
	const the_required = the_project_table === null ? null : the_lines_of_an_array_named(the_project_table, "dependencies");
	if (the_required === null) {
		throw new TheRepositoryDoesNotSayWhatThePageNeedsError(
			"no dependencies array in the [project] table",
			"pyproject.toml",
		);
	}

	const the_extras_table = the_lines_of_a_toml_table(the_text, "project.optional-dependencies");
	const the_extras = [];
	let a_group = null;
	for (const a_line of the_extras_table ?? []) {
		const a_group_name = /^\s*([a-z][a-z0-9_-]*)\s*=\s*\[/.exec(a_line);
		if (a_group_name !== null) {
			a_group = { name: a_group_name[1], packages: [] };
			the_extras.push(a_group);
			continue;
		}
		const a_package = /^\s*"([^"]+)"/.exec(a_line);
		if (a_package !== null && a_group !== null) {
			a_group.packages.push(a_package[1].split(/[<>=!~ ]/)[0]);
		}
	}

	return {
		python: the_python[1],
		dependencies: the_packages_in(the_required),
		optional_dependencies: the_extras,
	};
}

/** The licence, named from the file itself rather than from what a badge would say. */
export function read_the_licence(at) {
	if (!existsSync(join(at, "LICENSE"))) {
		return { is_stated: false, name: null };
	}
	const the_first_line = readFileSync(join(at, "LICENSE"), "utf8").split("\n")[0].trim();
	return { is_stated: true, name: the_first_line.replace(/\s+Licence$/, "").trim() };
}

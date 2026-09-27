/** Collect everything the page is allowed to say, and write it as one file of facts.
 *
 * **Nothing on the page is written by hand, and this is the only place that is
 * decided.** The page renders `src/state/the_repository.json` and nothing else, so a
 * fact that is not in that file cannot appear on the page, and a fact that is in it was
 * put there by a machine that read the repository.
 *
 * **The state file is written once, at the end, or not at all.** Every answer is
 * collected into one value first, so a collector that refuses halfway through leaves no
 * file behind — and a page built from half an answer is the failure this whole
 * arrangement exists to prevent.
 *
 * **The glossary is checked against the code, in both directions.** A document drifts,
 * and a stage or a role that the code no longer has but the prose still names is
 * exactly what a hand-maintained page is made of. So every stage and every role the
 * glossary names must exist in the code, and the refusal names the offender *and* what
 * the code does have, because a message naming only the offender leaves the reader to
 * work out which repository it is about.
 *
 * Run it the way the build runs it:
 *
 *     node scripts/ask_the_repository.mjs --clone --run-the-suite
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { read_the_deliveries, read_the_described_repository } from "./read_github.mjs";
import {
	read_the_agents_named_in_the_glossary,
	read_the_artifacts_named_in_the_glossary,
	read_the_commands_the_readme_gives,
	read_the_deliveries_the_repository_lists,
	read_the_errors_named_in_the_glossary,
	read_the_licence,
	read_the_phases,
	read_the_roles_named_in_the_glossary,
	read_the_stack,
	read_the_stages_named_in_the_glossary,
	read_what_is_planned_and_not_yet_built,
} from "./read_the_documentation.mjs";
import { read_the_history } from "./read_the_git_history.mjs";
import { read_the_suite, the_interpreter_to_run_the_suite_with } from "./read_the_suite.mjs";

/** A stage or a role the glossary names and the code does not have. */
export class TheRepositoryNamesSomethingItsCodeDoesNotHaveError extends Error {
	constructor(what_kind, the_name, what_the_code_has) {
		super(
			`the glossary names the ${what_kind} ${the_name}, and the code has only ` +
				`${what_the_code_has.map((a_name) => `${a_name}`).join(", ")}. A page that printed ` +
				`${the_name} would be describing a domain the repository does not have, and the ` +
				"glossary is the document that drifts rather than the code.",
		);
		this.name = "TheRepositoryNamesSomethingItsCodeDoesNotHaveError";
	}
}

/** The Python collector refused, and this is what it said. */
export class TheCodeCollectorRefusedError extends Error {
	constructor(why) {
		super(`the collector that reads the code refused, and said:\n${why}`);
		this.name = "TheCodeCollectorRefusedError";
	}
}

const here = dirname(fileURLToPath(import.meta.url));

/** Ask the Python collector what the code is, and refuse if it would not say. */
function read_the_domain_from_the_code(repository, how_to_run_python) {
	const the_answer = spawnSync(how_to_run_python, [join(here, "ask_the_code.py"), "--repository", repository], {
		encoding: "utf8",
	});
	if (the_answer.status !== 0) {
		throw new TheCodeCollectorRefusedError(the_answer.stderr);
	}
	return JSON.parse(the_answer.stdout);
}

/** Every stage and every role the glossary names has to be one the code has. */
function check_the_glossary_against_the_code(at, the_domain) {
	for (const a_stage of read_the_stages_named_in_the_glossary(at)) {
		if (!the_domain.stages.some((a_domain_stage) => a_domain_stage.name === a_stage)) {
			throw new TheRepositoryNamesSomethingItsCodeDoesNotHaveError(
				"stage",
				a_stage,
				the_domain.stages.map((a_domain_stage) => a_domain_stage.name),
			);
		}
	}
	for (const a_role of read_the_roles_named_in_the_glossary(at)) {
		if (!the_domain.roles.includes(a_role)) {
			throw new TheRepositoryNamesSomethingItsCodeDoesNotHaveError("role", a_role, the_domain.roles);
		}
	}
}

/** Each artifact the glossary names, with what the code actually has of it. */
function the_artifacts_with_what_the_code_has(the_declared, the_code_has) {
	return the_declared.map((an_artifact) => {
		const in_the_code = the_code_has.find((a_type) => a_type.name === an_artifact.name);
		return { ...an_artifact, exists_in_the_code: in_the_code !== undefined, declared_fields: in_the_code?.declared_fields ?? null };
	});
}

/** A fresh checkout of the branch, or the one already there brought up to date.
 *
 * **The clone is whole, and not one commit deep.** A shallow clone is the faster way to
 * get a build, and it reports a history of one commit — so the page would state a year of
 * work as a single commit, and the RED/GREEN counts would be zero of zero, with total
 * confidence. A number that is wrong because it was cheap to obtain is still wrong, and
 * this is the one place where the page invents a fact out of a build convenience.
 */
function the_checkout_of(where, the_address, ref) {
	if (!existsSync(where)) {
		const the_clone = spawnSync("git", ["clone", "--quiet", "--branch", ref, the_address, where], {
			encoding: "utf8",
		});
		if (the_clone.status !== 0) {
			throw new Error(`the repository could not be cloned from ${the_address} at ${ref}:\n${the_clone.stderr}`);
		}
		return where;
	}
	const the_update = spawnSync("git", ["fetch", "--quiet", "origin", ref], { cwd: where, encoding: "utf8" });
	if (the_update.status !== 0) {
		throw new Error(`the branch ${ref} could not be fetched:\n${the_update.stderr}`);
	}
	spawnSync("git", ["checkout", "--quiet", "FETCH_HEAD"], { cwd: where, encoding: "utf8" });
	spawnSync("git", ["fetch", "--quiet", "--unshallow"], { cwd: where, encoding: "utf8" });
	return where;
}

const defaults = {
	ref: "phase-1-foundation",
	out: "src/state/the_repository.json",
	// Asking GitHub needs a network, and a build that cannot be run without one is a
	// build that cannot be checked. So the API is asked only when it is named: the
	// default run of this repository's own tests reaches nothing, and a page built
	// without it says which fields are unread rather than leaving them absent.
	github_api: null,
	owner: "steamnoid",
	name: "ai-sdlc-os",
};

/** Everything the page may say, asked of the repository and of GitHub. */
export async function collect_everything(what_was_asked_for) {
	const the_owner = what_was_asked_for.owner ?? defaults.owner;
	const the_name = what_was_asked_for.name ?? defaults.name;
	const the_ref = what_was_asked_for.ref ?? defaults.ref;
	const the_api = what_was_asked_for.github_api ?? defaults.github_api;
	const the_repository = what_was_asked_for.repository
		? resolve(what_was_asked_for.repository)
		: the_checkout_of(
				join(process.cwd(), "build", "the-repository"),
				what_was_asked_for.from ?? `https://github.com/${the_owner}/${the_name}.git`,
				the_ref,
			);

	// A path on the command line names one place, and the collector runs programs from
	// two different working directories — reading the code from here, and the
	// repository's own suite from inside the repository. A relative path is resolved
	// once, where it was named, so that both uses look in the same place.
	const how_to_run_python = the_interpreter_to_run_the_suite_with(
		the_repository,
		what_was_asked_for.python ?? what_was_asked_for.suite_interpreter,
	);
	const the_domain = read_the_domain_from_the_code(the_repository, how_to_run_python);
	check_the_glossary_against_the_code(the_repository, the_domain);

	const the_history = read_the_history(the_repository);

	return {
		the_repository: {
			owner: the_owner,
			name: the_name,
			url: `https://github.com/${the_owner}/${the_name}`,
			on_disk: the_domain.the_repository_on_disk,
		},
		the_code_that_answered: the_domain.which_code_answered,
		the_build: {
			read_at: new Date().toISOString(),
			// A checkout of a fetched ref is detached, and git calls itself `HEAD`. The
			// branch that was asked for is the fact a reader wants, and the collector knows
			// it because it is the one that fetched it.
			branch: the_history.branch && the_history.branch !== "HEAD" ? the_history.branch : the_ref,
			tip_commit: the_history.tip_commit ?? null,
			was_cloned: what_was_asked_for.repository === undefined,
		},
		the_history,
		the_suite: read_the_suite(the_repository, {
			how_to_run_it: how_to_run_python,
			was_it_asked_for: what_was_asked_for.run_the_suite === true,
		}),
		the_domain: {
			stages: the_domain.stages,
			roles: the_domain.roles,
			transitions: the_domain.transitions,
			gates: the_domain.gates,
			agents: read_the_agents_named_in_the_glossary(the_repository),
			artifacts: the_artifacts_with_what_the_code_has(
				read_the_artifacts_named_in_the_glossary(the_repository),
				the_domain.artifacts,
			),
			errors: read_the_errors_named_in_the_glossary(the_repository),
		},
		phases: read_the_phases(the_repository),
		planned_and_not_yet_built: read_what_is_planned_and_not_yet_built(the_repository),
		deliveries: await read_the_deliveries(the_api, read_the_deliveries_the_repository_lists(the_repository)),
		the_github: await read_the_described_repository(the_api, the_owner, the_name),
		the_stack: read_the_stack(the_repository),
		the_licence: read_the_licence(the_repository),
		the_commands_the_readme_gives: read_the_commands_the_readme_gives(the_repository),
	};
}

/** The flags, read one at a time and refused when one is given a value it cannot take. */
function the_flags_in(process_arguments) {
	const a_flag_with_no_value = [
		"--clone",
		"--run-the-suite",
		"--help",
	];
	const what_was_asked_for = { run_the_suite: false, was_cloned: false };
	for (let where_it_is = 0; where_it_is < process_arguments.length; where_it_is += 1) {
		const the_argument = process_arguments[where_it_is];
		if (a_flag_with_no_value.includes(the_argument)) {
			if (the_argument === "--run-the-suite") {
				what_was_asked_for.run_the_suite = true;
			}
			if (the_argument === "--clone") {
				what_was_asked_for.was_cloned = true;
			}
			continue;
		}
		if (the_argument === "--help" || !the_argument.startsWith("--")) {
			continue;
		}
		const the_value = process_arguments[where_it_is + 1];
		if (the_value === undefined) {
			throw new Error(`${the_argument} was given no value.`);
		}
		what_was_asked_for[the_argument.slice(2).replace(/-/g, "_")] = the_value;
		where_it_is += 1;
	}
	return what_was_asked_for;
}

const usage = `Collect the state of a repository for the page to render.

    node scripts/ask_the_repository.mjs [--clone | --repository <path>] [options]

    --clone                  read a fresh checkout of --ref into build/the-repository
    --repository <path>      read the checkout that is already there
    --ref <branch>           the branch to read (default: ${defaults.ref})
    --from <address>         where to clone from (default: the repository on GitHub)
    --out <path>             where the state is written (default: ${defaults.out})
    --run-the-suite          run the repository's own tests and report what they said
    --python <program>       the interpreter to read the code and run the suite with
    --github-api <url>       the API to ask about pull requests and the repository
    --owner <name> --name <name>
                             the repository the page is about (default: ${defaults.owner}/${defaults.name})
`;

async function main() {
	const what_was_asked_for = the_flags_in(process.argv.slice(2));
	if (what_was_asked_for.help === true || process.argv.length === 2) {
		process.stdout.write(usage);
		return 0;
	}
	if (what_was_asked_for.was_cloned !== true && !what_was_asked_for.repository) {
		process.stderr.write(`${usage}\nnothing was asked for: pass --clone or --repository <path>.\n`);
		return 2;
	}

	const where_the_state_should_land = resolve(what_was_asked_for.out ?? defaults.out);
	const the_state = await collect_everything(what_was_asked_for);

	mkdirSync(dirname(where_the_state_should_land), { recursive: true });
	writeFileSync(where_the_state_should_land, `${JSON.stringify(the_state, null, "\t")}\n`);
	process.stdout.write(
		`read ${the_state.the_repository.name} at ${the_state.the_build.tip_commit} on ` +
			`${the_state.the_build.branch}, wrote ${where_the_state_should_land}\n`,
	);
	return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	process.exitCode = await main().catch((the_refusal) => {
		process.stderr.write(`${the_refusal.name ?? "Error"}: ${the_refusal.message}\n`);
		return 1;
	});
}

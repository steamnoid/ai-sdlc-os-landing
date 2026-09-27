# AGENTS.md — the page for `ai-sdlc-os`

**This repository is a view.** The page at
`steamnoid.github.io/ai-sdlc-os-landing` says things about another repository, and every
thing it says about that repository is read out of it by a program rather than typed by
a person. There is exactly one rule here, and the rest of this file is about how to keep
it.

## RULE — a fact is generated, or it is not on the page

> **Every fact about the project on this page is generated from the project. Anything
> written by hand is a claim about the world, and says so.**

The distinction is not a matter of taste. The previous page for a project of this kind
was written by hand, and within a fortnight it was listing a sixth role the project had
deleted, a number of specialists that no longer existed, and a set of phases that had
moved on — all of it looking perfectly correct to a reader.

**What is generated, and from where.**

| On the page | Read from |
|---|---|
| the stages, the roles, the table of legal moves | `import aisdlc` — the code, imported and printed |
| where a gate's answer leads | the router's own mapping |
| the agents, the artifacts, the errors | the glossary, which is the project's source of truth for naming |
| the test count, and the terminal block | the suite, run in the build, output byte for byte |
| the pull requests, and who wrote them | the pull requests' own API, read from their own bodies |
| the phase table, and what is not built | the project's `AGENTS.md`, between markers |
| the commits, and how the RED/GREEN pairing holds up | `git log` |
| the stack, the Python version, the licence | `pyproject.toml`, the `.python-version`, the `LICENSE` |
| the commands a visitor may run | the project's `README.md` |
| the CI status | the check runs on the tip commit — **including that there are none** |

**What is written by hand, and why that is allowed.** The pitch, the problem, and who to
write to. No test in the other repository could refute a sentence about why the work
matters, so generating it would be theatre. A *fact* can be refuted, and those are the
ones that get read.

## The three shapes a page gets wrong, and the tests for each

These are the whole reason this repository exists, so they are named here and held by
`test/`.

| It looks like | Which is not | Where it is decided | Where it is tested |
|---|---|---|---|
| green | a suite that printed a lot of passes | `src/page/what_the_page_says.mjs` | `test/what_the_page_says.test.mjs` |
| not run | a suite that failed | same | same |
| no history | a project with no commits | same | same |
| no workflow | a repository whose CI is green | same | same |
| unread | an answer of no | same | same |
| a claim | a finding — the two are kept apart | `scripts/read_github.mjs` | `test/the_page_cannot_say_what_the_repository_does_not_say.test.mjs` |

**The suite is green when it exited zero, and not when it passed a lot.** A run that
printed `1 failed, 449 passed` is a run that failed. A run that was never asked to run is
neither, and it says which flag would run it.

**A refusal is a value, not an absence.** Where a fact could not be read, the page says
so in words. A field that is simply missing on a page reads as a project with nothing to
report, which is the one thing a page about unfinished work must never do.

**The state file is written once, at the end, or not at all.** A collector that refuses
halfway through leaves nothing behind, so a page can never be built from half an answer.

## Working here

```bash
npm ci                     # note: `npm install` without the lockfile breaks `npm ci` in CI
npm test                   # the collectors' own tests, and a build of the page
npm run collect            # read the repository, run its suite, write the state
npm run build              # the page, from the state
npm run gate               # all three, in that order
```

**The default run of `npm test` reaches no network.** GitHub is asked only when
`--github-api` is named, and the page then says which fields it could not read. A build
that cannot be run offline cannot be checked.

**Read the working tree, or read what is published.** `--repository <path>` reads the
checkout you point at, which is what you want while you are changing the project.
`--clone --ref <branch>` reads the branch as everybody else sees it, which is what the
page is about.

## What not to do

- **Do not type a fact into `src/pages/index.astro`.** The test that catches it is
  `test/the_page_says_only_what_the_state_says.test.mjs`, and it caught three sentences
  the first time it ran — including "Two pull requests", written by the person who wrote
  the test.
- **Do not add a field to the state and print it raw.** Decide what it is allowed to say
  first, in `src/page/what_the_page_says.mjs`, and test that decision.
- **Do not make a missing document render as an empty section.** A document that has been
  reorganised is refused by name. An empty section reads as "nothing to report", which is
  the one answer a reorganised document gives by accident.
- **Do not reach for the network to make a test pass.** Inject the address; a test that
  needs a network is a test that was not run.
- **Do not clone one commit deep.** It is the fast way to get a build and it reports a
  history of one commit, so the page would state a year of work as a single commit in
  total confidence.

## The schedule is the fragile part

The page rebuilds every six hours so it cannot go stale quietly. GitHub documents two
things about that, and both are handled here and both are worth knowing before they
matter:

- **A schedule can be delayed, and under load some queued jobs are dropped.** Hence
  seventeen past rather than on the hour.
- **In a public repository, scheduled workflows are disabled after 60 days without
  repository activity.** A page that rebuilds itself never receives a commit, so its own
  mechanism is what would switch it off. The `keepalive` job pushes one empty commit
  once the silence passes 45 days — one a month, rather than two hundred a year.

If the page ever stops updating, check that job before anything else.

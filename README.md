# The page for [`ai-sdlc-os`](https://github.com/steamnoid/ai-sdlc-os)

**Live:** <https://steamnoid.github.io/ai-sdlc-os-landing>

This is a landing page for a project that lives somewhere else. That is the whole idea,
and it is not a formality — see below.

## The page is a view, not a description

Every fact about `ai-sdlc-os` on that page is read out of `ai-sdlc-os` by a program that
runs in the build. The stages and the table of legal moves are **imported from the code**.
The test count is **the result of running the suite**, and the terminal block on the page
is its output byte for byte. Who wrote a pull request comes from **that pull request's own
body**, not from the project's table about it. The phase table, the commands, the licence
and the commit history are read from the files that hold them.

The page reads the project every hour and **publishes only when a fact on it changed**, so
it cannot quietly become wrong and does not burn a deploy on an identical artifact. It
publishes the state it was built from, so every number on the page can be checked
against the file it came from.

## Why, when the obvious thing is to type it

The previous page for a project of this kind was written by hand. Within a fortnight it
was listing a sixth role the project had deleted, on the grounds that a handoff is not a
discipline, plus a number of specialists that no longer existed and a phase table that
had moved on. It looked perfectly correct the whole time. Nothing had failed; the page
had simply never been checked against anything.

So the three things a hand-written page gets wrong are the three things here, and each has
a test:

- **A suite that was never run is not a suite that passed**, and not one that failed
  either — it is a third thing, and it says which flag would run it.
- **A repository with no CI is not a repository whose checks passed.** The page prints
  what the API says about the tip commit, and that is currently: no workflow.
- **A call that could not be made leaves a field unread, not "no".** Rate limits and
  revoked tokens shorten the page instead of breaking it.

The suite is green only when it exited zero. A run that printed `1 failed, 449 passed`
is a run that failed, and the exit code is the only fact that settles it.

## How to work on it

```bash
npm ci                # the lockfile is committed; `npm ci` needs it
npm run collect       # read the repository, run its suite, write src/state/
nnpm test              # 52 tests, no network, and it builds the page
npm run build         # the page, from the state
npm run gate          # all of the above, in that order

# read the branch as everybody else sees it, which is what the page is about
npm run collect:published
```

```bash
# read a checkout you are working in — the developer's own loop
npm run collect

# read the branch as everybody else sees it, which is what the page is about,
# and which is what the build does
npm run collect:published
```

Both write `src/state/the_repository.json`, and **neither is ever committed**: the page
is built from what a run read, and a committed snapshot is a number nobody checked. The
first deployment of this page published last month's test count for exactly that reason,
and every step of the build reported success while it happened.

## How it is put together

```text
scripts/ask_the_code.py        imports the project's own code and prints what it declares
scripts/ask_the_repository.mjs the collector; writes one file of facts, or writes nothing
scripts/read_the_documentation.mjs   the glossary, the backlog, the README, pyproject
scripts/read_the_git_history.mjs     the branch, the commits, the RED/GREEN pairing
scripts/read_the_suite.mjs           runs the suite; green means the exit code
scripts/read_github.mjs              pull requests, check runs, and refusals kept as values
src/page/what_the_page_says.mjs      the only place a fact becomes a sentence
src/pages/index.astro                layout, and not one number
src/state/the_repository.json        the only bridge — a build artifact, never committed
```

`AGENTS.md` has the rules, the reason each one exists, and the things not to do.

## Licence

The code in this repository is under the licence in [`LICENSE`](LICENSE). The card a link
to the page shows is drawn by `scripts/draw_the_share_card.py` and deliberately contains
no numbers — a share card saying "485 tests" is a card that is wrong tomorrow.

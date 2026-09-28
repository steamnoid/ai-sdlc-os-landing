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

- **Do not commit `src/state/the_repository.json`.** It is a build artifact, and the
  first deployment published a stale one precisely because it was there to be used.
- **A card is a link, not a link in a card.** Where a thing on the page is worth
  pressing — a delivery, an artifact, a commit — the whole thing is the anchor, and it
  says so in words. A link on a two-character `#2` in a corner is the least findable
  place it can be, clickability that only appears on hover does not exist on a touch
  screen, and an anchor inside an anchor is invalid HTML that browsers resolve by
  breaking the inner one. `test/the_page_says_only_what_the_state_says.test.mjs` counts
  `href` attributes rather than URLs, because the project's own backlog quotes a pull
  request's address as text and a test that cannot tell the difference fails for a
  reason that has nothing to do with what it is checking.
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

## The schedule is the fragile part, and it kept proving it

The page is rebuilt on a schedule and on every push, and publishes only when a fact on it
changed. **Do not promise a rhythm on it, in the page or in this file.** GitHub's
`schedule` event is documented as best-effort, and this repository watched it stop being
hourly: the runs came every 3.4 hours, then 4.7, then 6.1, then not at all for 8.4, while
the project it describes took three commits an hour. The page said "every hour" for a day
and was wrong for most of it. `test/the_page_says_only_what_the_state_says.test.mjs` now
refuses the words, because a page whose argument is that its numbers were read cannot
describe a cadence it has no way to check.

**What the schedule is allowed to promise: nothing, and what it is given instead is the
time.** The commit in the hero is printed next to when the project was read, and a test
holds them within 200 characters of each other, because a commit from six hours ago looks
exactly like one from six minutes ago.

**What is deliberately not done: publishing when nothing changed, to look alive.** That
would move the timestamp and leave the numbers stale, which is the opposite of what a
timestamp is for. A page that says it was read six hours ago and means it is worth more
than one that says a minute ago and was not.

Two more things about the schedule, both handled and both worth knowing before they matter:

- **Under load some queued jobs are dropped.** Seventeen past rather than on the hour
  addresses the tip of that and not the queue, which is what this repository learned the
  hard way; the rest is left to the `push` trigger, which is immediate and does not queue.
- **In a public repository, scheduled workflows are disabled after 60 days without
  repository activity.** A page that reads and publishes on a schedule never receives a
  commit, so its own mechanism is what would switch it off. The `keepalive` job pushes
  one empty commit once the silence passes 45 days — one a month, rather than two
  hundred a year.

**If a page here ever needs to be fresh within the hour, cron is the wrong trigger** and
`repository_dispatch` from the project is the right one. That costs a secret, which is
why it is not the default, and the trade should be made deliberately rather than by
picking the free trigger and calling it an hour.

## Publishing only what changed

A run that finds the project exactly where it was would otherwise publish a
byte-identical artifact four times a day, so the build and deploy steps are skipped
when nothing changed. Two things about that rule are easy to get wrong, and both are
held by tests in `test/skipping_the_build.test.mjs`:

- **Do not key the skip on the project's commit.** The project stands still, a template
  is fixed, and the page keeps the old template for ever. The state therefore carries
  `the_build.page_code_commit` beside `tip_commit` — *what was read* and *what rendered
  it* — and one comparison covers both.
- **Do not compare `the_build.read_at` or `the_build.was_cloned`.** They differ on every
  run by definition, and a comparison that always finds a difference skips nothing at
  all, which is the same as having no comparison.

**A state that cannot be read is a change, never agreement.** A site with nothing
published yet, a 404, a rate limit — every one of those means the comparison did not
happen, and it must not be reported as "no change". Publishing again is cheap and being
wrong is not.

**The state is published because the page's claim should be checkable.** It is copied
into the build by a hook in `astro.config.mjs` rather than by a step in the workflow, so
that a developer's `npm run build` and a CI run produce the same artifact — which they
did not, when it was a workflow step.

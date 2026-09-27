import { strict as assert } from "node:assert";
import { test } from "node:test";

import { what_differs_between } from "../scripts/compare_the_states.mjs";

/** A state, small and explicit, so each test is about one fact. */
function a_state(overrides = {}) {
	return {
		the_build: {
			read_at: "2026-09-27T05:00:00.000Z",
			branch: "phase-1-foundation",
			tip_commit: "13325ba",
			was_cloned: true,
			page_code_commit: "aaaaaaa",
			...overrides.the_build,
		},
		the_suite: { was_run: true, is_green: true, passed: 485, deselected: 63, ...overrides.the_suite },
		the_history: { is_a_git_repository: true, commits: [{ commit: "13325ba" }], ...overrides.the_history },
		the_github: { stars: 0, check_runs: { count: 0 }, ...overrides.the_github },
		...overrides.the_rest,
	};
}

test("two states read a minute apart are the same state, because when it was read is not a fact", () => {
	const the_first = a_state();
	const the_second = a_state({ the_build: { read_at: "2026-09-27T05:01:00.000Z" } });

	assert.deepEqual(what_differs_between(the_second, the_first), []);
	// A comparison that reports nothing at all passes this test, so each of the two
	// "is not a change" tests carries a difference that *is* one. Without that, a
	// broken comparison is indistinguishable from a permissive one.
	assert.deepEqual(what_differs_between(a_state({ the_suite: { passed: 1 } }), the_first), ["the_suite.passed"]);
});

test("a checkout handed over and a checkout cloned are the same state", () => {
	const the_first = a_state({ the_build: { was_cloned: true } });
	const the_second = a_state({ the_build: { was_cloned: false } });

	assert.deepEqual(
		what_differs_between(the_second, the_first),
		[],
		"whether the machine fetched the project or was handed it is a fact about the machine, and it is skipping the build every hour",
	);
	assert.deepEqual(what_differs_between(a_state({ the_suite: { passed: 1 } }), the_first), ["the_suite.passed"]);
});

test("a different test count is a change, and it says which fact", () => {
	const the_first = a_state();
	const the_second = a_state({ the_suite: { passed: 486 } });

	assert.deepEqual(what_differs_between(the_second, the_first), ["the_suite.passed"]);
});

test("a different commit on the project is a change, all the way down a list", () => {
	const the_first = a_state();
	const the_second = a_state({ the_history: { commits: [{ commit: "6d0f68c" }] } });

	assert.deepEqual(what_differs_between(the_second, the_first), ["the_history.commits.0.commit"]);
});

test("a different commit on the page's own code is a change, because the template is what renders it", () => {
	// The project did not move. A template was fixed, and the page would have kept the
	// old template for ever if only the project's commit were compared — which is the
	// whole reason the state carries this field.
	const the_first = a_state({ the_build: { page_code_commit: "aaaaaaa" } });
	const the_second = a_state({ the_build: { page_code_commit: "bbbbbbb" } });

	assert.deepEqual(what_differs_between(the_second, the_first), ["the_build.page_code_commit"]);
});

test("stars are a change, because the page prints them and a repository gains one without a commit", () => {
	const the_first = a_state();
	const the_second = a_state({ the_github: { stars: 1 } });

	assert.deepEqual(what_differs_between(the_second, the_first), ["the_github.stars"]);
});

test("a fact that appeared where there was none is a change", () => {
	const the_first = a_state();
	const second_without_it = a_state();
	delete second_without_it.the_github.stars;

	assert.deepEqual(what_differs_between(second_without_it, the_first), ["the_github.stars"]);
});

test("a fact that vanished is a change too, and not a crash", () => {
	const the_first = a_state();
	const the_second = a_state();
	delete the_second.the_suite.passed;

	assert.deepEqual(what_differs_between(the_second, the_first), ["the_suite.passed"]);
});

test("the order of the differences is the same every time, so a diff reads the same twice", () => {
	const the_first = a_state();
	const the_second = a_state({ the_suite: { passed: 1 }, the_github: { stars: 9 } });

	const one_way = what_differs_between(the_second, the_first);
	const the_other_way = what_differs_between(the_first, the_second);

	assert.deepEqual(one_way, the_other_way, "which state is treated as new changed the answer, so a reader cannot compare two runs");
	assert.deepEqual(one_way, ["the_github.stars", "the_suite.passed"]);
});

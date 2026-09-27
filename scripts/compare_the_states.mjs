/** What differs between the state just read and the state the live page was built from.
 *
 * The shape of the answer, and nothing decided yet. What counts as a change, and what
 * does not, is what the tests in `test/skipping_the_build.test.mjs` are about.
 */

/** The paths whose values are not the same in both states, in a stable order. */
export function what_differs_between(the_new_state, the_published_state) {
	return [];
}

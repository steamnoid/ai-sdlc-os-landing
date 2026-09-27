/** What differs between the state just read and the state the live page was built from.
 *
 * **Two fields are ignored, and both are about the run rather than about the project.**
 * `read_at` is when this build looked, and it is different on every run by definition;
 * `was_cloned` says whether this machine fetched the project or was handed a checkout,
 * which is a fact about the machine. Comparing either would make every run report a
 * change, and a build that is never skipped is the same as having no comparison at all.
 *
 * **The comparison is a deep walk, not a list of watched fields.** A watched list is a
 * list that goes stale: a field nobody added to it is silently ignored, and the page is
 * then published from facts nobody compared. Walking both states means a new fact is
 * compared the moment it exists, and a fact that nobody thought to watch cannot be
 * quietly stale on a page whose whole argument is that it is not.
 *
 * **The comparison is symmetric.** Which state is treated as the new one changes nothing,
 * because two runs' answers are meant to be diffed against each other, and an order that
 * depended on the argument would make that diff depend on the order the runs are read in.
 */

/** The two fields about this run rather than about the project, which never count as a change. */
const ABOUT_THE_RUN_AND_NOT_THE_PROJECT = ["the_build.read_at", "the_build.was_cloned"];

/** Every leaf in a state, as the path to it and its value. A missing key is its own leaf. */
function every_leaf_of(a_state, a_path = []) {
	if (a_state === null || typeof a_state !== "object") {
		return [{ path: a_path, value: a_state }];
	}
	if (Array.isArray(a_state)) {
		return a_state.flatMap((an_entry, where_it_is) => every_leaf_of(an_entry, [...a_path, where_it_is]));
	}
	return Object.entries(a_state).flatMap(([a_key, a_value]) => every_leaf_of(a_value, [...a_path, a_key]));
}

/** The value at a dotted path, or `undefined` for a path this state does not have. */
function the_value_at(a_state, a_dotted_path) {
	return a_dotted_path.split(".").reduce((a_thing, a_part) => (a_thing === null ? undefined : a_thing?.[a_part]), a_state);
}

/** The paths whose values are not the same in both states, in one order whatever the order of the arguments. */
export function what_differs_between(the_first_state, the_second_state) {
	const the_paths = [
		...new Set([...every_leaf_of(the_first_state), ...every_leaf_of(the_second_state)].map((a_leaf) => a_leaf.path.join("."))),
	];

	return the_paths
		.filter((a_dotted_path) => !ABOUT_THE_RUN_AND_NOT_THE_PROJECT.includes(a_dotted_path))
		.filter((a_dotted_path) => !Object.is(the_value_at(the_first_state, a_dotted_path), the_value_at(the_second_state, a_dotted_path)))
		.sort();
}

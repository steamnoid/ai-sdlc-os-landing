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

/** The fields about this run or this machine, which never count as a change.
 *
 * `read_at` is when this build looked and differs on every run by definition;
 * `was_cloned` and the two paths say where this machine kept things. Comparing any of
 * them would make every run report a change, and a build that is never skipped is the
 * same as having no comparison at all.
 */
const ABOUT_THE_RUN_AND_NOT_THE_PROJECT = [
	"the_build.read_at",
	"the_build.was_cloned",
	"the_repository.on_disk",
	"the_code_that_answered",
];

/** How one field is read before it is compared, where reading it is what makes it a fact.
 *
 * The terminal block ends in the wall clock — `485 passed, 63 deselected in 4.72s` — so
 * two runs of the same suite differ in the last word, every time, forever. The timing is
 * removed and the rest is compared exactly, because the rest is the suite's verdict in
 * its own words: a failure that moved, or a line that appeared, has to reach the page.
 */
const HOW_A_FIELD_IS_READ = {
	"the_suite.what_it_printed": (a_value) =>
		typeof a_value === "string" ? a_value.replace(/in \d+\.\d+s/g, "in some number of seconds") : a_value,
};

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

/** Two values as this field's comparison reads them. */
function the_two_readings_of(a_dotted_path, the_first_state, the_second_state) {
	const how_it_is_read = HOW_A_FIELD_IS_READ[a_dotted_path] ?? ((a_value) => a_value);
	return [
		how_it_is_read(the_value_at(the_first_state, a_dotted_path)),
		how_it_is_read(the_value_at(the_second_state, a_dotted_path)),
	];
}

/** The paths whose values are not the same in both states, in one order whatever the order of the arguments. */
export function what_differs_between(the_first_state, the_second_state) {
	const the_paths = [
		...new Set([...every_leaf_of(the_first_state), ...every_leaf_of(the_second_state)].map((a_leaf) => a_leaf.path.join("."))),
	];

	return the_paths
		.filter((a_dotted_path) => !ABOUT_THE_RUN_AND_NOT_THE_PROJECT.includes(a_dotted_path))
		.filter((a_dotted_path) => {
			const [the_first_value, the_second_value] = the_two_readings_of(a_dotted_path, the_first_state, the_second_state);
			return !Object.is(the_first_value, the_second_value);
		})
		.sort();
}

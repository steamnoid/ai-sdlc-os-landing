// @ts-check
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

const the_repository = 'steamnoid/ai-sdlc-os';
const where_the_state_lives = 'src/state/the_repository.json';

/**
 * Copy the state the page was built from next to the page.
 *
 * **Two reasons, and the second is the one that broke.** A reader can check the numbers
 * on the page against the state they came from — which turns the page's argument from a
 * claim into a check. And the next run can ask the live site what is already published,
 * so deciding whether to skip a build needs no previous run, no token and no
 * deployment history.
 *
 * **This is a build hook rather than a step in the workflow.** A step in the workflow
 * runs in CI and nowhere else, so a developer's `npm run build` produced a site without
 * the file while CI produced one with it — and the two were then different artifacts
 * called by the same name. The hook runs in both, so there is one artifact.
 */
const publish_the_state = {
	name: 'publish-the-state',
	hooks: {
		'astro:build:done': async ({ dir, logger }) => {
			if (!existsSync(where_the_state_lives)) {
				// A missing state is refused by the collectors, so reaching here means the
				// state was never read — and publishing without it would produce a page
				// whose own provenance is absent.
				logger.warn(
					`no state at ${where_the_state_lives}, so it was not published. Run \`npm run collect\` before building.`,
				);
				return;
			}
			copyFileSync(where_the_state_lives, join(dir.pathname ?? dir, 'the_repository.json'));
			logger.info(`published the_repository.json from ${the_repository}`);
		},
	},
};

export default defineConfig({
	site: 'https://steamnoid.github.io',
	base: '/ai-sdlc-os-landing',
	build: { format: 'file' },
	integrations: [publish_the_state],
	vite: {
		plugins: [tailwindcss()],
	},
});

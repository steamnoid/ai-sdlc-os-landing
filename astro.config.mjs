// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// The repository this page is a view of. It is a value rather than a string
// scattered through the page, so that one file says which project is described.
const the_repository = 'steamnoid/ai-sdlc-os';

export default defineConfig({
	site: 'https://steamnoid.github.io',
	base: '/ai-sdlc-os-landing',
	build: { format: 'file' },
	vite: {
		plugins: [tailwindcss()],
	},
});

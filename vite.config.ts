import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	build: {
		// Three.js itself is ~600 kB; the warning at 500 kB is noise.
		chunkSizeWarningLimit: 1024,
	},
});

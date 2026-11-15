import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// De site gebruikt relatieve paden en adressen achter een hekje (#/p/naam).
// Daardoor werkt dezelfde build op een eigen domein, onder een pad achter een proxy en op GitHub Pages.
export default defineConfig({
	root: fileURLToPath(new URL('.', import.meta.url)),
	base: './',
	plugins: [vue()],
	build: {
		outDir: fileURLToPath(new URL('../dist/web', import.meta.url)),
		emptyOutDir: true,
	},
	server: {
		port: 5173,
		proxy: { '/api': 'http://127.0.0.1:3000' },
		fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
	},
});

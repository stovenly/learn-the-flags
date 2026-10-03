import { defineConfig } from 'vite';
import site from './site.config.json' with { type: 'json' };

export default defineConfig({
  base: './',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
  plugins: [
    {
      name: 'site-config',
      transformIndexHtml: (html) => html.replace(/\{\{(\w+)\}\}/g, (_, k: keyof typeof site) => site[k] ?? ''),
    },
  ],
});

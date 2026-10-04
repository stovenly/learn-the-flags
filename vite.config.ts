import { defineConfig } from 'vite';
import site from './site.config.json' with { type: 'json' };

export default defineConfig({
  base: new URL(site.siteUrl).pathname,
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
  plugins: [
    {
      name: 'site-config',
      transformIndexHtml: (html) =>
        html.replace(/\{\{(\w+)\}\}/g, (_, k: string) => (k === 'base' ? new URL(site.siteUrl).pathname : (site[k as keyof typeof site] ?? ''))),
    },
  ],
});

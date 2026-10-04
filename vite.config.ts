import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import site from './site.config.json' with { type: 'json' };

// Paths are relative to a <base> tag, so the site works at "/" or under any sub-path (a GitHub project page).
// The dev server always serves from "/"; build-pages.mjs points each generated page's <base> back to the site root.
export default defineConfig(({ command }) => ({
  base: './',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
  plugins: [
    {
      name: 'site-config',
      transformIndexHtml: (html) =>
        html
          .replace('<head>', `<head>\n    <base href="${command === 'serve' ? '/' : './'}">`)
          .replace(/\{\{(\w+)\}\}/g, (_, k: string) => site[k as keyof typeof site] ?? ''),
      // Like GitHub Pages' 404.html: unknown paths get the app, rooted at "/", so it can show "Not found".
      configurePreviewServer(server) {
        server.middlewares.use((req, res, next) => {
          if (existsSync(path.join('docs', decodeURIComponent((req.url ?? '/').split('?')[0])))) return next();
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/html');
          res.end(readFileSync('docs/index.html', 'utf8').replace(/<base href="[^"]*">/, '<base href="/">'));
        });
      },
    },
  ],
}));

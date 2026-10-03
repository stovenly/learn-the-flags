# Learn the Flags

A free static web app for memorizing every sovereign flag in the world: the 193 UN member states, the two UN observer states (Vatican City and Palestine), and optionally Kosovo and Taiwan.

Live site: https://stovenly.github.io/learn-the-flags/

Learners get short daily lessons and reviews. Under the hood:

- **FSRS-6 spaced repetition** decides when each flag comes back, aiming at roughly 90% recall at review time.
- **Active recall** questions get harder as a memory gets stronger: pick the name, pick the flag, then type the name.
- **Successive relearning** brings a missed flag back later in the same session until it is answered correctly.
- **Lookalike contrast**: similar flags (Chad and Romania, Indonesia and Monaco) are introduced side by side and used as each other's wrong answers. Lookalikes are hand-curated, then extended by pixel similarity.
- **Memory hooks** give every flag a one-line way to remember it.

Progress is kept in the browser's `localStorage`. Settings can export and import it.

## Development

```sh
npm install
npm run dev      # build data, start Vite dev server
npm run build    # build data, typecheck, build the site into docs/
```

GitHub Pages serves the `docs/` folder on `main`. Commit `docs/` after building.

## Editing countries

Each country is one file in `data/countries/<iso-alpha-2>.json`. That file is the source of truth for names, accepted answers (`aliases`), facts, the flag description, the memory hook, curated `lookalikes` and trivia.

- **Change content:** edit the JSON, then run `npm run build`.
- **Flag redesigned:** `node scripts/fetch-flags.mjs <code> --force` downloads the new image. Then update `flag.description` and `flag.adopted`.
- **New country:** `node scripts/add-country.mjs <code>` creates a skeleton with base facts. Fill in the content fields, run `npm run flags`, then build.
- **Remove a country:** delete its JSON file and its images in `public/img/flags/*/`.
- **Recognition status:** `status` is one of `un-member`, `un-observer` or `partially-recognized`. Partially recognized states are left out of lessons unless the learner opts in.

`npm run build` validates every file and fails on unknown colours, broken lookalike codes or missing images.

## Other scripts

- `scripts/build-assets.mjs` re-renders the favicon, the touch icon and the `og.png` social preview.
- `scripts/build-pages.mjs` runs as part of the build. It writes a static, crawlable page per country (`docs/flags/<slug>/`), the flag index, `sitemap.xml` and `robots.txt`.
- `site.config.json` holds the site URL, name and description used for SEO tags.

Flag images come from Wikimedia Commons via [flagcdn.com](https://flagcdn.com) and are public domain. Base country facts come from [mledoze/countries](https://github.com/mledoze/countries) (ODbL), and population figures from the World Bank.

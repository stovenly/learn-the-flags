# Learn the Flags

A free static web app for memorizing flags: every sovereign state (the 193 UN members plus Vatican City and Palestine), US states, Canadian provinces and territories, territories and dependencies, states with limited recognition, iconic historical flags and international organizations.

Live site: https://stovenly.github.io/learn-the-flags/

Learners get short daily lessons and reviews. Under the hood:

- **FSRS-6 spaced repetition** decides when each flag comes back, aiming at roughly 90% recall at review time.
- **Active recall** questions get harder as a memory gets stronger: pick the name, pick the flag, then type the name. A new flag's second check in a lesson is already typed.
- **Successive relearning** brings a missed flag back later in the same session until it is answered correctly.
- **Lookalike contrast**: similar flags (Chad and Romania, Indonesia and Monaco) are introduced side by side, explained ("how to tell them apart") and used as each other's wrong answers. Wrong answers are also drawn from pixel-similar flags.
- **Memory hooks** give every flag a one-line way to remember it.

Progress is kept in the browser's `localStorage`. Settings can export and import it.

## Development

```sh
npm install
npm run dev      # build data, start Vite dev server
npm run build    # build data, typecheck, build the site into docs/
```

GitHub Pages serves the `docs/` folder on `main`. Commit `docs/` after building.

The app uses clean URLs (`/flags/texas/`, `/progress/`). Every page carries a `<base>` tag pointing at the site root, so the same build works at `/` (http://localhost:5173/ for `npm run dev`, http://localhost:4173/ for `npm run preview`) or under a sub-path such as a GitHub project page. Static hosting can't rewrite unknown paths to the app, so the build writes a copy of the app shell for every route (`flags/<slug>/`, `progress/`, …) and a `404.html` whose `<base>` is the path of `siteUrl`. Old `#/` links are redirected on load.

## Editing flags

Flags are grouped into sets, listed in `data/sets.json` (id, display name, the noun used in questions, a description, a cover flag and an optional curated learning order). Learners pick one set to learn new flags from; the sovereign set can be narrowed to continents. Reviews always cover every flag already started.

Each flag is one file in `data/flags/<set>/<code>.json`. Sovereign states use their ISO alpha-2 code; others use ISO 3166-2 (`us-tx`, `ca-on`, `gb-sct`) or a readable code (`ussr`, `nato`). That file is the source of truth for names (`name`, `officialName`, and `endonyms`: the place's own name in its languages, first one shown on its page), accepted answers (`aliases`), facts, the flag description, the memory hook, curated `lookalikes` and trivia. Optional fields:

- `image`: a Wikimedia Commons file name to download the flag from (otherwise flagcdn.com by code).
- `facts`: extra `[label, value]` quick facts.
- `shape`: what the map highlights. Omitted means the place itself; a list of codes highlights their union (the Soviet Union, the EU); `false` means no map.
- `identical`: codes of flags with the same design (Czechoslovakia and Czechia), never offered as each other's wrong answer.
- `slug`: a URL slug when the name would clash (`georgia-us-state`).

Workflow:

- **Change content:** edit the JSON, then run `npm run build`.
- **Flag redesigned:** `node scripts/fetch-flags.mjs <code> --force` downloads the new image. Then update `flag.description` and `flag.adopted`.
- **New sovereign state:** `node scripts/add-country.mjs <code>` creates a skeleton with base facts. Fill in the content fields, run `npm run flags`, then build.
- **New flag in another set:** copy a file from that set, edit it, run `npm run flags`, then build.
- **Remove a flag:** delete its JSON file and its images in `public/img/flags/*/`.

Lookalike pairs live in `data/lookalikes/*.json`, keyed by the two codes in sorted order joined by `|` (`"id|mc"`), with one or two sentences on how to tell the flags apart. A pair is shown as a lookalike for both flags. Lookalikes must be in the same set, or one of the two must be a sovereign state; a sovereign state's page only lists sovereign lookalikes.

`npm run build` validates every file and fails on unknown colours, broken or cross-set lookalike codes, clashing slugs or missing images.

## Other scripts

- `scripts/build-assets.mjs` re-renders the favicon, the touch icon and the `og.png` social preview.
- `scripts/build-maps.mjs` runs as part of the build. It renders `img/maps/<code>.svg`: a regional map zoomed on each flag's place with it highlighted and labelled, neighbours labelled with their name and flag where they fit, and a locator globe inset. `img/maps/plain/` has the same maps without flags, used on "Which is the flag of…" questions so the map does not give options away. Countries come from Natural Earth via `world-atlas`, matched by `isoNumeric` or name.
- `scripts/fetch-geo.mjs` writes `data/geo/extra.json`, the outlines `world-atlas` lacks (US states, Canadian provinces, the UK's nations, breakaway states), from Natural Earth 10m. Run it only to change that list.
- `scripts/build-pages.mjs` runs as part of the build. It copies the built app shell to every route, so each URL loads directly, and pre-fills each flag page and the flag index with crawlable content and meta tags (hidden once the app runs). It also writes `404.html`, `sitemap.xml` and `robots.txt`.
- `site.config.json` holds the site URL, name and description used for SEO tags.

Flag images come from Wikimedia Commons, directly or via [flagcdn.com](https://flagcdn.com). Map outlines come from [Natural Earth](https://www.naturalearthdata.com) (public domain). Base country facts come from [mledoze/countries](https://github.com/mledoze/countries) (ODbL), and population figures from the World Bank.

// After `vite build`: copies the app shell to every route so clean URLs load on static hosting, pre-filled with
// crawlable content and meta tags on each flag page and the flag index; also writes 404.html, sitemap and robots.txt.
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs');
const site = JSON.parse(await fs.readFile(path.join(ROOT, 'site.config.json'), 'utf8'));
const countries = JSON.parse(await fs.readFile(path.join(ROOT, 'src/generated/countries.json'), 'utf8'));
const sets = JSON.parse(await fs.readFile(path.join(ROOT, 'src/generated/sets.json'), 'utf8'));
const setName = Object.fromEntries(sets.map((s) => [s.id, s.name]));
const byCode = new Map(countries.map((c) => [c.code, c]));
const CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'];
const template = await fs.readFile(path.join(OUT, 'index.html'), 'utf8');
const today = new Date().toISOString().slice(0, 10);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const fmtPop = (n) => (n == null ? '' : n >= 1e9 ? `${(n / 1e9).toFixed(2)} billion` : n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)} million` : n.toLocaleString('en-US'));
const STATUS = { 'un-observer': 'UN observer state' };

function meta(html, attr, key, value) {
  const re = new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`);
  if (!re.test(html)) throw new Error(`index.html has no ${attr}="${key}" meta tag`);
  return html.replace(re, (_, a, b) => a + esc(value) + b);
}

// The built index.html with this page's title, meta tags and (optionally) pre-filled #app content.
function shell(route, { title, description, image, type = 'website', jsonld, body = '', noindex = false }) {
  const canonical = site.siteUrl + route;
  let html = template.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
  html = meta(html, 'name', 'description', description);
  html = meta(html, 'property', 'og:title', title);
  html = meta(html, 'property', 'og:description', description);
  html = meta(html, 'property', 'og:url', canonical);
  html = meta(html, 'property', 'og:type', type);
  html = meta(html, 'name', 'twitter:title', title);
  html = meta(html, 'name', 'twitter:description', description);
  if (image) {
    html = meta(html, 'property', 'og:image', image);
    html = meta(html, 'name', 'twitter:image', image);
  }
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${canonical}$2`);
  if (noindex) html = html.replace('</title>', '</title>\n    <meta name="robots" content="noindex">');
  if (jsonld) html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>`);
  if (body) html = html.replace(/(<main id="app"[^>]*>)[\s\S]*?(<\/main>)/, `$1<div class="prerendered">${body}</div>$2`);
  return html;
}

// Each page's <base> points back to the site root, so relative links and assets work at any depth.
const rooted = (html, base) => html.replace(/<base href="[^"]*">/, `<base href="${base}">`);

async function write(route, html) {
  await fs.mkdir(path.join(OUT, route), { recursive: true });
  await fs.writeFile(path.join(OUT, route, 'index.html'), rooted(html, '../'.repeat(route.split('/').filter(Boolean).length) || './'));
}

const endonymLine = (c) => c.endonym;
const flagHref = (c) => `flags/${c.slug}/`;
const img = (c, size = 640) =>
  `<img class="flag flag-${size === 320 ? 'sm' : 'lg'}" src="img/flags/${size}/${c.code}.webp" width="640" height="${Math.round(640 / c.ratio)}" alt="Flag of ${esc(c.theName)}" style="--ratio:${c.ratio}"${size === 320 ? ' loading="lazy"' : ''} decoding="async">`;
const tile = (c) => `<a class="tile" href="${flagHref(c)}"><div class="tile-flag">${img(c, 320)}</div><span class="tile-name">${esc(c.name)}</span></a>`;

for (const c of countries) {
  const looks = c.lookalikes.map((k) => byCode.get(k)).filter(Boolean);
  const facts = [
    ...c.facts,
    [c.set === 'organizations' ? 'Headquarters' : 'Capital', c.capital],
    ['Region', c.subregion || c.region],
    ['Population', fmtPop(c.population)],
    ['Area', c.area ? `${Math.round(c.area).toLocaleString('en-US')} km²` : ''],
    ['Languages', c.languages.join(', ')],
    ['Currency', c.currencies.map((x) => (x.symbol && x.symbol !== x.code ? `${x.name} (${x.symbol})` : x.name)).join(', ')],
    ['Flag adopted', c.flag.adopted],
  ].filter(([, v]) => v);
  const body = `
<article>
<div class="card">${img(c)}</div>
<h1>Flag of ${esc(c.theName)}</h1>
${c.officialName && c.officialName !== c.name ? `<p class="official-name"><span class="name-label">Officially</span> ${esc(c.officialName)}</p>` : ''}
${endonymLine(c) && endonymLine(c) !== c.officialName ? `<p class="endonym">${esc(endonymLine(c))}</p>` : ''}
${c.hasMap ? `<div class="card"><img class="map map-lg" src="img/maps/${c.code}.svg" width="150" height="100" alt="Map showing where ${esc(c.name)} is" loading="lazy"></div>` : ''}
<section class="card">
<h2>What the flag looks like</h2>
<p>${esc(c.flag.description)}</p>
${c.flag.symbolism ? `<h2>What it means</h2><p>${esc(c.flag.symbolism)}</p>` : ''}
${c.hook ? `<h2>How to remember it</h2><p>${esc(c.hook)}</p>` : ''}
</section>
${c.trivia.length ? `<section class="card"><h2>Fun facts</h2><ul>${c.trivia.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>` : ''}
<section class="card"><h2>${esc(c.name)} at a glance</h2><dl class="facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>
${looks.length ? `<section class="card"><h2>Flags often confused with ${esc(c.theName)}</h2><ul>${looks.map((o) => `<li><a href="${flagHref(o)}">${esc(o.name)}</a>${c.differences[o.code] ? `: ${esc(c.differences[o.code])}` : ''}</li>`).join('')}</ul></section>` : ''}
<p><a href="flags/">← All flags</a></p>
</article>`;
  const description = `${c.flag.description} Meaning, history and fun facts about the flag of ${c.theName}.`.slice(0, 300);
  const route = `flags/${c.slug}/`;
  const image = `${site.siteUrl}img/flags/640/${c.code}.webp`;
  await write(
    route,
    shell(route, {
      title: `Flag of ${c.theName}: meaning, colors & facts · ${site.name}`,
      description,
      image,
      type: 'article',
      body,
      jsonld: {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: `Flag of ${c.theName}`,
        description,
        image,
        url: site.siteUrl + route,
        isPartOf: { '@type': 'WebSite', name: site.name, url: site.siteUrl },
      },
    }),
  );
}

const grid = (list) => `<div class="grid">${list.map(tile).join('')}</div>`;
const sections = sets
  .map((set) => {
    const list = countries.filter((c) => c.set === set.id);
    if (!list.length) return '';
    const body =
      set.id === 'sovereign'
        ? CONTINENTS.map((k) => `<h3>${k}</h3>${grid(list.filter((c) => c.continent === k))}`).join('')
        : grid(list);
    return `<section><h2>${esc(set.name)} (${list.length})</h2><p class="muted">${esc(set.description)}</p>${body}</section>`;
  })
  .join('');
await write(
  'flags/',
  shell('flags/', {
    title: `All ${countries.length} flags: countries, states, territories and more · ${site.name}`,
    description: `Every flag of the world's 195 sovereign states, plus US states, Canadian provinces, territories, historical flags and international organizations, with what each flag looks like, what it means and fun facts.`,
    body: `<h1>All flags</h1><p class="muted">Every sovereign state, plus US states, Canadian provinces, territories, states with limited recognition, historical flags and international organizations.</p>${sections}`,
  }),
);

const APP_PAGES = { 'study/': 'Study', 'quiz/': 'Quiz', 'quiz/name-to-flag/': 'Quiz', 'quiz/flag-to-name/': 'Quiz', 'quiz/typed/': 'Quiz', 'progress/': 'Progress' };
for (const [route, name] of Object.entries(APP_PAGES)) {
  await write(route, shell(route, { title: `${name} · ${site.name}`, description: site.description, noindex: true }));
}
// GitHub Pages serves 404.html at any depth, so its <base> must be absolute.
await fs.writeFile(path.join(OUT, '404.html'), rooted(shell('', { title: site.name, description: site.description, noindex: true }), new URL(site.siteUrl).pathname));

const urls = ['', 'flags/', ...countries.map((c) => `flags/${c.slug}/`)];
await fs.writeFile(
  path.join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${site.siteUrl}${u}</loc><lastmod>${today}</lastmod></url>`)
    .join('\n')}\n</urlset>\n`,
);
await fs.writeFile(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site.siteUrl}sitemap.xml\n`);
await fs.writeFile(path.join(OUT, '.nojekyll'), '');
console.log(`Wrote ${countries.length} flag pages, the flag index, ${Object.keys(APP_PAGES).length} app pages, 404.html, sitemap.xml and robots.txt`);

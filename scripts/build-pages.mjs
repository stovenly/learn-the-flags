// After `vite build`: writes a static, crawlable page per country (docs/flags/<slug>/), the flag index, sitemap and robots.txt.
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs');
const site = JSON.parse(await fs.readFile(path.join(ROOT, 'site.config.json'), 'utf8'));
const countries = JSON.parse(await fs.readFile(path.join(ROOT, 'src/generated/countries.json'), 'utf8'));
const byCode = new Map(countries.map((c) => [c.code, c]));
const REGIONS = ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania'];
const today = new Date().toISOString().slice(0, 10);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const fmtPop = (n) => (n == null ? '—' : n >= 1e9 ? `${(n / 1e9).toFixed(2)} billion` : n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)} million` : n.toLocaleString('en-US'));
const STATUS = { 'un-observer': 'UN observer state', 'partially-recognized': 'Partially recognized state' };

const CSS = `
:root{--bg:#f6f6f3;--surface:#fff;--border:#e4e4df;--text:#17181b;--muted:#6b6d74;--accent:#3b5bdb;--hook:#fff6dc;--hook-border:#f0dfa8;--edge:rgba(0,0,0,.1);color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#121316;--surface:#1b1c20;--border:#2e3036;--text:#ececef;--muted:#9a9ca5;--accent:#7b93f5;--hook:#2c2818;--hook-border:#4a4224;--edge:rgba(255,255,255,.12)}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:780px;margin:0 auto;padding:0 16px}
header{border-bottom:1px solid var(--border)}header .wrap{display:flex;align-items:center;justify-content:space-between;height:60px}
.logo{display:flex;gap:8px;align-items:center;font-weight:700;color:var(--text)}
.cta{background:var(--accent);color:#fff;padding:9px 16px;border-radius:10px;font-weight:600;font-size:.92rem}.cta:hover{text-decoration:none}
@media (prefers-color-scheme:dark){.cta{color:#0f1220}}
main{padding:32px 16px 56px}h1{font-size:clamp(1.7rem,4vw,2.3rem);line-height:1.2;letter-spacing:-.015em;margin:0 0 6px}
h2{font-size:1.15rem;margin:0 0 10px}.muted{color:var(--muted)}
.card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:22px;margin:16px 0}
.flag{display:block;height:auto;border-radius:4px;box-shadow:0 0 0 1px var(--edge)}
.flag.shaped{box-shadow:none;border-radius:0}
.hero{display:grid;place-items:center;padding:32px}.hero .flag{width:min(100%,calc(260px * var(--r)),480px)}
.hook{background:var(--hook);border:1px solid var(--hook-border);border-radius:12px;padding:12px 16px;margin-top:14px}
.label{font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
dl{display:grid;grid-template-columns:repeat(2,1fr);gap:12px 24px;margin:0}dt{font-size:.8rem;color:var(--muted)}dd{margin:0;font-weight:500}
ul{padding-left:20px;margin:0}li{margin-bottom:6px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:18px 14px}
.grid a{color:var(--text);font-size:.88rem;display:flex;flex-direction:column;gap:6px}.grid a:hover{color:var(--accent);text-decoration:none}
.grid .box{aspect-ratio:3/2;display:grid;place-items:center;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px}
.grid .flag{width:auto;max-width:100%;max-height:100%}
.head{display:flex;align-items:center;gap:18px;margin-top:8px}.head p{margin:0}.globe{width:220px;height:220px;flex-shrink:0;filter:drop-shadow(0 2px 6px rgba(20,30,50,.22))}
.pairs{display:flex;flex-direction:column;gap:14px}.pair{display:grid;grid-template-columns:110px 1fr;gap:16px;align-items:center;color:var(--text)}.pair:hover{text-decoration:none}.pair .box{aspect-ratio:3/2;display:grid;place-items:center}.pair .flag{width:auto;max-width:100%;max-height:100%}.pair strong{display:block}
.promo{text-align:center}.promo p{margin:0 0 14px}
footer{border-top:1px solid var(--border);padding:20px 16px 32px;font-size:.85rem;color:var(--muted)}
@media (max-width:520px){dl{grid-template-columns:1fr}.hero{padding:18px}.globe{width:132px;height:132px}.pair{grid-template-columns:80px 1fr;gap:12px}}
`.trim();

function page({ title, description, canonical, image, depth, body, jsonld }) {
  const up = '../'.repeat(depth);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<link rel="icon" href="${up}icon.svg" type="image/svg+xml">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${image}">
<meta name="twitter:card" content="summary_large_image">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
<style>${CSS}</style>
</head>
<body>
<header><div class="wrap">
<a class="logo" href="${up}"><svg viewBox="0 0 32 32" width="24" height="24" aria-hidden="true"><rect x="5" y="3" width="2.5" height="26" rx="1.25" fill="currentColor"/><path d="M8.5 5h17l-3.5 5.5 3.5 5.5h-17z" fill="var(--accent)"/></svg>${esc(site.name)}</a>
<a class="cta" href="${up}">Start learning</a>
</div></header>
<main class="wrap">${body}</main>
<footer class="wrap">${esc(site.name)} · a free way to learn every flag of the world · Flag images from Wikimedia Commons via flagcdn.com (public domain)</footer>
</body>
</html>
`;
}

const img = (c, up, size = 640) => {
  const h = Math.round(640 / c.ratio);
  return `<img class="flag${c.transparent ? ' shaped' : ''}" src="${up}img/flags/${size}/${c.code}.webp" width="640" height="${h}" alt="Flag of ${esc(c.name)}" style="--r:${c.ratio}"${size === 320 ? ' loading="lazy"' : ''} decoding="async">`;
};

const tile = (c, up, href) => `<a href="${href}"><span class="box">${img(c, up, 320)}</span>${esc(c.name)}</a>`;

for (const c of countries) {
  const up = '../../';
  const looks = c.lookalikes.map((k) => byCode.get(k)).filter(Boolean);
  const facts = [
    ['Region', c.subregion || c.region],
    ['Population', fmtPop(c.population)],
    ['Area', c.area ? `${Math.round(c.area).toLocaleString('en-US')} km²` : '—'],
    ['Languages', c.languages.join(', ')],
    ['Currency', c.currencies.join(', ')],
    ['Flag adopted', c.flag.adopted],
  ];
  const body = `
<article>
<div class="card hero">${img(c, up)}</div>
<div class="head"><img class="globe" src="${up}img/globes/${c.code}.svg" width="100" height="100" alt="Where ${esc(c.name)} is on the globe"><div>
<h1>Flag of ${esc(c.name)}</h1>
<p class="muted">${esc(c.officialName)}${STATUS[c.status] ? ` · ${STATUS[c.status]}` : ''}</p>
</div></div>
<section class="card">
<h2>What the flag looks like</h2>
<p>${esc(c.flag.description)}</p>
${c.flag.symbolism ? `<h2>What it means</h2><p>${esc(c.flag.symbolism)}</p>` : ''}
${c.hook ? `<div class="hook"><span class="label">How to remember it</span><p style="margin:2px 0 0">${esc(c.hook)}</p></div>` : ''}
</section>
${c.trivia.length ? `<section class="card"><h2>Fun facts</h2><ul>${c.trivia.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>` : ''}
<section class="card"><h2>${esc(c.name)} at a glance</h2><dl>${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v || '—')}</dd></div>`).join('')}</dl></section>
${looks.length ? `<section class="card"><h2>Flags often confused with ${esc(c.name)}</h2><div class="pairs">${looks.map((o) => `<a class="pair" href="../${o.slug}/"><span class="box">${img(o, up, 320)}</span><span><strong>${esc(o.name)}</strong>${c.differences[o.code] ? `<span class="muted">${esc(c.differences[o.code])}</span>` : ''}</span></a>`).join('')}</div></section>` : ''}
<section class="card promo"><p>Learn the flag of ${esc(c.name)} and every other country with short daily lessons.</p><a class="cta" href="${up}#/flag/${c.slug}">Practice with ${esc(site.name)}</a></section>
<p><a href="../">← All flags of the world</a></p>
</article>`;
  const description = `${c.flag.description} Meaning, history and fun facts about the flag of ${c.name}.`.slice(0, 300);
  const canonical = `${site.siteUrl}flags/${c.slug}/`;
  const html = page({
    title: `Flag of ${c.name}: meaning, colors & facts · ${site.name}`,
    description,
    canonical,
    image: `${site.siteUrl}img/flags/640/${c.code}.webp`,
    depth: 2,
    body,
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: `Flag of ${c.name}`,
      description,
      image: `${site.siteUrl}img/flags/640/${c.code}.webp`,
      url: canonical,
      isPartOf: { '@type': 'WebSite', name: site.name, url: site.siteUrl },
    },
  });
  await fs.mkdir(path.join(OUT, 'flags', c.slug), { recursive: true });
  await fs.writeFile(path.join(OUT, 'flags', c.slug, 'index.html'), html);
}

const sections = REGIONS.map((r) => {
  const list = countries.filter((c) => c.region === r);
  return `<section class="card"><h2>${r} <span class="muted">(${list.length})</span></h2><div class="grid">${list.map((c) => tile(c, '../', `${c.slug}/`)).join('')}</div></section>`;
}).join('');
const recognized = countries.filter((c) => c.status !== 'partially-recognized').length;
await fs.writeFile(
  path.join(OUT, 'flags', 'index.html'),
  page({
    title: `All ${recognized} flags of the world · ${site.name}`,
    description: `Every flag of the world's ${recognized} sovereign states, plus Kosovo and Taiwan, with what each flag looks like, what it means and fun facts.`,
    canonical: `${site.siteUrl}flags/`,
    image: `${site.siteUrl}og.png`,
    depth: 1,
    body: `<h1>Flags of the world</h1><p class="muted">All 193 UN member states, the two UN observer states (Vatican City and Palestine), and the partially recognized states Kosovo and Taiwan. Tap any flag for its meaning and history.</p>${sections}`,
  }),
);

const urls = ['', 'flags/', ...countries.map((c) => `flags/${c.slug}/`)];
await fs.writeFile(
  path.join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${site.siteUrl}${u}</loc><lastmod>${today}</lastmod></url>`)
    .join('\n')}\n</urlset>\n`,
);
await fs.writeFile(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site.siteUrl}sitemap.xml\n`);
await fs.writeFile(path.join(OUT, '.nojekyll'), '');
console.log(`Wrote ${countries.length} country pages, flag index, sitemap.xml and robots.txt`);

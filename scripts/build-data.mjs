// Validates data/flags/<set>/*.json, measures the flag images and writes src/generated/{countries,sets}.json for the app.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'light-blue', 'white', 'black', 'maroon', 'brown', 'purple'];
const STATUSES = ['un-member', 'un-observer'];

const sets = JSON.parse(await fs.readFile(path.join(ROOT, 'data/sets.json'), 'utf8'));
const countries = [];
const errors = [];
const warnings = [];

for (const set of sets) {
  const dir = path.join(ROOT, 'data/flags', set.id);
  const files = (await fs.readdir(dir).catch(() => [])).filter((f) => f.endsWith('.json')).sort();
  if (!files.length) warnings.push(`${set.id}: no flags yet`);
  for (const f of files) {
    const where = `${set.id}/${f}`;
    let c;
    try {
      c = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
    } catch (e) {
      errors.push(`${where}: invalid JSON (${e.message})`);
      continue;
    }
    if (c.code !== f.replace('.json', '')) errors.push(`${where}: code "${c.code}" does not match file name`);
    if (!c.name) errors.push(`${where}: missing name`);
    if (set.id === 'sovereign' && !STATUSES.includes(c.status)) errors.push(`${where}: status must be one of ${STATUSES.join(', ')}`);
    for (const col of c.flag?.colors ?? []) if (!COLORS.includes(col)) errors.push(`${where}: unknown colour "${col}"`);
    if (!c.flag?.description) warnings.push(`${where}: no flag description`);
    if (!c.hook) warnings.push(`${where}: no memory hook`);
    countries.push({ ...c, set: set.id });
  }
}
const byCode = new Map(countries.map((c) => [c.code, c]));
for (const c of countries) if (countries.filter((o) => o.code === c.code).length > 1) errors.push(`${c.set}/${c.code}: code used twice`);

// A lookalike must be in the same set or be a sovereign state, so a lesson never leans on flags from an unrelated set.
const related = (a, b) => a.set === b.set || a.set === 'sovereign' || b.set === 'sovereign';
for (const c of countries) {
  for (const l of [...(c.lookalikes ?? []), ...(c.identical ?? [])]) {
    const o = byCode.get(l);
    if (!o) errors.push(`${c.set}/${c.code}: lookalike "${l}" is not a known flag`);
    else if (!related(c, o)) errors.push(`${c.set}/${c.code}: lookalike "${l}" is in an unrelated set`);
  }
}

// data/lookalikes/*.json: "<code>|<code>" (sorted) → how to tell the two flags apart.
const pairKey = (a, b) => [a, b].sort().join('|');
const differences = {};
for (const f of (await fs.readdir(path.join(ROOT, 'data/lookalikes'))).filter((f) => f.endsWith('.json')).sort()) {
  const pairs = JSON.parse(await fs.readFile(path.join(ROOT, 'data/lookalikes', f), 'utf8'));
  for (const [k, v] of Object.entries(pairs)) {
    const [a, b] = k.split('|');
    if (!byCode.has(a) || !byCode.has(b) || k !== pairKey(a, b)) errors.push(`lookalikes/${f}: bad key "${k}"`);
    else if (!related(byCode.get(a), byCode.get(b))) errors.push(`lookalikes/${f}: "${k}" pairs unrelated sets`);
    else if (typeof v !== 'string' || !v) errors.push(`lookalikes/${f}: "${k}" needs a sentence`);
    else differences[k] = v;
  }
}
for (const c of countries) {
  for (const l of c.lookalikes ?? []) if (!differences[pairKey(c.code, l)]) warnings.push(`lookalikes: no explanation for ${pairKey(c.code, l)}`);
}

function toLab([r, g, b]) {
  const lin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

const images = {};
for (const c of countries) {
  const file = path.join(ROOT, `public/img/flags/640/${c.code}.webp`);
  try {
    const meta = await sharp(file).metadata();
    const { data } = await sharp(file).flatten({ background: '#ffffff' }).resize(32, 20, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const lab = [];
    let sum = [0, 0, 0];
    for (let i = 0; i < data.length; i += 3) {
      lab.push(toLab([data[i], data[i + 1], data[i + 2]]));
      sum = sum.map((s, k) => s + data[i + k]);
    }
    const avg = sum.map((s) => Math.round(s / (data.length / 3)));
    images[c.code] = {
      ratio: +(meta.width / meta.height).toFixed(4),
      transparent: !!meta.hasAlpha,
      color: '#' + avg.map((v) => v.toString(16).padStart(2, '0')).join(''),
      lab,
    };
  } catch {
    errors.push(`${c.set}/${c.code}: missing image public/img/flags/640/${c.code}.webp (run npm run flags)`);
  }
}

function distance(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1], a[i][2] - b[i][2]);
  return d / a.length;
}

const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// "Nippon · 日本": the place's own name in its first language, romanization first when it has one; empty when it
// would only repeat the English name.
function endonym(c) {
  const l = c.endonyms?.[0];
  const line = l ? [l.romanized, l.name].filter(Boolean).join(' · ') : '';
  return line === c.name ? '' : line;
}

// Every flag's name (and name-like aliases) longest first, so "Equatorial Guinea" wins over "Guinea" and "New Jersey" over "Jersey".
const named = new Map();
for (const o of countries.filter((o) => images[o.code])) {
  const abbrev = (a) => /^[A-Z]{2,}$/.test(a) && !['us-states', 'canada', 'japan'].includes(o.set);
  for (const n of [o.name, ...(o.aliases ?? []).filter((a) => (/^[A-Z][a-z]/.test(a) && a.length > 3) || abbrev(a))]) named.set(n, [...(named.get(n) ?? []), o]);
}
// Place names that contain a flag's name without meaning it.
for (const n of ['North America', 'South America', 'Central America', 'Latin America', 'New Guinea', 'Northern Ireland']) if (!named.has(n)) named.set(n, []);
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const mention = new RegExp(`(?<![\\w-])(${[...named.keys()].sort((a, b) => b.length - a.length).map(escRe).join('|')})(?:'s)?(?![\\w-])`, 'g');

// The hook as plain strings and [text, code] for the first mention of each flag; same-set and sovereign flags win name clashes.
function hookParts(c) {
  const parts = [];
  const seen = new Set();
  let at = 0;
  for (const m of c.hook.matchAll(mention)) {
    const pool = named.get(m[1]);
    const o = pool.find((o) => o.code === c.code) ?? pool.find((o) => o.set === c.set) ?? pool.find((o) => o.set === 'sovereign') ?? pool[0];
    if (!o || seen.has(o.code)) continue;
    seen.add(o.code);
    parts.push(c.hook.slice(at, m.index), [m[0], o.code]);
    at = m.index + m[0].length;
  }
  parts.push(c.hook.slice(at));
  return parts.filter((p) => p !== '');
}

const continent = (c) => (c.region !== 'Americas' ? c.region : c.subregion === 'South America' ? 'South America' : 'North America');
const order = new Map(sets.flatMap((s) => (s.order ?? []).map((code, i) => [code, i])));

const out = countries
  .filter((c) => images[c.code])
  .map((c) => {
    const near = countries
      .filter((o) => o.code !== c.code && images[o.code] && (o.set === c.set || o.set === 'sovereign') && !(c.identical ?? []).includes(o.code))
      .map((o) => ({ code: o.code, d: distance(images[c.code].lab, images[o.code].lab) }))
      .sort((a, b) => a.d - b.d);
    const reverse = countries.filter((o) => o.lookalikes?.includes(c.code)).map((o) => o.code);
    const fromPairs = Object.keys(differences)
      .map((k) => k.split('|'))
      .filter((p) => p.includes(c.code))
      .map((p) => (p[0] === c.code ? p[1] : p[0]));
    const shown = (code) => [c.set, 'sovereign'].includes(byCode.get(code)?.set);
    const lookalikes = [...new Set([...(c.lookalikes ?? []), ...reverse, ...fromPairs])].filter(shown);
    const diffs = Object.fromEntries(lookalikes.filter((l) => differences[pairKey(c.code, l)]).map((l) => [l, differences[pairKey(c.code, l)]]));
    const { ratio, transparent, color } = images[c.code];
    return {
      code: c.code,
      set: c.set,
      name: c.name,
      theName: c.the ? `the ${c.name}` : c.name,
      slug: c.slug ?? slugify(c.name),
      officialName: c.officialName,
      aliases: c.aliases ?? [],
      status: c.status ?? null,
      region: c.region,
      subregion: c.subregion,
      continent: c.set === 'sovereign' ? continent(c) : null,
      capital: c.capital ?? '',
      population: c.population ?? null,
      area: c.area ?? null,
      endonyms: c.endonyms ?? [],
      endonym: endonym(c),
      languages: c.languages ?? [],
      currencies: c.currencies ?? [],
      demonym: c.demonym ?? '',
      facts: c.facts ?? [],
      flag: c.flag,
      hook: c.hook,
      hookParts: c.hook ? hookParts(c) : [],
      trivia: c.trivia ?? [],
      lookalikes,
      identical: countries.filter((o) => o.code !== c.code && ((c.identical ?? []).includes(o.code) || (o.identical ?? []).includes(c.code))).map((o) => o.code),
      differences: diffs,
      nearest: near.slice(0, 12).map((n) => n.code),
      hasMap: c.shape !== false,
      pin: c.pin ? { city: c.pin.city, label: c.pin.label } : null,
      rank: order.get(c.code) ?? null,
      ratio,
      transparent,
      color,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));

for (const c of out) if (out.some((o) => o !== c && o.slug === c.slug)) errors.push(`${c.set}/${c.code}: slug "${c.slug}" is taken; add a "slug" field`);

for (const w of warnings.slice(0, 5)) console.warn(`warn  ${w}`);
if (warnings.length > 5) console.warn(`warn  …and ${warnings.length - 5} more`);
if (errors.length) {
  for (const e of errors) console.error(`error ${e}`);
  process.exit(1);
}
await fs.mkdir(path.join(ROOT, 'src/generated'), { recursive: true });
await fs.writeFile(path.join(ROOT, 'src/generated/countries.json'), JSON.stringify(out));
await fs.writeFile(path.join(ROOT, 'src/generated/sets.json'), JSON.stringify(sets.map(({ order, ...s }) => s)));
console.log(`Wrote ${out.length} flags in ${sets.length} sets to src/generated/`);

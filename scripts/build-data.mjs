// Validates data/countries/*.json, measures the flag images and writes src/generated/countries.json for the app.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'light-blue', 'white', 'black', 'maroon', 'brown', 'purple'];
const STATUSES = ['un-member', 'un-observer', 'partially-recognized'];
// Mean CIE76 ΔE over a 32×20 thumbnail; below this two flags count as visually similar.
const SIMILAR_DE = 24;

const dir = path.join(ROOT, 'data/countries');
const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json')).sort();
const countries = [];
const errors = [];
const warnings = [];

for (const f of files) {
  let c;
  try {
    c = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
  } catch (e) {
    errors.push(`${f}: invalid JSON (${e.message})`);
    continue;
  }
  if (c.code !== f.replace('.json', '')) errors.push(`${f}: code "${c.code}" does not match file name`);
  if (!c.name) errors.push(`${f}: missing name`);
  if (!STATUSES.includes(c.status)) errors.push(`${f}: status must be one of ${STATUSES.join(', ')}`);
  for (const col of c.flag?.colors ?? []) if (!COLORS.includes(col)) errors.push(`${f}: unknown colour "${col}"`);
  if (!c.flag?.description) warnings.push(`${f}: no flag description`);
  if (!c.hook) warnings.push(`${f}: no memory hook`);
  countries.push(c);
}
const codes = new Set(countries.map((c) => c.code));
for (const c of countries) {
  for (const l of c.lookalikes ?? []) if (!codes.has(l)) errors.push(`${c.code}.json: lookalike "${l}" is not a known country`);
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
    errors.push(`${c.code}: missing image public/img/flags/640/${c.code}.webp — run npm run flags`);
  }
}

function distance(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1], a[i][2] - b[i][2]);
  return d / a.length;
}

const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const out = countries
  .filter((c) => images[c.code])
  .map((c) => {
    const near = countries
      .filter((o) => o.code !== c.code && images[o.code])
      .map((o) => ({ code: o.code, d: distance(images[c.code].lab, images[o.code].lab) }))
      .sort((a, b) => a.d - b.d);
    const similar = near.filter((n) => n.d < SIMILAR_DE).slice(0, 4).map((n) => n.code);
    const reverse = countries.filter((o) => o.lookalikes?.includes(c.code)).map((o) => o.code);
    const lookalikes = [...new Set([...(c.lookalikes ?? []), ...reverse, ...similar])].slice(0, 6);
    const { ratio, transparent, color } = images[c.code];
    return {
      code: c.code,
      name: c.name,
      slug: slugify(c.name),
      officialName: c.officialName,
      aliases: c.aliases ?? [],
      status: c.status,
      capital: c.capital,
      region: c.region,
      subregion: c.subregion,
      population: c.population,
      area: c.area,
      languages: c.languages ?? [],
      currencies: c.currencies ?? [],
      demonym: c.demonym,
      flag: c.flag,
      hook: c.hook,
      trivia: c.trivia ?? [],
      lookalikes,
      nearest: near.slice(0, 12).map((n) => n.code),
      ratio,
      transparent,
      color,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));

for (const w of warnings.slice(0, 5)) console.warn(`warn  ${w}`);
if (warnings.length > 5) console.warn(`warn  …and ${warnings.length - 5} more`);
if (errors.length) {
  for (const e of errors) console.error(`error ${e}`);
  process.exit(1);
}
await fs.mkdir(path.join(ROOT, 'src/generated'), { recursive: true });
await fs.writeFile(path.join(ROOT, 'src/generated/countries.json'), JSON.stringify(out));
console.log(`Wrote ${out.length} countries to src/generated/countries.json`);

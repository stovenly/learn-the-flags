// Writes data/geo/extra.json: outlines that world-atlas lacks (US states, Canadian provinces, UK nations, breakaway
// states, a few historical building blocks), keyed by flag code, from Natural Earth 10m (public domain). Run rarely.
import fs from 'node:fs/promises';
import path from 'node:path';
import { geoArea } from 'd3-geo';

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE = path.join(ROOT, '.cache/ne');
const BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';

async function load(name) {
  const file = path.join(CACHE, `${name}.geojson`);
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')).features;
  } catch {
    const res = await fetch(BASE + name + '.geojson');
    if (!res.ok) throw new Error(`${name}: ${res.status}`);
    const text = await res.text();
    await fs.mkdir(CACHE, { recursive: true });
    await fs.writeFile(file, text);
    return JSON.parse(text).features;
  }
}

const TOL = 0.02; // degrees; vertices closer than this to the last kept one are dropped
function compact(geometry) {
  const ring = (r) => {
    const out = [r[0]];
    for (const p of r.slice(1, -1)) {
      const q = out[out.length - 1];
      if (Math.abs(p[0] - q[0]) >= TOL || Math.abs(p[1] - q[1]) >= TOL) out.push(p);
    }
    out.push(r[r.length - 1]);
    return out.map(([x, y]) => [+x.toFixed(2), +y.toFixed(2)]);
  };
  const speck = (r) => Math.max(...r.map((p) => p[0])) - Math.min(...r.map((p) => p[0])) < 0.05 && Math.max(...r.map((p) => p[1])) - Math.min(...r.map((p) => p[1])) < 0.05;
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const kept = polys.filter((p) => !speck(p[0]));
  const out = (kept.length ? kept : polys).map((p) => p.map(ring).filter((r) => r.length >= 4)).filter((p) => p.length);
  // Dropping vertices can flip a ring's winding, and d3 then fills the whole globe except that polygon.
  return { type: 'MultiPolygon', coordinates: out.map((p) => (geoArea({ type: 'Polygon', coordinates: p }) > 2 * Math.PI ? p.map((r) => [...r].reverse()) : p)) };
}

const PARENT = { MAR: '504', USA: '840', CAN: '124', GBR: '826', DEU: '276', CHN: '156', GEO: '268', MDA: '498', SOM: '706', CYP: '196' };
const out = {};
const add = (key, name, parent, geometry) => (out[key] = { name, parent, geometry: compact(geometry) });

const admin1 = await load('ne_10m_admin_1_states_provinces');
for (const f of admin1) {
  const p = f.properties;
  if (p.adm0_a3 === 'USA') add(`us-${p.postal.toLowerCase()}`, p.name, PARENT.USA, f.geometry);
  else if (p.adm0_a3 === 'CAN') add(p.iso_3166_2.toLowerCase(), p.name, PARENT.CAN, f.geometry);
  else if (p.adm0_a3 === 'DEU') add(p.iso_3166_2.toLowerCase(), p.name, PARENT.DEU, f.geometry);
  else if (p.iso_3166_2 === 'CN-XZ') add('cn-xz', p.name, PARENT.CHN, f.geometry);
}

// Regions made of one or more admin-1 units: flag code → [country, test on the unit's properties].
const REGIONS = {
  mq: ['FRA', (p) => p.iso_3166_2 === 'FR-MQ'],
  gp: ['FRA', (p) => p.iso_3166_2 === 'FR-GP'],
  gf: ['FRA', (p) => p.iso_3166_2 === 'FR-GF'],
  re: ['FRA', (p) => p.iso_3166_2 === 'FR-RE'],
  yt: ['FRA', (p) => p.iso_3166_2 === 'FR-YT'],
  'fr-20r': ['FRA', (p) => p.region === 'Corse'],
  'fr-bre': ['FRA', (p) => p.region === 'Bretagne'],
  'es-cn': ['ESP', (p) => p.region === 'Canary Is.'],
  'es-ct': ['ESP', (p) => p.region === 'Cataluña'],
  'es-pv': ['ESP', (p) => p.region === 'País Vasco'],
  'es-ce': ['ESP', (p) => p.iso_3166_2 === 'ES-CE'],
  'es-ml': ['ESP', (p) => p.iso_3166_2 === 'ES-ML'],
  'pt-20': ['PRT', (p) => p.iso_3166_2 === 'PT-20'],
  'pt-30': ['PRT', (p) => p.iso_3166_2 === 'PT-30'],
  'it-88': ['ITA', (p) => p.region === 'Sardegna'],
  'it-82': ['ITA', (p) => p.region === 'Sicily'],
  'it-bz': ['ITA', (p) => p.iso_3166_2 === 'IT-BZ'],
  'it-23': ['ITA', (p) => p.iso_3166_2 === 'IT-AO'],
  'bq-bo': ['NLD', (p) => p.iso_3166_2 === 'NL-BQ1'],
  'bq-sa': ['NLD', (p) => p.iso_3166_2 === 'NL-BQ2'],
  'bq-se': ['NLD', (p) => p.iso_3166_2 === 'NL-BQ3'],
  'sh-ac': ['SHN', (p) => p.iso_3166_2 === 'SH-AC'],
  'sh-ta': ['SHN', (p) => p.iso_3166_2 === 'SH-TA'],
  'gg-srk': ['GGY', (p) => p.name === 'Sark'],
  'iq-kr': ['IRQ', (p) => p.region === 'Kurdistan'],
  zanzibar: ['TZA', (p) => ['TZ-06', 'TZ-07', 'TZ-10', 'TZ-11', 'TZ-15'].includes(p.iso_3166_2)],
  'pg-nsb': ['PNG', (p) => p.iso_3166_2 === 'PG-NSB'],
  'in-sk': ['IND', (p) => p.iso_3166_2 === 'IN-SK'],
};
const ISO_NUM = { FRA: '250', ESP: '724', PRT: '620', ITA: '380', NLD: '528', SHN: '654', GGY: '831', IRQ: '368', TZA: '834', PNG: '598', IND: '356' };
for (const [key, [adm0, test]] of Object.entries(REGIONS)) {
  const units = admin1.filter((f) => f.properties.adm0_a3 === adm0 && test(f.properties));
  if (!units.length) throw new Error(`${key}: no admin-1 units matched`);
  const polys = units.flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates));
  add(key, units.length === 1 ? units[0].properties.name : key, ISO_NUM[adm0], { type: 'MultiPolygon', coordinates: polys });
}

const NATIONS = { ENG: 'gb-eng', SCT: 'gb-sct', WLS: 'gb-wls', NIR: 'gb-nir' };
for (const f of await load('ne_10m_admin_0_map_units')) {
  const key = NATIONS[f.properties.GU_A3];
  if (key) add(key, f.properties.NAME, PARENT.GBR, f.geometry);
}

const BREAKAWAY = {
  Abkhazia: ['abkhazia', 'GEO'],
  'South Ossetia': ['south-ossetia', 'GEO'],
  Transnistria: ['transnistria', 'MDA'],
  Somaliland: ['somaliland', 'SOM'],
  'N. Cyprus': ['northern-cyprus', 'CYP'],
  'W. Sahara': ['eh', 'MAR'],
};
// Western Sahara comes in two pieces, either side of the Moroccan berm.
const pieces = new Map();
for (const f of await load('ne_10m_admin_0_disputed_areas')) {
  const hit = BREAKAWAY[f.properties.BRK_NAME];
  if (!hit) continue;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  pieces.set(hit[0], { name: f.properties.BRK_NAME, parent: PARENT[hit[1]], polys: [...(pieces.get(hit[0])?.polys ?? []), ...polys] });
}
for (const [key, x] of pieces) add(key, x.name, x.parent, { type: 'MultiPolygon', coordinates: x.polys });

await fs.mkdir(path.join(ROOT, 'data/geo'), { recursive: true });
const json = JSON.stringify(out);
await fs.writeFile(path.join(ROOT, 'data/geo/extra.json'), json);
console.log(`Wrote ${Object.keys(out).length} outlines (${Math.round(json.length / 1024)} KB) to data/geo/extra.json`);

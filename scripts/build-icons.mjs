// Writes src/generated/continents.json: a filled silhouette path per continent in a 24×24 box, for badge symbols.
import fs from 'node:fs/promises';
import path from 'node:path';
import { geoMercator, geoPath } from 'd3-geo';
import { feature, merge } from 'topojson-client';

const ROOT = path.resolve(import.meta.dirname, '..');
const topo = JSON.parse(await fs.readFile(path.join(ROOT, 'node_modules/world-atlas/countries-110m.json'), 'utf8'));
const dir = path.join(ROOT, 'data/flags/sovereign');
const sovereign = await Promise.all((await fs.readdir(dir)).filter((f) => f.endsWith('.json')).map(async (f) => JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'))));
const continent = (c) => (c.region !== 'Americas' ? c.region : c.subregion === 'South America' ? 'South America' : 'North America');

// [west, south, east, north] in degrees; land outside is cut off, which trims Russia to each side of the Urals.
const BOX = {
  Africa: [-18, -35, 52, 38],
  Asia: [26, -11, 146, 77],
  Europe: [-25, 35, 45, 71],
  'North America': [-168, 7, -52, 72],
  'South America': [-82, -56, -34, 13],
  Oceania: [112, -47, 179, -1],
};
const EXTRA = { Asia: ['643'], 'North America': ['304'] }; // Russia's Asian side, Greenland

const out = {};
for (const [name, [w, s, e, n]] of Object.entries(BOX)) {
  const iso = new Set([...sovereign.filter((c) => continent(c) === name).map((c) => c.isoNumeric), ...(EXTRA[name] ?? [])]);
  const land = merge(topo, topo.objects.countries.geometries.filter((g) => iso.has(g.id)));
  const corners = { type: 'MultiPoint', coordinates: [[w, s], [e, s], [e, n], [w, n]] };
  const proj = geoMercator().fitExtent([[1, 1], [23, 23]], corners);
  const [[x0, y1], [x1, y0]] = [proj([w, s]), proj([e, n])];
  proj.clipExtent([[x0, y0], [x1, y1]]);
  const d = geoPath(proj).digits(1)(land) ?? '';
  out[name] = d
    .split('M')
    .filter(Boolean)
    .filter((sub) => {
      const pts = sub.replace(/Z$/, '').split('L').map((p) => p.split(',').map(Number));
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      return Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys) > 1.2;
    })
    .map((sub) => 'M' + sub)
    .join('');
}
await fs.mkdir(path.join(ROOT, 'src/generated'), { recursive: true });
await fs.writeFile(path.join(ROOT, 'src/generated/continents.json'), JSON.stringify(out));
console.log(`Wrote ${Object.keys(out).length} continent silhouettes to src/generated/`);

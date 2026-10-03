// Renders public/img/globes/<code>.svg: an orthographic globe centred and zoomed on each country, with it highlighted.
import fs from 'node:fs/promises';
import path from 'node:path';
import { geoArea, geoCentroid, geoDistance, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public/img/globes');
const SIZE = 100; // viewBox units
const R = 48;
const FILL = 0.55; // share of the disc radius the country should span
const MAX_ZOOM = 9;
const NEAR = 0.45; // radians; parts further than this from the main landmass don't steer the view

const load = async (res) => {
  const topo = JSON.parse(await fs.readFile(path.join(ROOT, `node_modules/world-atlas/countries-${res}.json`), 'utf8'));
  return feature(topo, topo.objects.countries).features;
};
const world50 = await load('50m');
const world110 = await load('110m');
const countries = await Promise.all(
  (await fs.readdir(path.join(ROOT, 'data/countries')))
    .filter((f) => f.endsWith('.json'))
    .map(async (f) => JSON.parse(await fs.readFile(path.join(ROOT, 'data/countries', f), 'utf8'))),
);

const polygons = (f) =>
  f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
const asFeature = (polys) => ({ type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: polys } });

function focus(f) {
  const parts = polygons(f).map((p) => ({ p, area: geoArea(asFeature([p])), c: geoCentroid(asFeature([p])) }));
  const main = parts.reduce((a, b) => (b.area > a.area ? b : a));
  const near = parts.filter((x) => geoDistance(x.c, main.c) < NEAR).map((x) => x.p);
  const center = geoCentroid(asFeature(near));
  let spread = 0;
  for (const poly of near) for (const ring of poly) for (const pt of ring) spread = Math.max(spread, geoDistance(center, pt));
  return { center, spread, markAt: main.c };
}

// Screen-space simplification: drop vertices closer than `tol` units to the last kept one, and specks.
function simplify(d, tol = 0.6, minSpan = 0.8) {
  if (!d) return '';
  const out = [];
  for (const sub of d.split('M').filter(Boolean)) {
    const closed = sub.endsWith('Z');
    const pts = sub.replace(/Z$/, '').split('L').map((p) => p.split(',').map(Number));
    const kept = [pts[0]];
    for (const p of pts.slice(1)) {
      const q = kept[kept.length - 1];
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= tol) kept.push(p);
    }
    const xs = kept.map((p) => p[0]), ys = kept.map((p) => p[1]);
    if (Math.max(...xs) - Math.min(...xs) < minSpan && Math.max(...ys) - Math.min(...ys) < minSpan) continue;
    if (closed && kept.length < 3) continue;
    const fmt = (n) => +n.toFixed(1);
    out.push('M' + kept.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join('L') + (closed ? 'Z' : ''));
  }
  return out.join('');
}

const STYLE = `<style>.o{fill:#e3e9f0}.l{fill:#c5ccd5;stroke:#fff;stroke-width:.35}.g{fill:none;stroke:#d3dbe5;stroke-width:.3}.t{fill:#e8590c;stroke:#fff;stroke-width:.35}.m{fill:none;stroke:#e8590c;stroke-width:1.6}.r{fill:none;stroke:#b5bfcb;stroke-width:.6}@media(prefers-color-scheme:dark){.o{fill:#283141}.l{fill:#4b5567;stroke:#283141}.g{stroke:#323c4e}.t{fill:#ff922b;stroke:#283141}.m{stroke:#ff922b}.r{stroke:#4b5567}}</style>`;

await fs.mkdir(OUT, { recursive: true });
let total = 0;
for (const c of countries) {
  const f = world50.find((w) => (c.isoNumeric && w.id === c.isoNumeric) || w.properties.name === c.name);
  let center, spread, markAt;
  if (f) ({ center, spread, markAt } = focus(f));
  else {
    center = markAt = [c.latlng[1], c.latlng[0]];
    spread = 0;
  }
  const key = (w) => w.id ?? w.properties.name;
  const isTarget = (w) => !!f && key(w) === key(f);
  let scale = Math.min(R * MAX_ZOOM, Math.max(R, (FILL * R) / Math.sin(Math.min(Math.max(spread, 1e-4), Math.PI / 2))));
  let projection, draw, others;
  // Zoom out until some other land is in view, so remote islands still have context.
  for (;;) {
    projection = geoOrthographic()
      .rotate([-center[0], -center[1]])
      .scale(scale)
      .translate([SIZE / 2, SIZE / 2])
      .clipAngle(90)
      .clipExtent([[0, 0], [SIZE, SIZE]]);
    draw = geoPath(projection).digits(1);
    const base = scale / R < 2.5 ? world110 : world50;
    others = base.filter((w) => !isTarget(w)).map((w) => simplify(draw(w), 0.7, 1)).join('');
    if (others.length > 400 || scale <= R) break;
    scale = Math.max(R, scale / 1.6);
  }
  const target = f ? simplify(draw(f), 0.35, 0) : '';
  let marker = '';
  if (!f || draw.area(f) < 10) {
    const [x, y] = projection(markAt);
    marker = `<circle class="m" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">${STYLE}<defs><clipPath id="c"><circle cx="50" cy="50" r="${R}"/></clipPath><radialGradient id="s" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></radialGradient></defs><g clip-path="url(#c)"><circle class="o" cx="50" cy="50" r="${R}"/><path class="g" d="${simplify(draw(geoGraticule10()), 1.5, 0)}"/><path class="l" d="${others}"/>${target ? `<path class="t" d="${target}"/>` : ''}${marker}<circle cx="50" cy="50" r="${R}" fill="url(#s)"/></g><circle class="r" cx="50" cy="50" r="${R}"/></svg>\n`;
  await fs.writeFile(path.join(OUT, `${c.code}.svg`), svg);
  total += svg.length;
}
console.log(`Wrote ${countries.length} globes (${Math.round(total / 1024)} KB total) to public/img/globes`);

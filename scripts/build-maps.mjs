// Renders public/img/maps/<code>.svg: a regional map zoomed on each flag's place (or union of places), highlighted, it and
// its neighbours labelled with their flags where they fit, and a locator globe. maps/plain/<code>.svg has no flags, for questions.
import fs from 'node:fs/promises';
import path from 'node:path';
import { geoArea, geoAzimuthalEqualArea, geoCentroid, geoContains, geoDistance, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import sharp from 'sharp';
import { feature } from 'topojson-client';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public/img/maps');
const W = 150; // viewBox units, 3:2
const H = 100;
const DEG = Math.PI / 180;
const MIN_HALF_VIEW = 4.5 * DEG; // never zoom in further than this, so neighbours stay in view
const MAX_HALF_VIEW = 75 * DEG;
const NEAR = 0.45; // radians; parts further than this from the main landmass don't steer the view

const load = async (res) => {
  const topo = JSON.parse(await fs.readFile(path.join(ROOT, `node_modules/world-atlas/countries-${res}.json`), 'utf8'));
  return feature(topo, topo.objects.countries).features;
};
const world50 = await load('50m');
const world110 = await load('110m');
const countries = [];
for (const set of await fs.readdir(path.join(ROOT, 'data/flags'))) {
  for (const f of (await fs.readdir(path.join(ROOT, 'data/flags', set))).filter((f) => f.endsWith('.json'))) {
    countries.push({ ...JSON.parse(await fs.readFile(path.join(ROOT, 'data/flags', set, f), 'utf8')), set });
  }
}
const byCode = new Map(countries.map((c) => [c.code, c]));

// Outlines world-atlas lacks (states, provinces, UK nations, breakaway regions), keyed by flag code; see fetch-geo.mjs.
const extra = Object.entries(JSON.parse(await fs.readFile(path.join(ROOT, 'data/geo/extra.json'), 'utf8'))).map(
  ([key, x]) => ({ type: 'Feature', id: key, parent: x.parent, properties: { name: x.name }, geometry: x.geometry }),
);
const extraByKey = new Map(extra.map((x) => [x.id, x]));
// Natural Earth names for flags whose world-atlas feature has no ISO number.
const NE_NAME = { Kosovo: 'xk', Somaliland: 'somaliland', 'N. Cyprus': 'northern-cyprus' };
const byIso = new Map(countries.filter((c) => c.isoNumeric).map((c) => [c.isoNumeric, c.code]));
const codeOf = (w) => (byCode.has(w.id) ? w.id : (byIso.get(w.id) ?? NE_NAME[w.properties.name]));

const polygons = (f) =>
  f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
const asFeature = (polys) => ({ type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: polys } });

function focus(f) {
  const parts = polygons(f).map((p) => ({ p, area: geoArea(asFeature([p])), c: geoCentroid(asFeature([p])) }));
  const main = parts.reduce((a, b) => (b.area > a.area ? b : a));
  const near = asFeature(parts.filter((x) => geoDistance(x.c, main.c) < NEAR).map((x) => x.p));
  return { near, center: geoCentroid(near), markAt: main.c };
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

const FONT = 3.8; // label size in viewBox units
const textWidth = (t, size) => t.length * size * 0.56;
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const GLOBE = 13.2; // locator globe radius, viewBox units
const INSET = { x0: W - 2 * GLOBE - 8, y0: H - 2 * GLOBE - 8 };

const parseRings = (d) =>
  d ? d.split('M').filter(Boolean).map((sub) => sub.replace(/Z$/, '').split('L').map((p) => p.split(/[ ,]/).map(Number))) : [];

// Even-odd point-in-polygon over all rings, in screen space (holes such as Lesotho inside South Africa work).
function inside(rings, x, y) {
  let c = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
  }
  return c;
}

// Tiny flag thumbnails inlined as data URIs (an SVG shown through <img> can't load external images).
const thumbs = new Map();
for (const c of countries) {
  try {
    const { data, info } = await sharp(path.join(ROOT, `public/img/flags/320/${c.code}.webp`))
      .resize({ height: 30 })
      .png({ palette: true, quality: 90, compressionLevel: 9 })
      .toBuffer({ resolveWithObject: true });
    thumbs.set(c.code, { uri: `data:image/png;base64,${data.toString('base64')}`, ratio: info.width / info.height });
  } catch {}
}

// Every grid point inside each neighbour's visible land, nearest its visual centre first.
function labelCandidates(base, draw) {
  const candidates = [];
  for (const w of base) {
    const area = draw.area(w);
    if (!(area >= 40)) continue;
    const rings = parseRings(simplify(draw(w), 0.4, 0));
    if (!rings.length) continue;
    const [[bx0, by0], [bx1, by1]] = draw.bounds(w);
    const [x0, y0, x1, y1] = [Math.max(0, bx0), Math.max(0, by0), Math.min(W, bx1), Math.min(H, by1)];
    const step = Math.max(2, Math.sqrt(((x1 - x0) * (y1 - y0)) / 500));
    const pts = [];
    for (let y = y0 + step / 2; y < y1; y += step) for (let x = x0 + step / 2; x < x1; x += step) if (inside(rings, x, y)) pts.push([x, y]);
    if (!pts.length) continue;
    const mx = pts.reduce((sum, q) => sum + q[0], 0) / pts.length;
    const my = pts.reduce((sum, q) => sum + q[1], 0) / pts.length;
    pts.sort((q, r) => Math.hypot(q[0] - mx, q[1] - my) - Math.hypot(r[0] - mx, r[1] - my));
    const code = codeOf(w);
    const names = [...new Set([byCode.get(code)?.name, w.properties.name].filter(Boolean))];
    candidates.push({ area, rings, pts, code, names });
  }
  return candidates.sort((q, r) => r.area - q.area);
}

// Places each label (the name, plus its flag below when wanted and there's room) wholly on that country's land,
// off the highlighted country (unless it is the highlighted one), and clear of everything in `placed`, which it extends.
function labels(candidates, targetRings, placed, withFlags, onTarget = false) {
  const hits = (r) => placed.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0);
  const out = [];
  for (const k of candidates) {
    const thumb = withFlags && k.code ? thumbs.get(k.code) : null;
    const variants = k.names.flatMap((n) => [
      ...(onTarget && thumb ? [[n, FONT * 1.15, true]] : []),
      ...(onTarget ? [[n, FONT * 1.15, false]] : []),
      ...(thumb ? [[n, FONT, true]] : []),
      [n, FONT, false],
      ...(thumb ? [[n, FONT * 0.78, true]] : []),
      [n, FONT * 0.78, false],
    ]);
    let done = false;
    for (const [name, size, flag] of variants) {
      const fh = size * 1.3;
      const fw = flag ? Math.min(fh * thumb.ratio, fh * 1.9) : 0;
      const hw = Math.max(textWidth(name, size), fw) / 2 + 0.8;
      for (const [x, y] of k.pts) {
        const r = { x0: x - hw, x1: x + hw, y0: y - size * 0.7, y1: y + size * 0.55 + (flag ? fh + size * 0.35 : 0) };
        if (r.x0 < 1 || r.x1 > W - 1 || r.y0 < 1 || r.y1 > H - 1 || hits(r)) continue;
        const mid = (r.y0 + r.y1) / 2;
        const probe = [[r.x0, r.y0], [x, r.y0], [r.x1, r.y0], [r.x0, mid], [x, mid], [r.x1, mid], [r.x0, r.y1], [x, r.y1], [r.x1, r.y1]];
        if (!probe.every(([px, py]) => inside(k.rings, px, py) && (onTarget || !inside(targetRings, px, py)))) continue;
        placed.push(r);
        const small = size !== FONT ? ` font-size="${size.toFixed(2)}"` : '';
        out.push(`<text x="${x.toFixed(1)}" y="${(y + size * 0.35).toFixed(1)}"${small}>${esc(name)}</text>`);
        if (flag) {
          const fx = (x - fw / 2).toFixed(2), fy = (y + size * 0.75).toFixed(2), fwS = fw.toFixed(2), fhS = fh.toFixed(2);
          out.push(`<image href="${thumb.uri}" x="${fx}" y="${fy}" width="${fwS}" height="${fhS}" preserveAspectRatio="none"/><rect class="fb" x="${fx}" y="${fy}" width="${fwS}" height="${fhS}"/>`);
        }
        done = true;
        break;
      }
      if (done) break;
    }
  }
  return out.length ? `<g class="${onTarget ? 'n tn' : 'n'}">${out.join('')}</g>` : '';
}

// Azimuthal equal-area maps a point θ radians from the centre to 2·sin(θ/2)·scale.
const scaleForHalfView = (theta) => W / 2 / (2 * Math.sin(theta / 2));

function locator(center) {
  const r = GLOBE, cx = W - r - 4, cy = H - r - 4;
  const proj = geoOrthographic().rotate([-center[0], -center[1]]).scale(r).translate([cx, cy]).clipAngle(90);
  const draw = geoPath(proj).digits(1);
  const land = world110.map((w) => simplify(draw(w), 0.5, 0.6)).join('');
  return `<circle class="io" cx="${cx}" cy="${cy}" r="${r}"/><path class="il" d="${land}"/><circle class="id" cx="${cx}" cy="${cy}" r="2"/><circle class="ir" cx="${cx}" cy="${cy}" r="${r}"/>`;
}

const STYLE = `<style>.o{fill:#b5d7ef}.g{fill:none;stroke:#fff;stroke-opacity:.45;stroke-width:.3}.l{fill:#f3ecd2;stroke:#ad9f78;stroke-width:.3}.t{fill:#d9302b;stroke:#7a1512;stroke-width:.45}.mh{fill:none;stroke:#fff;stroke-width:3}.m{fill:none;stroke:#d9302b;stroke-width:1.6}.io{fill:#4f93c9}.il{fill:#f3ecd2}.id{fill:#d9302b;stroke:#fff;stroke-width:.6}.ir{fill:none;stroke:#fff;stroke-width:1.2}.n{font:500 ${FONT}px system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;fill:#6b6249;text-anchor:middle;paint-order:stroke;stroke:#f3ecd2;stroke-width:.9;stroke-linejoin:round}.fb{fill:none;stroke:#00000040;stroke-width:.15}.tn{font-weight:650;fill:#fff;stroke:#a51f1b;stroke-width:.7}.tn .fb{stroke:#ffffffb0;stroke-width:.3}</style>`;

// A flag's outline: its own extra outline, else its world-atlas country (for a union member code too).
function outline(key) {
  if (extraByKey.has(key)) return extraByKey.get(key);
  const c = byCode.get(key);
  return world50.find((w) => codeOf(w) === key || (c && !c.isoNumeric && c.set !== 'us-states' && c.set !== 'canada' && w.properties.name === c.name));
}
// Countries drawn as their subdivisions when a map highlights one of those (neighbouring states and provinces get labelled).
const SUBDIVIDED = { 840: ['840', '124'], 124: ['840', '124'], 826: ['826'] };

await fs.mkdir(path.join(OUT, 'plain'), { recursive: true });
let total = 0;
for (const c of countries) {
  if (c.shape === false) continue;
  const members = (Array.isArray(c.shape) ? c.shape : [c.code]).map(outline).filter(Boolean);
  const f = members.length ? { type: 'Feature', id: c.code, properties: { name: c.name }, geometry: asFeature(members.flatMap(polygons)).geometry } : null;
  const fallback = [c.latlng[1], c.latlng[0]];
  const parts = members.map(focus);
  const near = parts.length ? asFeature(parts.flatMap((p) => polygons(p.near))) : null;
  const center = near ? geoCentroid(near) : fallback;
  const markAt = parts.length ? parts.reduce((a, b) => (geoArea(b.near) > geoArea(a.near) ? b : a)).markAt : fallback;
  const inTarget = new Set([c.code, ...members.map((m) => codeOf(m) ?? m.id)]);
  const isTarget = (w) => !!f && inTarget.has(codeOf(w) ?? w.id);
  const swap = [...new Set(members.filter((m) => m.parent).flatMap((m) => SUBDIVIDED[m.parent] ?? []))];
  const withParts = (world) => (swap.length ? [...world.filter((w) => !swap.includes(w.id)), ...extra.filter((x) => swap.includes(x.parent))] : world);

  const projection = geoAzimuthalEqualArea().rotate([-center[0], -center[1]]);
  let scale = scaleForHalfView(MIN_HALF_VIEW);
  if (near) {
    projection.fitExtent([[W * 0.2, H * 0.17], [W * 0.8, H * 0.83]], near);
    scale = Math.min(scale, projection.scale());
  }
  scale = Math.max(scale, scaleForHalfView(MAX_HALF_VIEW));

  let draw, others, base;
  // Zoom out until some other land is in view, so remote islands still have context.
  for (;;) {
    projection.scale(scale).translate([W / 2, H / 2]).clipExtent([[0, 0], [W, H]]);
    draw = geoPath(projection).digits(1);
    base = withParts(scale < scaleForHalfView(40 * DEG) ? world110 : world50);
    others = base.filter((w) => !isTarget(w)).map((w) => simplify(draw(w), 0.4, 0.6)).join('');
    const land = base.reduce((sum, w) => sum + (isTarget(w) ? 0 : draw.area(w) || 0), 0);
    if (land > W * H * 0.04 || scale <= scaleForHalfView(MAX_HALF_VIEW)) break;
    scale /= 1.5;
  }
  const target = f ? simplify(draw(f), 0.2, 0) : '';
  let marker = '';
  const avoid = [{ x0: INSET.x0, y0: INSET.y0, x1: W, y1: H }];
  if (!f || draw.area(f) < 12) {
    const [x, y] = projection(markAt);
    avoid.push({ x0: x - 8, y0: y - 8, x1: x + 8, y1: y + 8 });
    marker = `<circle class="mh" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6"/><circle class="m" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6"/>`;
  }
  const candidates = labelCandidates(base.filter((w) => !isTarget(w)), draw);
  const own = f ? labelCandidates([f], draw) : [];
  const targetRings = parseRings(target);
  // The target's own label goes first so neighbours make room for it; plain maps never show its flag.
  const annotate = (withFlags) => {
    const placed = [...avoid];
    const self = labels(own, targetRings, placed, withFlags, true);
    return self + labels(candidates, targetRings, placed, withFlags && c.set !== 'historical');
  };
  const render = (names) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${STYLE}<rect class="o" width="${W}" height="${H}"/><path class="g" d="${simplify(draw(geoGraticule10()), 1.5, 0)}"/><path class="l" d="${others}"/>${target ? `<path class="t" d="${target}"/>` : ''}${marker}${names}${locator(center)}</svg>\n`;
  const full = render(annotate(true));
  await fs.writeFile(path.join(OUT, `${c.code}.svg`), full);
  await fs.writeFile(path.join(OUT, 'plain', `${c.code}.svg`), render(annotate(false)));
  total += full.length;
}
console.log(`Wrote ${countries.filter((c) => c.shape !== false).length} maps (${Math.round(total / 1024)} KB total) to public/img/maps`);

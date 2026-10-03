import { byCode, Country, flagSrc, globeSrc } from './data';

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

export function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export const sample = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

export function flagImg(c: Country, opts: { size?: 'sm' | 'md' | 'lg'; lazy?: boolean; alt?: string } = {}) {
  const { size = 'md', lazy = false } = opts;
  const alt = opts.alt ?? `Flag of ${c.name}`;
  const w = 640;
  const h = Math.round(w / c.ratio);
  const src = size === 'sm' ? flagSrc(c.code, 320) : flagSrc(c.code, 640);
  const srcset = size === 'sm' ? `${flagSrc(c.code, 320)} 1x, ${flagSrc(c.code, 640)} 2x` : '';
  return `<img class="flag flag-${size}${c.transparent ? ' flag-shaped' : ''}" src="${src}"${srcset ? ` srcset="${srcset}"` : ''} width="${w}" height="${h}" alt="${esc(alt)}" style="--ratio:${c.ratio}${lazy && !c.transparent ? `;background-color:${c.color}` : ''}"${lazy ? ' loading="lazy"' : ''} decoding="async" draggable="false">`;
}

export function globeImg(c: Country, size: 'sm' | 'md' | 'lg' = 'md') {
  return `<img class="globe globe-${size}" src="${globeSrc(c.code)}" width="100" height="100" alt="Where ${esc(c.name)} is on the globe" decoding="async" draggable="false">`;
}

export function differencesHtml(c: Country, others: Country[]) {
  const items = others.filter((o) => c.differences[o.code]).map((o) => `<li>${esc(c.differences[o.code])}</li>`);
  return items.length ? `<div class="tell"><span class="hook-label">How to tell them apart</span><ul>${items.join('')}</ul></div>` : '';
}

export const countryLink = (c: Country) => `#/flag/${c.slug}`;

export function lookalikeList(c: Country): Country[] {
  return c.lookalikes.map((k) => byCode.get(k)).filter((x): x is Country => !!x);
}

export function $(sel: string, root: ParentNode = document) {
  return root.querySelector(sel) as HTMLElement;
}

export function $$(sel: string, root: ParentNode = document) {
  return [...root.querySelectorAll(sel)] as HTMLElement[];
}

export const plural = (n: number, word: string, many = word + 's') => `${n} ${n === 1 ? word : many}`;

// Holds a render until its key images are decoded (capped), so flags never pop in; skips if the route changed meanwhile.
export async function renderWhenReady(root: HTMLElement, html: string, images: Promise<void>[], maxWait = 350) {
  const hash = location.hash;
  await Promise.race([Promise.all(images), new Promise((r) => setTimeout(r, maxWait))]);
  if (location.hash !== hash) return false;
  root.innerHTML = html;
  return true;
}

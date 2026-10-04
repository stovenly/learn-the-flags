import { byCode, Country, flagSrc, mapSrc, url } from './data';

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
  const alt = opts.alt ?? `Flag of ${c.theName}`;
  const w = 640;
  const h = Math.round(w / c.ratio);
  const src = size === 'sm' ? flagSrc(c.code, 320) : flagSrc(c.code, 640);
  const srcset = size === 'sm' ? `${flagSrc(c.code, 320)} 1x, ${flagSrc(c.code, 640)} 2x` : '';
  return `<img class="flag flag-${size}${c.transparent ? ' flag-shaped' : ''}" src="${src}"${srcset ? ` srcset="${srcset}"` : ''} width="${w}" height="${h}" alt="${esc(alt)}" style="--ratio:${c.ratio}${lazy && !c.transparent ? `;background-color:${c.color}` : ''}"${lazy ? ' loading="lazy"' : ''} decoding="async" draggable="false">`;
}

// `plain` leaves neighbours' flags off the map, for questions where they would give options away.
export function mapImg(c: Country, size: 'xs' | 'sm' | 'md' | 'lg' = 'md', plain = false) {
  if (!c.hasMap) return '';
  return `<img class="map map-${size}" src="${mapSrc(c.code, plain)}" width="150" height="100" alt="Map showing where ${esc(c.name)} is" decoding="async" draggable="false">`;
}

const ICONS = {
  hook: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
  tell: '<circle cx="12" cy="12" r="3"/><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  cross: '<path d="M6 6l12 12M18 6L6 18"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
};

export const icon = (name: keyof typeof ICONS, cls = 'icon') =>
  `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

// A flag centred in a fixed 3:2 frame, so rows and grids line up whatever the flag's proportions.
export const thumb = (c: Country, lazy = false) => `<span class="thumb">${flagImg(c, { size: 'sm', lazy, alt: '' })}</span>`;

// Each flag the hook names gets a small copy of itself right after the name.
export const hookText = (c: Country) =>
  c.hookParts.map((p) => (typeof p === 'string' ? esc(p) : `${esc(p[0])}<img class="inline-flag" src="${flagSrc(p[1], 320)}" alt="" decoding="async">`)).join('');

export function hookHtml(c: Country, label = 'Memory hook') {
  return c.hook ? `<div class="note note-hook">${icon('hook')}<div><span class="note-label">${label}</span><p>${hookText(c)}</p></div></div>` : '';
}

// One row per lookalike: its flag, its name, and how to tell it apart from `c`.
export function pairList(c: Country, others: Country[], link = false) {
  if (!others.length) return '';
  return `<ul class="pairs">${others
    .map((o) => {
      const tag = link ? `a href="${countryLink(o)}"` : 'div';
      return `<li><${tag} class="pair">${thumb(o)}<span><strong>${esc(o.name)}</strong>${c.differences[o.code] ? `<span class="pair-text">${esc(c.differences[o.code])}</span>` : ''}</span></${link ? 'a' : 'div'}></li>`;
    })
    .join('')}</ul>`;
}

export const countryLink = (c: Country) => url(`flags/${c.slug}/`);

export function nameLink(c: Country) {
  return `<a class="name-link" href="${countryLink(c)}" target="_blank" rel="noopener" title="Read about ${esc(c.name)} in a new tab">${esc(c.name)}<svg class="ext" viewBox="0 0 16 16" aria-hidden="true"><path d="M7 3H3.5A.5.5 0 0 0 3 3.5v9a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5V9M10 3h3v3M13 3 7.5 8.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="sr-only"> (opens in a new tab)</span></a>`;
}

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
  const path = location.pathname;
  await Promise.race([Promise.all(images), new Promise((r) => setTimeout(r, maxWait))]);
  if (location.pathname !== path) return false;
  root.innerHTML = html;
  return true;
}

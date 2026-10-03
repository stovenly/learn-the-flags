import { byCode, Country, flagSrc } from './data';

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

// `size` is the CSS display height in px; the width follows the flag's true aspect ratio.
export function flagImg(c: Country, opts: { size?: 'sm' | 'md' | 'lg'; lazy?: boolean; alt?: string } = {}) {
  const { size = 'md', lazy = false } = opts;
  const alt = opts.alt ?? `Flag of ${c.name}`;
  const w = 640;
  const h = Math.round(w / c.ratio);
  const src = size === 'sm' ? flagSrc(c.code, 320) : flagSrc(c.code, 640);
  const srcset = size === 'sm' ? `${flagSrc(c.code, 320)} 1x, ${flagSrc(c.code, 640)} 2x` : '';
  return `<img class="flag flag-${size}${c.transparent ? ' flag-shaped' : ''}" src="${src}"${srcset ? ` srcset="${srcset}"` : ''} width="${w}" height="${h}" alt="${esc(alt)}" style="--ratio:${c.ratio}"${lazy ? ' loading="lazy"' : ''} decoding="async" draggable="false">`;
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

export function relativeDay(ms: number): string {
  const days = Math.round((ms - Date.now()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 30) return `in ${days} days`;
  if (days < 365) return `in ${Math.round(days / 30)} months`;
  return `in ${(days / 365).toFixed(1)} years`;
}

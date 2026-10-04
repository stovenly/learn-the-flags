import raw from './generated/countries.json';
import rawSets from './generated/sets.json';

export interface Country {
  code: string;
  set: string;
  name: string;
  theName: string; // "the United States", for running text
  slug: string;
  officialName: string;
  aliases: string[];
  status: 'un-member' | 'un-observer' | null;
  region: string;
  subregion: string;
  continent: string | null; // sovereign states only
  capital: string;
  population: number | null;
  area: number | null;
  localNames: { language: string; name: string; romanized: string }[];
  localLine: string; // "Nippon · 日本", built by build-data.mjs
  languages: string[];
  currencies: { name: string; code: string; symbol: string }[];
  demonym: string;
  facts: [string, string][];
  flag: { description: string; adopted: string; colors: string[]; symbolism: string };
  hook: string;
  trivia: string[];
  lookalikes: string[];
  identical: string[]; // flags with the same design, never offered as each other's wrong answer
  differences: Record<string, string>; // lookalike code → how to tell the two apart
  nearest: string[];
  hasMap: boolean;
  rank: number | null;
  ratio: number;
  transparent: boolean;
  color: string;
}

export interface FlagSet {
  id: string;
  name: string;
  noun: string; // "Which <noun> is this?"
  description: string;
  cover: string; // a flag code, or "icon:<name>" for a drawn icon (see SET_ICONS in home.ts)
}

export const ALL = raw as unknown as Country[];
export const byCode = new Map(ALL.map((c) => [c.code, c]));
export const SETS = rawSets as FlagSet[];
export const SOVEREIGN = 'sovereign';
export const setById = new Map(SETS.map((s) => [s.id, s]));
export const inSet = (id: string) => ALL.filter((c) => c.set === id);
export const CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'];

export const STATUS_LABEL: Record<string, string> = {
  'un-observer': 'UN observer state',
};

// Neighbours are learned together, best-known (most populous) first within each subregion.
const SUBREGION_ORDER = [
  'Western Europe', 'Northern Europe', 'Southern Europe', 'Central Europe', 'Southeast Europe', 'Eastern Europe',
  'North America', 'Central America', 'Caribbean', 'South America',
  'Eastern Asia', 'South-Eastern Asia', 'Southern Asia', 'Western Asia', 'Central Asia',
  'Northern Africa', 'Western Africa', 'Middle Africa', 'Eastern Africa', 'Southern Africa',
  'Australia and New Zealand', 'Melanesia', 'Micronesia', 'Polynesia',
];

// Other sets go in their curated order, else best-known (most populous) first.
export function curriculum(list: Country[]): Country[] {
  const group = (c: Country) => {
    if (c.set !== SOVEREIGN) return c.rank ?? Infinity;
    const i = SUBREGION_ORDER.indexOf(c.subregion);
    return i === -1 ? SUBREGION_ORDER.length : i;
  };
  return [...list].sort((a, b) => group(a) - group(b) || (b.population ?? 0) - (a.population ?? 0));
}

// Site root path from the page's <base> tag ("/" locally, "/<repo>/" on a project page); every app URL is built from it.
export const BASE = new URL(document.baseURI).pathname;
export const url = (path = '') => BASE + path;
export const flagSrc = (code: string, w: 320 | 640 = 640) => url(`img/flags/${w}/${code}.webp`);
export const mapSrc = (code: string, plain = false) => url(`img/maps/${plain ? 'plain/' : ''}${code}.svg`);

const imageCache = new Map<string, Promise<void>>();
function preloadSrc(src: string): Promise<void> {
  let p = imageCache.get(src);
  if (!p) {
    const img = new Image();
    img.src = src;
    p = img.decode().catch(() => {});
    imageCache.set(src, p);
  }
  return p;
}
export const preload = (code: string, w: 320 | 640 = 640) => preloadSrc(flagSrc(code, w));
export const preloadMap = (c: Country, plain = false) => (c.hasMap ? preloadSrc(mapSrc(c.code, plain)) : Promise.resolve());

export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\bst\b\.?/g, 'saint')
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9]/g, '');
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

export type Match = 'exact' | 'typo' | 'wrong';

export function matchAnswer(input: string, c: Country): Match {
  const guess = normalize(input);
  if (!guess) return 'wrong';
  const local = c.localNames.flatMap((l) => [l.name, l.romanized]).filter(Boolean);
  const targets = [c.name, c.officialName, ...c.aliases, ...local].map(normalize).filter(Boolean);
  if (targets.includes(guess)) return 'exact';
  // A typo must not land on a different country's name ("Niger" vs "Nigeria").
  for (const other of ALL) {
    if (other.code !== c.code && [other.name, ...other.aliases].map(normalize).includes(guess)) return 'wrong';
  }
  const tolerance = (t: string) => (t.length <= 4 ? 0 : t.length <= 8 ? 1 : 2);
  return targets.some((t) => editDistance(guess, t) <= tolerance(t)) ? 'typo' : 'wrong';
}

export const localNameText = (c: Country) => c.localLine;

export const currencyText = (c: Country) =>
  c.currencies.map((x) => (x.symbol && x.symbol !== x.code ? `${x.name} (${x.symbol})` : x.name)).join(', ');

export const fmtNumber = (n: number | null) => (n == null ? '—' : n.toLocaleString('en-US'));

export function fmtPopulation(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} billion`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)} million`;
  return n.toLocaleString('en-US');
}

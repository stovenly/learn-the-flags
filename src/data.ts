import raw from './generated/countries.json';

export interface Country {
  code: string;
  name: string;
  slug: string;
  officialName: string;
  aliases: string[];
  status: 'un-member' | 'un-observer' | 'partially-recognized';
  capital: string;
  region: string;
  subregion: string;
  population: number | null;
  area: number | null;
  languages: string[];
  currencies: string[];
  demonym: string;
  flag: { description: string; adopted: string; colors: string[]; symbolism: string };
  hook: string;
  trivia: string[];
  lookalikes: string[];
  nearest: string[];
  ratio: number;
  transparent: boolean;
  color: string;
}

export const ALL: Country[] = raw as Country[];
export const byCode = new Map(ALL.map((c) => [c.code, c]));
export const REGIONS = ['Europe', 'Asia', 'Africa', 'Americas', 'Oceania'];

export const STATUS_LABEL: Record<Country['status'], string> = {
  'un-member': 'UN member',
  'un-observer': 'UN observer state',
  'partially-recognized': 'Partially recognized',
};

// Neighbours are learned together, best-known (most populous) first within each subregion.
const SUBREGION_ORDER = [
  'Western Europe', 'Northern Europe', 'Southern Europe', 'Central Europe', 'Southeast Europe', 'Eastern Europe',
  'North America', 'Central America', 'Caribbean', 'South America',
  'Eastern Asia', 'South-Eastern Asia', 'Southern Asia', 'Western Asia', 'Central Asia',
  'Northern Africa', 'Western Africa', 'Middle Africa', 'Eastern Africa', 'Southern Africa',
  'Australia and New Zealand', 'Melanesia', 'Micronesia', 'Polynesia',
];

export function curriculum(list: Country[]): Country[] {
  const rank = (c: Country) => {
    const i = SUBREGION_ORDER.indexOf(c.subregion);
    return i === -1 ? SUBREGION_ORDER.length : i;
  };
  return [...list].sort((a, b) => rank(a) - rank(b) || (b.population ?? 0) - (a.population ?? 0));
}

export const flagSrc = (code: string, w: 320 | 640 = 640) => `img/flags/${w}/${code}.webp`;

const imageCache = new Map<string, Promise<void>>();
export function preload(code: string, w: 320 | 640 = 640): Promise<void> {
  const key = `${w}/${code}`;
  let p = imageCache.get(key);
  if (!p) {
    const img = new Image();
    img.src = flagSrc(code, w);
    p = img.decode().catch(() => {});
    imageCache.set(key, p);
  }
  return p;
}

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
  const targets = [c.name, c.officialName, ...c.aliases].map(normalize);
  if (targets.includes(guess)) return 'exact';
  // A typo must not land on a different country's name ("Niger" vs "Nigeria").
  for (const other of ALL) {
    if (other.code !== c.code && [other.name, ...other.aliases].map(normalize).includes(guess)) return 'wrong';
  }
  const tolerance = (t: string) => (t.length <= 4 ? 0 : t.length <= 8 ? 1 : 2);
  return targets.some((t) => editDistance(guess, t) <= tolerance(t)) ? 'typo' : 'wrong';
}

export const fmtNumber = (n: number | null) => (n == null ? '—' : n.toLocaleString('en-US'));

export function fmtPopulation(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} billion`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)} million`;
  return n.toLocaleString('en-US');
}

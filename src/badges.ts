import { ALL, byCode, CONTINENTS, Country, flagSrc, SETS, SOVEREIGN } from './data';
import { bestStreak, level, save, state } from './store';
import { esc, plural } from './ui';

export interface Badge {
  id: string; // "streak:20", "learn:<set id or continent>", "quiz:<set id or continent>"; keys state.badges
  name: string;
  goal: string;
  reason: string; // completes "You earned this …"
  art: string;
  qualifies: () => boolean;
  live?: boolean; // taken back when it stops qualifying, e.g. after new flags are added
  progress: () => string;
}

interface Category {
  key: string;
  badge: string;
  flags: string;
  set: string;
  continent?: string;
  list: Country[];
}

const ADJECTIVE: Record<string, string> = {
  Africa: 'African',
  Asia: 'Asian',
  Europe: 'European',
  'North America': 'North American',
  'South America': 'South American',
  Oceania: 'Oceanian',
};

const CATEGORIES: Category[] = [
  ...SETS.flatMap((s) => {
    const own = { key: s.id, badge: s.badge, flags: s.flags, set: s.id, list: ALL.filter((c) => c.set === s.id) };
    if (s.id !== SOVEREIGN) return [own];
    const parts = CONTINENTS.map((k) => ({ key: k, badge: k, flags: `${ADJECTIVE[k]} flags`, set: s.id, continent: k, list: own.list.filter((c) => c.continent === k) }));
    return [own, ...parts];
  }),
].filter((c) => c.list.length);
const EVERY: Category = { key: 'all', badge: 'All Flags', flags: 'flags', set: '', list: ALL };

// Picked by hand where the best-known flags would make a grim badge.
const MOSAIC: Record<string, string[]> = {
  historical: ['ussr', 'ottoman-empire', 'austria-hungary', 'holy-roman-empire'],
  all: ['us', 'us-ca', 'ussr', 'un'],
};

function mosaic(cat: Category) {
  const picks = MOSAIC[cat.key]?.map((k) => byCode.get(k)!) ??
    [...cat.list].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || (b.population ?? 0) - (a.population ?? 0)).slice(0, 4);
  return `<span class="badge-mosaic">${picks.map((c) => `<img src="${flagSrc(c.code, 320)}" alt="" loading="lazy" decoding="async">`).join('')}</span>`;
}

const SEAL = {
  learn: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>',
  quiz: '<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="currentColor"/>',
};

const categoryArt = (kind: 'learn' | 'quiz', cat: Category) =>
  `<span class="badge-art badge-${kind}${cat === EVERY ? ' badge-every' : ''}"><span class="badge-frame">${mosaic(cat)}</span><span class="badge-seal"><svg viewBox="0 0 24 24" aria-hidden="true">${SEAL[kind]}</svg></span></span>`;

const learnedIn = (cat: Category) => cat.list.filter((c) => ['known', 'mastered'].includes(level(c.code))).length;

// Quiz keys are "<deckKey>:<kind>", and a deckKey is "<set>" or "sovereign:<continent>,<continent>…".
function quizScope(key: string) {
  const [set, ...rest] = key.split(':');
  return { set, continents: rest.length > 1 ? rest[0].split(',') : CONTINENTS };
}

const perfectlyQuizzed = (list: Country[]) =>
  list.filter((c) =>
    Object.entries(state.quizzes).some(([key, q]) => {
      const { set, continents } = quizScope(key);
      return q.total && q.correct === q.total && set === c.set && (set !== SOVEREIGN || continents.includes(c.continent!));
    }),
  ).length;

function quizBest(cat: Category): number {
  let best = -1;
  for (const [key, q] of Object.entries(state.quizzes)) {
    const { set, continents } = quizScope(key);
    if (set === cat.set && q.total && (cat.continent ? continents.includes(cat.continent) : continents.length === CONTINENTS.length)) best = Math.max(best, q.correct / q.total);
  }
  return best;
}

function categoryBadge(kind: 'learn' | 'quiz', cat: Category): Badge {
  const all = `all ${cat.list.length} ${cat.flags}`;
  if (cat === EVERY) {
    const covered = () => perfectlyQuizzed(ALL);
    return kind === 'learn'
      ? {
          id: 'learn:all',
          name: 'All Flags Scholar',
          goal: `Learn every flag on the site, all ${ALL.length} of them.`,
          reason: `for learning every flag on the site, all ${ALL.length} of them`,
          art: categoryArt(kind, cat),
          qualifies: () => learnedIn(cat) === ALL.length,
          progress: () => `${learnedIn(cat)} of ${ALL.length} learned so far`,
          live: true,
        }
      : {
          id: 'quiz:all',
          name: 'All Flags Quiz Master',
          goal: `Get a perfect quiz on every set of flags, so all ${ALL.length} are covered.`,
          reason: `for perfect quizzes covering all ${ALL.length} flags on the site`,
          art: categoryArt(kind, cat),
          qualifies: () => covered() === ALL.length,
          progress: () => `${covered()} of ${ALL.length} flags covered by a perfect quiz so far`,
          live: true,
        };
  }
  return kind === 'learn'
    ? {
        id: `learn:${cat.key}`,
        name: `${cat.badge} Scholar`,
        goal: `Learn ${all}.`,
        reason: `for learning ${all}`,
        art: categoryArt(kind, cat),
        qualifies: () => learnedIn(cat) === cat.list.length,
        progress: () => `${learnedIn(cat)} of ${cat.list.length} learned so far`,
      }
    : {
        id: `quiz:${cat.key}`,
        name: `${cat.badge} Quiz Master`,
        goal: `Get every answer right in a quiz on ${all}.`,
        reason: `for a perfect quiz on ${all}`,
        art: categoryArt(kind, cat),
        qualifies: () => quizBest(cat) === 1,
        progress: () => (quizBest(cat) < 0 ? 'No quiz on these yet' : `Best score so far: ${Math.round(quizBest(cat) * 100)}%`),
      };
}

interface Tier {
  from: number; // streak length in days where this look starts
  rim: string[];
  face: string[];
  ink: string;
  edge: 'circle' | 'scallop' | 'burst';
  points: number;
  wreath?: string;
  ribbon?: boolean;
  crown?: boolean;
}

const BRONZE = ['#f9cf9f', '#c27a40', '#74390f'];
const SILVER = ['#ffffff', '#c5ccd5', '#7b8591'];
const GOLD = ['#fff4b8', '#f0bd2e', '#9c6704'];
const PLATINUM = ['#ffffff', '#d6defb', '#8592c4'];
const TIERS: Tier[] = [
  { from: 3, rim: BRONZE, face: ['#eaa56c', '#94501f'], ink: '#fff6ec', edge: 'circle', points: 0 },
  { from: 5, rim: BRONZE, face: ['#eaa56c', '#94501f'], ink: '#fff6ec', edge: 'scallop', points: 14 },
  { from: 10, rim: SILVER, face: ['#eef2f6', '#93a0ad'], ink: '#27313b', edge: 'scallop', points: 16 },
  { from: 20, rim: SILVER, face: ['#eef2f6', '#93a0ad'], ink: '#27313b', edge: 'burst', points: 12 },
  { from: 30, rim: GOLD, face: ['#ffdc63', '#cc8500'], ink: '#4f3000', edge: 'burst', points: 12 },
  { from: 50, rim: GOLD, face: ['#ffdc63', '#cc8500'], ink: '#4f3000', edge: 'burst', points: 16, wreath: '#e2ad22' },
  { from: 70, rim: GOLD, face: ['#45e3a0', '#08683f'], ink: '#ffffff', edge: 'burst', points: 16, wreath: '#e2ad22' },
  { from: 100, rim: GOLD, face: ['#ff6f82', '#930c27'], ink: '#ffffff', edge: 'burst', points: 20, wreath: '#e2ad22', ribbon: true },
  { from: 200, rim: PLATINUM, face: ['#70adff', '#18379a'], ink: '#ffffff', edge: 'burst', points: 24, wreath: '#c6d2f6', ribbon: true },
  { from: 300, rim: GOLD, face: ['#ff7ad9', '#7b5cff', '#22c8ff'], ink: '#ffffff', edge: 'burst', points: 24, wreath: '#f3c74a', ribbon: true, crown: true },
];

const tierOf = (n: number) => TIERS.filter((t) => n >= t.from).length - 1;

// 3, 5, 10, then every 10 days.
const streakMark = (i: number) => (i === 0 ? 3 : i === 1 ? 5 : (i - 1) * 10);
const marksUpTo = (n: number) => {
  const out: number[] = [];
  for (let i = 0; streakMark(i) <= n; i++) out.push(streakMark(i));
  return out;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const at = (r: number, deg: number) => [r2(50 + r * Math.cos((deg * Math.PI) / 180)), r2(50 + r * Math.sin((deg * Math.PI) / 180))];

function burst(R: number, r: number, n: number) {
  return `M${Array.from({ length: n * 2 }, (_, i) => at(i % 2 ? r : R, -90 + (i * 180) / n).join(' ')).join('L')}Z`;
}

function scallop(R: number, n: number) {
  const p = (i: number) => at(R - 2.6, -90 + (i * 360) / n);
  const bump = r2((R - 2.6) * Math.sin(Math.PI / n) * 1.08);
  return `M${p(0).join(' ')}${Array.from({ length: n }, (_, i) => `A${bump} ${bump} 0 0 1 ${p(i + 1).join(' ')}`).join('')}Z`;
}

function wreath(R: number, color: string) {
  const leaves: string[] = [];
  for (let a = 104, k = 0; a <= 240; a += 13, k++) {
    const side = k % 2 ? 1 : -1;
    const [x, y] = at(R + side * 2.4, a);
    const rot = a + 90 + side * 32;
    leaves.push(`<ellipse cx="${x}" cy="${y}" rx="5" ry="2.1" transform="rotate(${r2(rot)} ${x} ${y})"/>`);
    leaves.push(`<ellipse cx="${r2(100 - x)}" cy="${y}" rx="5" ry="2.1" transform="rotate(${r2(180 - rot)} ${r2(100 - x)} ${y})"/>`);
  }
  const stem = (from: number, to: number, sweep: number) => `M${at(R, from).join(' ')}A${R} ${R} 0 0 ${sweep} ${at(R, to).join(' ')}`;
  return `<g fill="${color}" stroke="rgba(0,0,0,.28)" stroke-width=".4"><path d="${stem(98, 240, 1)}${stem(82, -60, 0)}" fill="none" stroke="${color}" stroke-width="1.2"/>${leaves.join('')}</g>`;
}

function streakArt(n: number) {
  const ti = tierOf(n);
  const t = TIERS[ti];
  const id = `streak-tier-${ti}`;
  const R = t.wreath ? 35 : 40;
  const fr = R - 9;
  const digits = String(n).length;
  const size = r2(fr * (digits <= 2 ? 0.8 : digits === 3 ? 0.62 : 0.5));
  const stops = (cs: string[]) => cs.map((c, i) => `<stop offset="${i / (cs.length - 1)}" stop-color="${c}"/>`).join('');
  const edge =
    t.edge === 'circle' ? `<circle cx="50" cy="50" r="${R}"/>` : `<path d="${t.edge === 'scallop' ? scallop(R, t.points) : burst(R, R - 6, t.points)}"/>`;
  const ribbon = (x: (v: number) => number) =>
    `<path d="M${x(40)} 72L${x(27)} 97L${x(33.5)} 93.5L${x(37)} 99.5L${x(49)} 76Z" fill="${t.face[t.face.length - 1]}" stroke="${t.rim[2]}" stroke-width=".8"/>`;
  return `<svg class="badge-art badge-streak tier-${ti}" viewBox="0 0 100 100" aria-hidden="true">
    <defs>
      <linearGradient id="${id}-rim" x1="0" y1="0" x2=".8" y2="1">${stops(t.rim)}</linearGradient>
      <linearGradient id="${id}-face" x1="0" y1="0" x2=".7" y2="1">${stops(t.face)}</linearGradient>
      <clipPath id="${id}-clip"><circle cx="50" cy="50" r="${fr}"/></clipPath>
    </defs>
    ${t.ribbon ? ribbon((v) => v) + ribbon((v) => 100 - v) : ''}
    ${t.wreath ? wreath(R + 6, t.wreath) : ''}
    <g fill="url(#${id}-rim)" stroke="${t.rim[2]}" stroke-width=".8" stroke-linejoin="round">${edge}</g>
    <circle cx="50" cy="50" r="${fr + 2}" fill="${t.rim[2]}" opacity=".55"/>
    <circle cx="50" cy="50" r="${fr}" fill="url(#${id}-face)"/>
    <g clip-path="url(#${id}-clip)">
      <ellipse cx="42" cy="${50 - fr * 0.6}" rx="${fr * 0.95}" ry="${fr * 0.5}" fill="#fff" opacity=".2"/>
      ${t.crown ? '<path class="badge-sheen" d="M30 0h9L25 100h-9z" fill="#fff" opacity=".45"/>' : ''}
    </g>
    <path d="M50 ${r2(50 - fr * 0.78)}c2.6 2.6 4 4.6 4 6.6a4 4 0 0 1-8 0c0-1.6.9-2.8 1.9-3.9.2 1.3.8 2 1.6 2.2-.5-1.6-.3-3.2.5-4.9z" fill="${t.ink}" opacity=".9"/>
    <text x="50" y="${r2(50 + size * 0.36)}" text-anchor="middle" font-size="${size}" font-weight="800" fill="${t.ink}">${n}</text>
    <text x="50" y="${r2(50 + fr * 0.66)}" text-anchor="middle" font-size="5.6" font-weight="700" letter-spacing=".9" fill="${t.ink}" opacity=".85">DAYS</text>
    ${
      t.crown
        ? `<path d="M37 17L34.5 5.5L42.5 11L50 2.5L57.5 11L65.5 5.5L63 17Z" fill="url(#${id}-rim)" stroke="${t.rim[2]}" stroke-width=".8" stroke-linejoin="round"/>
           <circle cx="50" cy="12" r="2" fill="${t.face[0]}"/><circle cx="42.5" cy="14" r="1.4" fill="${t.face[2]}"/><circle cx="57.5" cy="14" r="1.4" fill="${t.face[2]}"/>`
        : ''
    }
  </svg>`;
}

function streakBadge(n: number): Badge {
  return {
    id: `streak:${n}`,
    name: `${n}-Day Streak`,
    goal: `Practise ${n} days in a row.`,
    reason: `for practising ${n} days in a row`,
    art: streakArt(n),
    qualifies: () => bestStreak() >= n,
    progress: () => `Longest streak so far: ${plural(bestStreak(), 'day')}`,
  };
}

export function badgeById(id: string): Badge | undefined {
  const [kind, key] = id.split(':');
  if (kind === 'streak') return streakBadge(Number(key));
  const cat = [...CATEGORIES, EVERY].find((c) => c.key === key);
  return cat && (kind === 'learn' || kind === 'quiz') ? categoryBadge(kind, cat) : undefined;
}

// Earned badges are kept for good, even if a streak later breaks or a flag slips back to "in progress"; live ones are not.
export function awardBadges(): Badge[] {
  const all = [...marksUpTo(bestStreak()).map(streakBadge), ...[...CATEGORIES, EVERY].flatMap((c) => [categoryBadge('learn', c), categoryBadge('quiz', c)])];
  const lost = all.filter((b) => b.live && state.badges[b.id] && !b.qualifies());
  const won = all.filter((b) => !state.badges[b.id] && b.qualifies());
  const now = Date.now();
  for (const b of lost) delete state.badges[b.id];
  for (const b of won) state.badges[b.id] = now;
  if (won.length || lost.length) save();
  const topStreak = won.filter((b) => b.id.startsWith('streak:')).pop();
  return won.filter((b) => !b.id.startsWith('streak:') || b === topStreak);
}

// Streak badges: the highest earned of each look, then the next one to reach.
export function shownBadges(): { badge: Badge; earned: boolean }[] {
  const streaks = Object.keys(state.badges)
    .filter((k) => k.startsWith('streak:'))
    .map((k) => Number(k.slice(7)))
    .sort((a, b) => a - b);
  const top = streaks.at(-1) ?? 0;
  const shown = streaks.filter((n, i) => tierOf(streaks[i + 1] ?? Infinity) !== tierOf(n) || n === top);
  const next = marksUpTo(top + 10).find((n) => n > top)!;
  return [
    ...shown.map((n) => ({ badge: streakBadge(n), earned: true })),
    { badge: streakBadge(next), earned: false },
    ...(['learn', 'quiz'] as const).flatMap((kind) =>
      [...CATEGORIES, EVERY].map((c) => {
        const badge = categoryBadge(kind, c);
        return { badge, earned: !!state.badges[badge.id] };
      }),
    ),
  ];
}

export const badgeTile = (b: Badge, earned: boolean) =>
  `<div class="badge${earned ? '' : ' locked'}" tabindex="0" data-badge="${esc(b.id)}" aria-label="${esc(`${b.name}${earned ? '' : ', not earned yet'}. ${b.goal}`)}">${b.art}<span class="badge-name">${esc(b.name)}</span></div>`;

export function badgeTip(id: string): string {
  const b = badgeById(id);
  if (!b) return '';
  const when = state.badges[id];
  const status = when ? `Earned ${new Date(when).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : b.progress();
  return `<div class="tip-head"><strong>${esc(b.name)}</strong></div><span class="tip-goal">${esc(b.goal)}</span><span>${esc(status)}</span>`;
}

export function badgeNews(won: Badge[]): string {
  if (!won.length) return '';
  return `<section class="badge-news">
    <h3 class="label">${won.length === 1 ? 'You earned a badge' : `You earned ${won.length} badges`}</h3>
    ${won.map((b) => `<div class="badge-won">${b.art}<p><strong>${esc(b.name)}</strong><span>You earned this ${esc(b.reason)}.</span></p></div>`).join('')}
  </section>`;
}

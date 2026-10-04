import { ALL, byCode, CONTINENTS, Country, flagSrc, SETS, SOVEREIGN } from './data';
import { bestStreak, level, save, state, streak } from './store';
import { esc } from './ui';

export interface Badge {
  id: string; // "learn:<set id or continent>" and "quiz:<…>" key state.badges; "streak:now" and "streak:best" are worked out live
  name: string;
  goal: string;
  done: string;
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

const r2 = (n: number) => Math.round(n * 100) / 100;
const at = (r: number, deg: number, cx = 50, cy = 50) => [r2(cx + r * Math.cos((deg * Math.PI) / 180)), r2(cy + r * Math.sin((deg * Math.PI) / 180))];

function burst(R: number, r: number, n: number, cx = 50, cy = 50) {
  return `M${Array.from({ length: n * 2 }, (_, i) => at(i % 2 ? r : R, -90 + (i * 180) / n, cx, cy).join(' ')).join('L')}Z`;
}

// Picked by hand where the best-known flags would make a grim badge.
const MOSAIC: Record<string, string[]> = {
  historical: ['ussr', 'ottoman-empire', 'austria-hungary', 'holy-roman-empire'],
  all: ['us', 'us-ca', 'ca-qc', 'un'],
};

function mosaic(cat: Category) {
  const picks = MOSAIC[cat.key]?.map((k) => byCode.get(k)!) ??
    [...cat.list].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) || (b.population ?? 0) - (a.population ?? 0)).slice(0, 4);
  return `<span class="badge-mosaic">${picks.map((c) => `<img src="${flagSrc(c.code, 320)}" alt="" loading="lazy" decoding="async">`).join('')}<span class="badge-sheen badge-glint"></span></span>`;
}

const FRAME = {
  learn: ['#a8f7cd', '#22a865', '#0a4f2c'],
  quiz: ['#ddd0ff', '#7b54f0', '#2f1385'],
  every: ['#fff6c2', '#f2b51c', '#7a4a00'],
};

const hex = (r: number) => Array.from({ length: 6 }, (_, i) => at(r, -90 + i * 60).join(',')).join(' ');
const sparkle = (x: number, y: number, s: number) => `<path class="badge-twinkle" d="${burst(s, s / 4, 4, x, y)}"/>`;

// The flags sit in an HTML mosaic between two SVG layers; the mosaic's box in styles.css matches the hex(35) and r=33.5 openings.
function categoryArt(kind: 'learn' | 'quiz', cat: Category) {
  const every = cat === EVERY;
  const [hi, mid, lo] = FRAME[every ? 'every' : kind];
  const id = `badge-${every ? 'every-' : ''}${kind}`;
  const leaf = (x: number, y: number, rot: number) => `<ellipse cx="${x}" cy="${y}" rx="4.2" ry="1.7" transform="rotate(${rot} ${x} ${y})"/>`;
  const sprigs = [-1, 1]
    .map((d) => leaf(r2(50 + d * 45.5), 50, 0) + leaf(r2(50 + d * 44), 43.5, d * -40) + leaf(r2(50 + d * 44), 56.5, d * 40))
    .join('');
  const back =
    kind === 'learn'
      ? `<g fill="${mid}" stroke="${lo}" stroke-width=".5">${sprigs}</g>
        <polygon points="${hex(46)}" fill="${lo}"/>
        <polygon points="${hex(43)}" fill="url(#${id})"/>
        <polygon points="${hex(36.6)}" fill="none" stroke="${hi}" stroke-width=".8" opacity=".9"/>
        <g fill="${hi}" stroke="${lo}" stroke-width=".5">${Array.from({ length: 6 }, (_, i) => `<circle cx="${at(39.6, -90 + i * 60)[0]}" cy="${at(39.6, -90 + i * 60)[1]}" r="1.7"/>`).join('')}</g>`
      : `<path d="${burst(48, 41.5, 20)}" fill="url(#${id})" stroke="${lo}" stroke-width=".6" stroke-linejoin="round"/>
        <circle cx="50" cy="50" r="40.5" fill="${lo}"/>
        <circle cx="50" cy="50" r="39" fill="url(#${id})"/>
        <g fill="${hi}">${Array.from({ length: 24 }, (_, i) => `<circle cx="${at(36.3, i * 15)[0]}" cy="${at(36.3, i * 15)[1]}" r="1"/>`).join('')}</g>`;
  const edge = kind === 'learn' ? `<polygon points="${hex(35)}"/>` : '<circle cx="50" cy="50" r="33.5"/>';
  const top = every
    ? `<path d="M38 13L35.5 1.5L43.5 7L50 -1.5L56.5 7L64.5 1.5L62 13Z" fill="url(#${id})" stroke="${lo}" stroke-width=".7" stroke-linejoin="round"/><circle cx="50" cy="8.5" r="1.8" fill="#fff"/>
      <g fill="#fff" stroke="${mid}" stroke-width=".6">${sparkle(8, 14, 5.5)}${sparkle(93, 22, 4)}${sparkle(91, 90, 5.5)}${sparkle(7, 84, 4)}</g>`
    : kind === 'learn'
      ? `<path d="M50 0.5l3 3.5-3 3.5-3-3.5z" fill="${hi}" stroke="${lo}" stroke-width=".5"/>`
      : `<path d="${burst(5.5, 2.3, 5, 50, 7)}" fill="${hi}" stroke="${lo}" stroke-width=".5" stroke-linejoin="round"/>`;
  return `<span class="badge-art badge-${kind}${every ? ' badge-every' : ''}">
    <svg class="badge-decor" viewBox="0 0 100 100" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".5" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></linearGradient></defs>
      ${every ? `<path class="badge-rays" d="${burst(58, 30, 32)}" fill="${mid}" opacity=".45"/>${wreath(47.5, mid)}` : ''}
      ${back}
    </svg>
    ${mosaic(cat)}
    <svg class="badge-decor" viewBox="0 0 100 100" aria-hidden="true">
      <g fill="none" stroke="${lo}" stroke-width="1.2">${edge}</g>
      ${top}
    </svg>
  </span>`;
}

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
  const every = cat === EVERY;
  const what = every ? 'every flag' : `all ${cat.list.length} ${cat.flags}`;
  const n = cat.list.length;
  return kind === 'learn'
    ? {
        id: `learn:${cat.key}`,
        name: `${cat.badge} Scholar`,
        goal: `Learn ${what}.`,
        done: `Learned ${what}.`,
        art: categoryArt(kind, cat),
        qualifies: () => learnedIn(cat) === n,
        progress: () => `${learnedIn(cat)}/${n} learned`,
        live: every,
      }
    : {
        id: `quiz:${cat.key}`,
        name: `${cat.badge} Quiz Master`,
        goal: every ? 'Score 100% on quizzes covering every flag.' : `Score 100% on a quiz of ${what}.`,
        done: every ? 'Scored 100% on quizzes covering every flag.' : `Scored 100% on ${what}.`,
        art: categoryArt(kind, cat),
        qualifies: () => (every ? perfectlyQuizzed(ALL) === n : quizBest(cat) === 1),
        progress: () => (every ? `${perfectlyQuizzed(ALL)}/${n} covered` : quizBest(cat) < 0 ? 'No quiz yet' : `Best: ${Math.round(quizBest(cat) * 100)}%`),
        live: every,
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
      <path class="badge-sheen" d="M30 0h9L25 100h-9z" fill="#fff" opacity=".45"/>
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

function scallop(R: number, n: number) {
  const p = (i: number) => at(R - 2.6, -90 + (i * 360) / n);
  const bump = r2((R - 2.6) * Math.sin(Math.PI / n) * 1.08);
  return `M${p(0).join(' ')}${Array.from({ length: n }, (_, i) => `A${bump} ${bump} 0 0 1 ${p(i + 1).join(' ')}`).join('')}Z`;
}

// "now" is the running streak, whose number changes daily and whose look follows TIERS; "best" shows only once it beats "now".
function streakBadge(which: 'now' | 'best'): Badge {
  const n = which === 'now' ? streak() : bestStreak();
  const next = TIERS.find((t) => t.from > n)?.from;
  return {
    id: `streak:${which}`,
    name: which === 'best' ? `Best: ${n} Days` : `${Math.max(n, 3)}-Day Streak`,
    goal: which === 'best' ? 'Your longest streak.' : n >= 3 ? 'Days in a row you’ve practised.' : 'Practise 3 days in a row.',
    done: `${n} days in a row.`,
    art: streakArt(Math.max(n, 3)),
    qualifies: () => n >= 3,
    progress: () => (which === 'best' ? '' : n < 3 ? `${n}/3 days` : next ? `New look at ${next} days` : ''),
  };
}

export function badgeById(id: string): Badge | undefined {
  const [kind, key] = id.split(':');
  if (kind === 'streak') return streakBadge(key === 'best' ? 'best' : 'now');
  const cat = [...CATEGORIES, EVERY].find((c) => c.key === key);
  return cat && (kind === 'learn' || kind === 'quiz') ? categoryBadge(kind, cat) : undefined;
}

const categoryBadges = () => [...(['learn', 'quiz'] as const).flatMap((kind) => [...CATEGORIES, EVERY].map((c) => categoryBadge(kind, c)))];

// Earned badges are kept for good, even if a flag slips back to "in progress"; live ones are not.
// With withStreak, every new streak day from 3 on is news too, once.
export function awardBadges(withStreak = false): Badge[] {
  const all = categoryBadges();
  const lost = all.filter((b) => b.live && state.badges[b.id] && !b.qualifies());
  const won = all.filter((b) => !state.badges[b.id] && b.qualifies());
  const now = Date.now();
  for (const b of lost) delete state.badges[b.id];
  for (const b of won) state.badges[b.id] = now;
  const days = streak();
  const streakNews = withStreak && days >= 3 && days !== state.streakSeen;
  if (streakNews) state.streakSeen = days;
  if (won.length || lost.length || streakNews) save();
  return [...(streakNews ? [streakBadge('now')] : []), ...won];
}

export function shownBadges(): { badge: Badge; earned: boolean }[] {
  const now = streakBadge('now');
  const best = bestStreak() > streak() && bestStreak() >= 3 ? [{ badge: streakBadge('best'), earned: true }] : [];
  return [{ badge: now, earned: now.qualifies() }, ...best, ...categoryBadges().map((badge) => ({ badge, earned: !!state.badges[badge.id] }))];
}

export const badgeTile = (b: Badge, earned: boolean) =>
  `<div class="badge${earned ? '' : ' locked'}" tabindex="0" data-badge="${esc(b.id)}" aria-label="${esc(`${b.name}${earned ? '' : ', not earned yet'}. ${b.goal}`)}">${b.art}<span class="badge-name">${esc(b.name)}</span></div>`;

export function badgeTip(id: string): string {
  const b = badgeById(id);
  if (!b) return '';
  const when = state.badges[id];
  const status = when ? `Earned ${new Date(when).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : b.progress();
  return `<div class="tip-head"><strong>${esc(b.name)}</strong></div><span class="tip-goal">${esc(b.goal)}</span>${status ? `<span>${esc(status)}</span>` : ''}`;
}

export function badgeNews(won: Badge[]): string {
  if (!won.length) return '';
  return `<section class="badge-news">
    <h3 class="label">${won.length === 1 ? 'You earned a badge' : `You earned ${won.length} badges`}</h3>
    ${won.map((b) => `<div class="badge-won">${b.art}<p><strong>${esc(b.name)}</strong><span>${esc(b.done)}</span></p></div>`).join('')}
  </section>`;
}

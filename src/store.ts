import { ALL, CONTINENTS, Country, curriculum, setById, SOVEREIGN } from './data';
import { dayNumber, endOfDay, Memory, retrievability } from './srs';

export interface Settings {
  lessonSize: number;
  retention: number; // target recall probability, 0.8..0.97
  answerStyle: 'auto' | 'choice' | 'typing';
  set: string; // the set new flags come from
  continents: string[]; // narrows the sovereign set
  theme: 'auto' | 'light' | 'dark';
  dyslexic: boolean;
  quizKind: string; // a KINDS slug in views/quiz.ts
}

export interface DayLog {
  reviews: number;
  correct: number;
  learned: number;
}

export interface SessionLog {
  at: number; // ms epoch, session start
  ms: number;
  answered: number;
  correct: number;
  learned: string[];
  missed: string[];
  quiz?: string; // what a quiz covered, e.g. "Africa · Country → flag"; absent for lessons
}

interface State {
  version: 1;
  cards: Record<string, Memory>;
  days: Record<string, DayLog>; // keyed by dayNumber()
  sessions: SessionLog[]; // newest first
  quizzes: Record<string, QuizBest>; // keyed by deckKey()
  badges: Record<string, number>; // badge id (see badges.ts) → ms epoch earned
  streakSeen: number; // the streak length last announced at the end of a session
  learnedSeen: number; // the learned-flag count last announced, likewise
  settings: Settings;
}

export interface QuizBest {
  correct: number;
  total: number;
  at: number; // ms epoch
}

export const LESSON_SIZES = [5, 10, 15, 20, 25];

const KEY = 'learn-the-flags:v1';
const DEFAULTS: Settings = {
  lessonSize: 5,
  retention: 0.9,
  answerStyle: 'auto',
  set: SOVEREIGN,
  continents: CONTINENTS,
  theme: 'auto',
  dyslexic: false,
  quizKind: 'name-to-flag',
};

function settingsFrom(saved: Record<string, unknown> = {}): Settings {
  const { includePartial, focusRegion, ...rest } = saved;
  const s = { ...DEFAULTS, ...rest } as Settings;
  if (!saved.continents && typeof focusRegion === 'string' && focusRegion !== 'all') {
    s.continents = focusRegion === 'Americas' ? ['North America', 'South America'] : [focusRegion];
  }
  if (!setById.has(s.set)) s.set = SOVEREIGN;
  s.continents = CONTINENTS.filter((k) => s.continents.includes(k));
  if (!s.continents.length) s.continents = CONTINENTS;
  if (!LESSON_SIZES.includes(s.lessonSize)) s.lessonSize = DEFAULTS.lessonSize;
  return s;
}

function load(): State {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '');
    if (s?.version === 1) return { ...s, sessions: s.sessions ?? [], quizzes: s.quizzes ?? {}, badges: s.badges ?? {}, streakSeen: s.streakSeen ?? 0, learnedSeen: s.learnedSeen ?? 0, settings: settingsFrom(s.settings) };
  } catch {}
  return { version: 1, cards: {}, days: {}, sessions: [], quizzes: {}, badges: {}, streakSeen: 0, learnedSeen: 0, settings: settingsFrom() };
}

export const state = load();

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

// The flags chosen for learning: one set, and for sovereign states only the chosen continents.
export function deck(set = state.settings.set, continents = state.settings.continents): Country[] {
  return ALL.filter((c) => c.set === set && (set !== SOVEREIGN || continents.includes(c.continent!)));
}

export function chooseDeck(set: string, continents = state.settings.continents) {
  state.settings.set = set;
  state.settings.continents = continents;
  save();
}

export type Level = 'new' | 'learning' | 'known' | 'mastered';

// Stability in days: under 7 still learning, 7..60 known, beyond 60 mastered.
export function level(code: string): Level {
  const m = state.cards[code];
  if (!m) return 'new';
  if (m.s < 7) return 'learning';
  if (m.s < 60) return 'known';
  return 'mastered';
}

export function today(): DayLog {
  const k = String(dayNumber(Date.now()));
  return (state.days[k] ??= { reviews: 0, correct: 0, learned: 0 });
}

// Reviews follow the chosen set (and continents), like new flags; other sets' flags wait until they are chosen again.
export function dueCards(now = Date.now()): Country[] {
  return deck()
    .filter((c) => state.cards[c.code] && state.cards[c.code].due <= now)
    .sort((a, b) => retrievability(state.cards[a.code], now) - retrievability(state.cards[b.code], now));
}

export function dueLaterToday(now = Date.now()): number {
  const cutoff = endOfDay(now);
  return ALL.filter((c) => state.cards[c.code] && state.cards[c.code].due > now && state.cards[c.code].due < cutoff).length;
}

export function newCards(): Country[] {
  return curriculum(deck().filter((c) => !state.cards[c.code]));
}

export function streak(): number {
  let d = dayNumber(Date.now());
  if (!state.days[d]?.reviews) d--;
  let n = 0;
  while (state.days[d]?.reviews) {
    n++;
    d--;
  }
  return n;
}

export function bestStreak(): number {
  let best = 0, run = 0, prev = NaN;
  for (const d of Object.keys(state.days).map(Number).sort((a, b) => a - b)) {
    if (!state.days[d].reviews) continue;
    run = d === prev + 1 ? run + 1 : 1;
    prev = d;
    best = Math.max(best, run);
  }
  return best;
}

export function logSession(log: SessionLog) {
  state.sessions.unshift(log);
  state.sessions.length = Math.min(state.sessions.length, 500);
  save();
}

export function exportProgress(): string {
  return JSON.stringify(state, null, 2);
}

export function importProgress(json: string) {
  const s = JSON.parse(json);
  if (s?.version !== 1 || typeof s.cards !== 'object') throw new Error('That is not a Learn the Flags progress file.');
  state.cards = s.cards;
  state.days = s.days ?? {};
  state.sessions = s.sessions ?? [];
  state.quizzes = s.quizzes ?? {};
  state.badges = s.badges ?? {};
  state.streakSeen = s.streakSeen ?? 0;
  state.learnedSeen = s.learnedSeen ?? 0;
  state.settings = settingsFrom(s.settings);
  save();
}

export function resetProgress() {
  state.cards = {};
  state.days = {};
  state.sessions = [];
  state.quizzes = {};
  state.badges = {};
  state.streakSeen = 0;
  state.learnedSeen = 0;
  save();
}

// Identifies the chosen flags, so quiz scores on different selections are kept apart.
export function deckKey(set = state.settings.set, continents = state.settings.continents): string {
  return set === SOVEREIGN && continents.length < CONTINENTS.length ? `${set}:${continents.join(',')}` : set;
}

// Saves a finished quiz and returns the best score before it.
export function recordQuiz(key: string, correct: number, total: number): QuizBest | undefined {
  const prev = state.quizzes[key];
  if (!prev || correct / total > prev.correct / prev.total) state.quizzes[key] = { correct, total, at: Date.now() };
  save();
  return prev;
}

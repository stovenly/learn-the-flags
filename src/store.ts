import { ALL, Country, curriculum } from './data';
import { dayNumber, endOfDay, Memory, retrievability } from './srs';

export interface Settings {
  lessonSize: number;
  retention: number; // target recall probability, 0.8..0.97
  answerStyle: 'auto' | 'choice' | 'typing';
  includePartial: boolean;
  focusRegion: string; // 'all' or a region name
  theme: 'auto' | 'light' | 'dark';
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
}

interface State {
  version: 1;
  cards: Record<string, Memory>;
  days: Record<string, DayLog>; // keyed by dayNumber()
  sessions: SessionLog[]; // newest first
  settings: Settings;
}

const KEY = 'learn-the-flags:v1';
const DEFAULTS: Settings = {
  lessonSize: 5,
  retention: 0.9,
  answerStyle: 'auto',
  includePartial: false,
  focusRegion: 'all',
  theme: 'auto',
};

function load(): State {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '');
    if (s?.version === 1) return { ...s, sessions: s.sessions ?? [], settings: { ...DEFAULTS, ...s.settings } };
  } catch {}
  return { version: 1, cards: {}, days: {}, sessions: [], settings: { ...DEFAULTS } };
}

export const state = load();

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

export function deck(): Country[] {
  return ALL.filter((c) => state.settings.includePartial || c.status !== 'partially-recognized');
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

export function dueCards(now = Date.now()): Country[] {
  return deck()
    .filter((c) => state.cards[c.code] && state.cards[c.code].due <= now)
    .sort((a, b) => retrievability(state.cards[a.code], now) - retrievability(state.cards[b.code], now));
}

export function dueLaterToday(now = Date.now()): number {
  const cutoff = endOfDay(now);
  return deck().filter((c) => state.cards[c.code] && state.cards[c.code].due > now && state.cards[c.code].due < cutoff).length;
}

export function newCards(): Country[] {
  const pool = deck().filter(
    (c) => !state.cards[c.code] && (state.settings.focusRegion === 'all' || c.region === state.settings.focusRegion),
  );
  return curriculum(pool);
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
  state.settings = { ...DEFAULTS, ...s.settings };
  save();
}

export function resetProgress() {
  state.cards = {};
  state.days = {};
  state.sessions = [];
  save();
}

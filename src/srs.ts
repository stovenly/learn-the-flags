// FSRS-6 scheduler with the reference default parameters (open-spaced-repetition/ts-fsrs).
export type Grade = 1 | 2 | 3 | 4;
export const Again = 1, Hard = 2, Good = 3, Easy = 4;

const W = [
  0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483,
  0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542,
];
const DECAY = -W[20];
const FACTOR = Math.pow(0.9, 1 / DECAY) - 1;
const S_MIN = 0.001;
const S_MAX = 36500;
const DAY = 86400000;
// Local day rolls over at 04:00, so late-night study counts toward the same day.
const ROLLOVER_HOURS = 4;

const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);

export interface Memory {
  s: number; // stability, days
  d: number; // difficulty, 1..10
  last: number; // ms epoch
  due: number; // ms epoch
  reps: number;
  lapses: number;
}

export function dayNumber(ms: number): number {
  const d = new Date(ms - ROLLOVER_HOURS * 3600000);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
}

export function endOfDay(ms: number): number {
  const d = new Date(ms - ROLLOVER_HOURS * 3600000);
  d.setHours(24 + ROLLOVER_HOURS, 0, 0, 0);
  return d.getTime();
}

export function retrievability(m: Memory, now = Date.now()): number {
  const t = Math.max(0, (now - m.last) / DAY);
  return Math.pow(1 + (FACTOR * t) / m.s, DECAY);
}

const initDifficulty = (g: Grade) => W[4] - Math.exp((g - 1) * W[5]) + 1;

function nextDifficulty(d: number, g: Grade): number {
  const delta = -W[6] * (g - 3);
  const next = d + (delta * (10 - d)) / 9;
  return clamp(W[7] * initDifficulty(Easy) + (1 - W[7]) * next, 1, 10);
}

function recallStability(d: number, s: number, r: number, g: Grade): number {
  const hard = g === Hard ? W[15] : 1;
  const easy = g === Easy ? W[16] : 1;
  return clamp(s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp((1 - r) * W[10]) - 1) * hard * easy), S_MIN, S_MAX);
}

function forgetStability(d: number, s: number, r: number): number {
  const fs = W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp((1 - r) * W[14]);
  return clamp(Math.min(s / Math.exp(W[17] * W[18]), fs), S_MIN, S_MAX);
}

function shortTermStability(s: number, g: Grade): number {
  let sinc = Math.pow(s, -W[19]) * Math.exp(W[17] * (g - 3 + W[18]));
  if (g >= Hard) sinc = Math.max(sinc, 1);
  return clamp(s * sinc, S_MIN, S_MAX);
}

export function intervalDays(s: number, retention: number): number {
  return (s / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
}

export function review(m: Memory | undefined, g: Grade, retention: number, now = Date.now()): Memory {
  let s: number, d: number;
  const elapsed = m ? dayNumber(now) - dayNumber(m.last) : 0;
  if (!m) {
    s = Math.max(W[g - 1], 0.1);
    d = clamp(initDifficulty(g), 1, 10);
  } else {
    const r = retrievability(m, now);
    if (elapsed === 0) s = shortTermStability(m.s, g);
    else if (g === Again) s = forgetStability(m.d, m.s, r);
    else s = recallStability(m.d, m.s, r, g);
    d = nextDifficulty(m.d, g);
  }
  let ivl = intervalDays(s, retention);
  if (ivl >= 2.5) ivl *= 0.95 + Math.random() * 0.1;
  const days = clamp(Math.round(ivl), 1, S_MAX);
  // Due at the start of the target day so a card is reviewable all of that day.
  const due = endOfDay(now) + (days - 1) * DAY;
  return {
    s,
    d,
    last: now,
    due,
    reps: (m?.reps ?? 0) + 1,
    lapses: (m?.lapses ?? 0) + (m && elapsed > 0 && g === Again ? 1 : 0),
  };
}

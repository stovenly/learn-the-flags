import { url } from '../data';
import { deck, deckKey, state } from '../store';
import { shuffle } from '../ui';
import { Mode, quiz, runSession } from './session';

// URL slug → question kind; the slug keeps "Try again" on the same kind.
export const KINDS: { slug: string; mode: Mode; title: (noun: string) => string; detail: string }[] = [
  { slug: 'name-to-flag', mode: 'pick-flag', title: (n) => `${n} → flag`, detail: 'See a name, pick its flag from four.' },
  { slug: 'flag-to-name', mode: 'pick-name', title: (n) => `Flag → ${n.toLowerCase()}`, detail: 'See a flag, pick its name from four.' },
  { slug: 'typed', mode: 'type-name', title: (n) => `Flag → ${n.toLowerCase()}, typed`, detail: 'See a flag, type its name.' },
];

export const quizKind = () => KINDS.find((k) => k.slug === state.settings.quizKind) ?? KINDS[0];

// Every chosen flag once, in random order, scored at the end; answers don't touch the review schedule.
export function quizView(root: HTMLElement, param: string) {
  const kind = KINDS.find((k) => k.slug === param) ?? quizKind();
  runSession(root, {
    items: shuffle(deck()).map((c) => quiz(c, kind.mode)),
    scheduled: false,
    test: { key: `${deckKey()}:${kind.slug}` },
    title: 'Quiz',
    onDone: () => `<a class="btn ghost" href="${url()}">Home</a><a class="btn primary" href="${url(`quiz/${kind.slug}/`)}">Try again</a>`,
  });
}

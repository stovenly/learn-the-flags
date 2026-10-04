import { CONTINENTS, setById, SOVEREIGN, url } from '../data';
import { deck, deckKey, state } from '../store';
import { $$, esc, icon, shuffle } from '../ui';
import { Mode, quiz, runSession } from './session';

// URL slug → question kind; the slug keeps "Try again" on the same kind.
export const KINDS: { slug: string; mode: Mode; title: (noun: string) => string; detail: string }[] = [
  { slug: 'name-to-flag', mode: 'pick-flag', title: (n) => `${n} → flag`, detail: 'See a name, pick its flag from four.' },
  { slug: 'flag-to-name', mode: 'pick-name', title: (n) => `Flag → ${n.toLowerCase()}`, detail: 'See a flag, pick its name from four.' },
  { slug: 'typed', mode: 'type-name', title: (n) => `Flag → ${n.toLowerCase()}, typed`, detail: 'See a flag, type its name.' },
];

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// Every chosen flag once, in random order, scored at the end; answers don't touch the review schedule.
export function quizView(root: HTMLElement, param: string) {
  const list = deck();
  const kind = KINDS.find((k) => k.slug === param);
  if (!kind) return chooseKind(root, list.length);
  runSession(root, {
    items: shuffle(list).map((c) => quiz(c, kind.mode)),
    scheduled: false,
    test: { key: `${deckKey()}:${kind.slug}` },
    title: 'Quiz',
    onDone: () => `<a class="btn ghost" href="${url()}">Home</a><a class="btn primary" href="${url(`quiz/${kind.slug}/`)}">Try again</a>`,
  });
}

function chooseKind(root: HTMLElement, size: number) {
  const { set, continents } = state.settings;
  const s = setById.get(set)!;
  const noun = s.noun.includes(' ') ? 'Name' : cap(s.noun);
  const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
  const scope = set === SOVEREIGN && continents.length < CONTINENTS.length ? list(continents) : s.name;
  root.innerHTML = `
    <article class="card stage quiz-kind fade-in">
      <span class="pill">Quiz</span>
      <h1>${esc(scope)}</h1>
      <p class="muted">${size} flags</p>
      <div class="kinds">
        ${KINDS.map((k) => {
          const best = state.quizzes[`${deckKey()}:${k.slug}`];
          return `<a class="kind" href="${url(`quiz/${k.slug}/`)}">
            <strong>${esc(k.title(noun))}</strong>
            <span class="muted">${k.detail}</span>
            ${best ? `<span class="kind-best">Best ${Math.round((best.correct / best.total) * 100)}%</span>` : ''}
            ${icon('arrow', 'icon kind-go')}
          </a>`;
        }).join('')}
      </div>
      <a class="back" href="${url()}">← Back</a>
    </article>`;
  $$('.kind', root)[0]?.focus({ preventScroll: true });
}

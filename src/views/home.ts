import { byCode, url, CONTINENTS, Country, curriculum, inSet, preload, setById, SETS, SOVEREIGN } from '../data';
import { chooseDeck, deck, deckKey, dueCards, level, newCards, state, streak } from '../store';
import { $$, countryLink, esc, flagImg, icon, plural, renderWhenReady, sample, thumb } from '../ui';

function ring(pct: number) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return `<svg class="ring" viewBox="0 0 120 120" aria-hidden="true">
    <circle cx="60" cy="60" r="${r}" class="ring-track"/>
    <circle cx="60" cy="60" r="${r}" class="ring-fill" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/>
  </svg>`;
}

const HERO = ['jp', 'br', 'ca', 'za', 'np', 'ch', 'kr', 'bt', 'gb'];

// One pick per visit, so changing the set doesn't swap the card and jolt the page.
let fact: { c: Country; text: string } | null = null;

function didYouKnow(images: Promise<void>[]): string {
  if (fact) {
    images.push(preload(fact.c.code, 320));
    return triviaCard(fact.c, fact.text);
  }
  const seen = Object.keys(state.cards).map((k) => byCode.get(k)).filter((c): c is Country => !!c && c.trivia.length > 0);
  const pool = seen.length >= 3 ? seen : deck().filter((c) => c.trivia.length);
  if (!pool.length) return '';
  const c = sample(pool);
  fact = { c, text: sample(c.trivia) };
  images.push(preload(c.code, 320));
  return triviaCard(c, fact.text);
}

function triviaCard(c: Country, text: string) {
  return `
    <a class="card trivia-card" href="${countryLink(c)}">
      ${thumb(c)}
      <div>
        <p class="label">Did you know?</p>
        <p>${esc(text)}</p>
        <span class="more">More about ${esc(c.name)} ${icon('arrow', 'icon icon-sm')}</span>
      </div>
    </a>`;
}

function upNext(list: Country[], images: Promise<void>[]) {
  if (!list.length) return '';
  list.forEach((c) => images.push(preload(c.code, 320)));
  return `<div class="up-next">
    <span class="label">Up next</span>
    <div class="up-next-flags">${list.map((c) => thumb(c)).join('')}</div>
  </div>`;
}

// "Learned" means held over several days (Progress uses the same rule), not merely introduced.
const learnedIn = (list: Country[]) => list.filter((c) => ['known', 'mastered'].includes(level(c.code))).length;

function setOption(id: string, images: Promise<void>[]) {
  const s = setById.get(id)!;
  const list = inSet(id);
  const done = learnedIn(list);
  const cover = byCode.get(s.cover);
  if (cover) images.push(preload(cover.code, 320));
  return `<button class="set-option" role="radio" aria-checked="${id === state.settings.set}" data-set="${id}">
    ${cover ? thumb(cover) : ''}<span class="set-name">${esc(s.name)}</span><span class="set-count">${done ? `${done}/${list.length}` : list.length}</span>
  </button>`;
}

function picker(images: Promise<void>[]) {
  const { set, continents } = state.settings;
  const all = continents.length === CONTINENTS.length;
  const chip = (value: string, label: string, on: boolean) =>
    `<button class="chip chip-sm${on ? ' active' : ''}" aria-pressed="${on}" data-continent="${value}">${label}</button>`;
  const best = state.quizzes[deckKey()];
  const size = deck().length;
  return `<section class="card picker">
    <div class="picker-head">
      <h2>What to learn</h2>
      <div class="quiz-cta">
        ${best ? `<span class="muted small">Best ${Math.round((best.correct / best.total) * 100)}%</span>` : ''}
        <a class="btn ghost small" href="${url('quiz/')}">Quiz me on all ${size}</a>
      </div>
    </div>
    <div class="sets" role="radiogroup" aria-label="Flag set">
      <div class="set-main">
        ${setOption(SOVEREIGN, images)}
        ${
          set === SOVEREIGN
            ? `<div class="continents" role="group" aria-label="Continents">${chip('all', 'All', all)}${CONTINENTS.map((k) => chip(k, k, !all && continents.includes(k))).join('')}</div>`
            : ''
        }
      </div>
      <div class="set-others">${SETS.filter((s) => s.id !== SOVEREIGN).map((s) => setOption(s.id, images)).join('')}</div>
    </div>
  </section>`;
}

function bindPicker(root: HTMLElement) {
  const refresh = (focus: string) => paint(root, scrollY, focus);
  for (const b of $$('[data-set]', root)) {
    b.addEventListener('click', () => {
      if (b.dataset.set === state.settings.set) return;
      chooseDeck(b.dataset.set!);
      refresh(`[data-set="${b.dataset.set}"]`);
    });
  }
  // "All" covers every continent; picking a continent from "All" narrows to it, and emptying the list goes back to "All".
  for (const b of $$('[data-continent]', root)) {
    b.addEventListener('click', () => {
      const k = b.dataset.continent!;
      const cur = state.settings.continents;
      let next = k === 'all' ? CONTINENTS : cur.length === CONTINENTS.length ? [k] : cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
      if (!next.length) next = CONTINENTS;
      chooseDeck(SOVEREIGN, CONTINENTS.filter((x) => next.includes(x)));
      refresh(`[data-continent="${k}"]`);
    });
  }
}

export function homeView(root: HTMLElement) {
  fact = null;
  paint(root);
}

function paint(root: HTMLElement, keepScroll?: number, focus?: string) {
  const all = deck();
  const learned = learnedIn(all);
  const everything = state.settings.set === SOVEREIGN && state.settings.continents.length === CONTINENTS.length;
  const due = dueCards().length;
  const upcoming = newCards();
  const remaining = upcoming.length;
  const fresh = Math.min(remaining, state.settings.lessonSize);
  const started = Object.keys(state.cards).length > 0;
  const days = streak();
  const hero = everything ? HERO.map((k) => byCode.get(k)).filter((c): c is Country => !!c) : curriculum(all).slice(0, 9);
  const images: Promise<void>[] = started ? [] : hero.map((c) => preload(c.code, 320));

  let title: string;
  let cta: string;
  let next = '';
  if (!started) {
    title = 'Learn every flag in the world';
    cta = `<a class="btn primary big" href="${url('study/')}">Start learning ${icon('arrow')}</a>`;
  } else if (due) {
    title = plural(due, 'flag') + ' to review';
    cta = `<a class="btn primary big" href="${url('study/')}">Review ${icon('arrow')}</a>${remaining ? `<a class="btn ghost big" href="${url('study/new/')}">Learn new flags</a>` : ''}`;
  } else if (remaining) {
    title = "Today's flags";
    cta = `<a class="btn primary big" href="${url('study/')}">Start ${icon('arrow')}</a>`;
    next = upNext(upcoming.slice(0, fresh), images);
  } else {
    title = 'All learned';
    cta = `<a class="btn ghost big" href="${url('flags/')}">Browse all flags</a>`;
  }

  const html = `
    <section class="card today${started ? ' started' : ''}">
      <div class="today-main">
        <h1>${esc(title)}</h1>
        <div class="today-cta">${cta}</div>
        ${next}
      </div>
      ${
        started
          ? `<a class="today-ring" href="${url('progress/')}" aria-label="See your progress">
              ${ring(learned / all.length)}
              <div class="ring-label"><strong>${learned}</strong><span>of ${all.length} flags</span></div>
              ${days > 1 ? `<p class="streak">${days}-day streak</p>` : ''}
            </a>`
          : `<div class="hero-flags" aria-hidden="true">${hero
              .map((c) => flagImg(c, { size: 'sm', alt: '' }))
              .join('')}</div>`
      }
    </section>

    ${picker(images)}

    ${didYouKnow(images)}

    ${
      started
        ? ''
        : `<section class="about">
            <h2>How it works</h2>
            <div class="features">
              <div><span class="step">1</span><h3>Meet a few flags</h3><p>A handful at a time, with a tip for each.</p></div>
              <div><span class="step">2</span><h3>Review them</h3><p>Just before you'd forget.</p></div>
              <div><span class="step">3</span><h3>Tell lookalikes apart</h3><p>Chad or Romania? You'll know.</p></div>
            </div>
            <p class="muted small">Free. No account needed.</p>
          </section>`
    }`;
  renderWhenReady(root, html, images, keepScroll === undefined ? 350 : 0).then((shown) => {
    if (!shown) return;
    bindPicker(root);
    if (keepScroll !== undefined) scrollTo(0, keepScroll);
    if (focus) root.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true });
  });
}

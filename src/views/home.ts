import { byCode, url, CONTINENTS, Country, FlagSet, inSet, preload, setById, SETS, SOVEREIGN } from '../data';
import { chooseDeck, deck, deckKey, dueCards, level, newCards, state, streak } from '../store';
import { attachTips } from '../tips';
import { $$, countryLink, esc, icon, plural, renderWhenReady, sample, shuffle, thumb } from '../ui';

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
    <div class="up-next-flags">${list.map((c) => `<span class="tip-target" tabindex="0" data-tip="${c.code}" aria-label="${esc(c.name)}">${thumb(c)}</span>`).join('')}</div>
  </div>`;
}

// "Learned" means held over several days (Progress uses the same rule), not merely introduced.
const learnedIn = (list: Country[]) => list.filter((c) => ['known', 'mastered'].includes(level(c.code))).length;

// Sets that no single flag stands for get a drawn icon instead (24×24, stroked).
const SET_ICONS: Record<string, string> = {
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.7 3.9 5.7 3.9 9s-1.3 6.3-3.9 9c-2.6-2.7-3.9-5.7-3.9-9S9.4 5.7 12 3z"/>',
  island: '<path d="M2 20c3.3-1.6 6.7-1.6 10 0s6.7 1.6 10 0"/><path d="M12 18.5c-.2-4 .6-7.3 2.5-10"/><path d="M14.5 8.5C13 6.3 10 5.8 7.5 7.3M14.5 8.5c1.8-2 4.6-2.1 6.5-.3M14.5 8.5c-.3-2.4 1-4.4 3.3-5.3M14.5 8.5c-2.6-.8-5.3.4-6.4 2.8"/>',
  contested: '<path d="M5 21V3"/><path d="M5 4h13l-3 4.5 3 4.5H5" stroke-dasharray="2.6 2.4"/>',
  hourglass: '<path d="M6 3h12M6 21h12"/><path d="M7.5 3c0 4.5 9 5 9 9s-9 4.5-9 9M16.5 3c0 4.5-9 5-9 9s9 4.5 9 9"/>',
};

function cover(s: FlagSet, images: Promise<void>[]) {
  if (s.cover.startsWith('icon:')) {
    return `<span class="thumb set-icon"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${SET_ICONS[s.cover.slice(5)]}</svg></span>`;
  }
  const c = byCode.get(s.cover);
  if (!c) return '';
  images.push(preload(c.code, 320));
  return thumb(c);
}

function setOption(id: string, images: Promise<void>[]) {
  const s = setById.get(id)!;
  const list = inSet(id);
  const done = learnedIn(list);
  return `<button class="set-option" role="radio" aria-checked="${id === state.settings.set}" data-set="${id}">
    ${cover(s, images)}<span class="set-name">${esc(s.name)}</span><span class="set-count">${done ? `${done}/${list.length}` : list.length}</span>
  </button>`;
}

// The chosen flags: a set, narrowed by continent for sovereign states. Learn and Quiz below both follow it.
function filter(images: Promise<void>[]) {
  const { set, continents } = state.settings;
  const all = continents.length === CONTINENTS.length;
  const chip = (value: string, label: string, on: boolean) =>
    `<button class="chip chip-sm${on ? ' active' : ''}" aria-pressed="${on}" data-continent="${value}">${label}</button>`;
  return `<section class="card picker" aria-labelledby="picker-title">
    <h2 class="label" id="picker-title">Choose your flags</h2>
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
  attachTips(root);
}

function paint(root: HTMLElement, keepScroll?: number, focus?: string) {
  const all = deck();
  const learned = learnedIn(all);
  const due = dueCards().length;
  const upcoming = newCards();
  const started = Object.keys(state.cards).length > 0;
  const days = streak();
  const best = state.quizzes[deckKey()];
  const images: Promise<void>[] = [];

  let status: string;
  let actions: string;
  let next = '';
  if (due) {
    status = `${plural(due, 'flag')} to review`;
    actions = `<a class="btn primary" href="${url('study/')}">Review ${icon('arrow')}</a>${upcoming.length ? `<a class="btn ghost" href="${url('study/new/')}">Learn new flags</a>` : ''}`;
  } else if (upcoming.length) {
    status = "Today's flags";
    actions = `<a class="btn primary" href="${url('study/')}">${started ? 'Start' : 'Start learning'} ${icon('arrow')}</a>`;
    next = upNext(upcoming.slice(0, state.settings.lessonSize), images);
  } else {
    status = 'All learned';
    actions = `<a class="btn ghost" href="${url('flags/')}">Browse flags</a>`;
  }
  const preview = shuffle(all).slice(0, 15);
  preview.forEach((c) => images.push(preload(c.code, 320)));

  const html = `
    ${started ? '<h1 class="sr-only">Learn the Flags</h1>' : '<h1 class="home-title">Learn every flag in the world</h1>'}

    ${filter(images)}

    <div class="modes">
      <section class="card mode">
        <div class="mode-head">
          <h2>Learn</h2>
          <a class="mode-meta" href="${url('progress/')}">${learned} of ${all.length} learned${days > 1 ? ` · ${days}-day streak` : ''}</a>
        </div>
        <div class="meter" aria-hidden="true"><span class="seg seg-learned" style="width:${(learned / all.length) * 100}%"></span></div>
        <p class="mode-status">${esc(status)}</p>
        ${next}
        <div class="mode-actions">${actions}</div>
      </section>
      <section class="card mode">
        <div class="mode-head">
          <h2>Quiz</h2>
          ${best ? `<span class="mode-meta">Best ${Math.round((best.correct / best.total) * 100)}%</span>` : ''}
        </div>
        <p class="mode-status">All ${all.length} flags, once each</p>
        <div class="quiz-flags" aria-hidden="true">${preview.map((c) => thumb(c)).join('')}</div>
        <div class="mode-actions"><a class="btn ${due || upcoming.length ? 'ghost' : 'primary'}" href="${url('quiz/')}">Start quiz ${icon('arrow')}</a></div>
      </section>
    </div>

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

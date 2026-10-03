import { byCode, CONTINENTS, Country, curriculum, inSet, preload, SETS, SOVEREIGN } from '../data';
import { chooseDeck, deck, dueCards, level, newCards, state, streak } from '../store';
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

function picker(images: Promise<void>[]) {
  const { set, continents } = state.settings;
  return `<section class="card picker">
    <h2>What to learn</h2>
    <div class="sets" role="radiogroup" aria-label="Flag set">
      ${SETS.map((s) => {
        const list = inSet(s.id);
        const done = learnedIn(list);
        const cover = byCode.get(s.cover);
        if (cover) images.push(preload(cover.code, 320));
        return `<button class="set-option" role="radio" aria-checked="${s.id === set}" data-set="${s.id}">
          ${cover ? thumb(cover) : ''}
          <span class="set-text">
            <strong>${esc(s.name)}</strong>
            <span class="muted small">${done ? `${done} of ${list.length} learned` : plural(list.length, 'flag')}</span>
          </span>
          ${icon('check', 'icon set-check')}
        </button>`;
      }).join('')}
    </div>
    <div class="continents">
      <span class="label">Sovereign states by continent</span>
      <div class="chips" role="group" aria-label="Sovereign states by continent">${CONTINENTS.map((k) => {
        const on = set === SOVEREIGN && continents.includes(k);
        return `<button class="chip${on ? ' active' : ''}" aria-pressed="${on}" data-continent="${k}">${k}</button>`;
      }).join('')}</div>
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
  for (const b of $$('[data-continent]', root)) {
    b.addEventListener('click', () => {
      const k = b.dataset.continent!;
      const cur = state.settings.set === SOVEREIGN ? state.settings.continents : [];
      const next = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
      if (!next.length) return;
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
    cta = `<a class="btn primary big" href="#/study">Start learning ${icon('arrow')}</a>`;
  } else if (due) {
    title = plural(due, 'flag') + ' to review';
    cta = `<a class="btn primary big" href="#/study">Review ${icon('arrow')}</a>${remaining ? `<a class="btn ghost big" href="#/study/new">Learn new flags</a>` : ''}`;
  } else if (remaining) {
    title = "Today's flags";
    cta = `<a class="btn primary big" href="#/study">Start ${icon('arrow')}</a>`;
    next = upNext(upcoming.slice(0, fresh), images);
  } else {
    title = 'All learned';
    cta = `<a class="btn ghost big" href="#/browse">Browse all flags</a>`;
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
          ? `<a class="today-ring" href="#/progress" aria-label="See your progress">
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

import { ALL, byCode, CONTINENTS, Country, curriculum, inSet, preload, setById, SETS, SOVEREIGN } from '../data';
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

function didYouKnow(images: Promise<void>[]): string {
  const seen = Object.keys(state.cards).map((k) => byCode.get(k)).filter((c): c is Country => !!c && c.trivia.length > 0);
  const pool = seen.length >= 3 ? seen : deck().filter((c) => c.trivia.length);
  if (!pool.length) return '';
  const c = sample(pool);
  images.push(preload(c.code, 320));
  return `
    <a class="card trivia-card" href="${countryLink(c)}">
      ${thumb(c)}
      <div>
        <p class="label">Did you know?</p>
        <p>${esc(sample(c.trivia))}</p>
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

const learnedIn = (list: Country[]) => list.filter((c) => level(c.code) !== 'new').length;

function deckName() {
  const { set, continents } = state.settings;
  const name = setById.get(set)!.name;
  if (set !== SOVEREIGN || continents.length === CONTINENTS.length) return name;
  return continents.length <= 2 ? continents.join(' and ') : `${continents.length} continents`;
}

function picker(images: Promise<void>[]) {
  const { set, continents } = state.settings;
  return `<section class="card picker">
    <div class="section-head"><h2>What to learn</h2></div>
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
    ${
      set === SOVEREIGN
        ? `<div class="continents">
            <span class="label">Continents</span>
            <div class="chips" role="group" aria-label="Continents">${CONTINENTS.map((k) => {
              const on = continents.includes(k);
              return `<button class="chip${on ? ' active' : ''}" aria-pressed="${on}" data-continent="${k}">${k}</button>`;
            }).join('')}</div>
          </div>`
        : `<p class="muted small set-desc">${esc(setById.get(set)!.description)}</p>`
    }
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
      const cur = state.settings.continents;
      const next = cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
      if (!next.length) return;
      chooseDeck(SOVEREIGN, CONTINENTS.filter((x) => next.includes(x)));
      refresh(`[data-continent="${k}"]`);
    });
  }
}

export const homeView = (root: HTMLElement) => paint(root);

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
  let detail: string;
  let cta: string;
  let next = '';
  if (!started && everything) {
    title = 'Learn every flag in the world';
    detail = `Start from zero. A few minutes a day and you'll know all ${all.length} flags, from Afghanistan to Zimbabwe.`;
    cta = `<a class="btn primary big" href="#/study">Start learning ${icon('arrow')}</a>`;
  } else if (!started) {
    title = `Learn the flags: ${deckName()}`;
    detail = `Start from zero. A few minutes a day and you'll know all ${all.length}.`;
    cta = `<a class="btn primary big" href="#/study">Start learning ${icon('arrow')}</a>`;
  } else if (due) {
    title = due === 1 ? '1 flag to review' : `${due} flags to review`;
    detail = 'A quick review now keeps them from slipping away.';
    cta = `<a class="btn primary big" href="#/study">Start review ${icon('arrow')}</a>${remaining ? `<a class="btn ghost big" href="#/study/new">Learn new flags</a>` : ''}`;
  } else if (remaining) {
    title = 'Ready for new flags';
    detail = `You're all caught up on reviews. ${remaining} flags left in ${deckName()}.`;
    cta = `<a class="btn primary big" href="#/study">Learn today's flags ${icon('arrow')}</a>`;
    next = upNext(upcoming.slice(0, fresh), images);
  } else {
    title = everything ? 'You know every flag' : `You know every flag in ${deckName()}`;
    detail = everything ? 'Come back for short reviews so they stay locked in.' : 'Pick another set below to keep going.';
    cta = `<a class="btn ghost big" href="#/browse">Browse all flags</a>`;
  }

  const html = `
    <section class="card today${started ? ' started' : ''}">
      <div class="today-main">
        <h1>${esc(title)}</h1>
        <p class="lead">${esc(detail)}</p>
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
              <div><span class="step">1</span><h3>Meet a few flags</h3><p>Each lesson introduces a handful of flags, with a quick tip to make each one stick.</p></div>
              <div><span class="step">2</span><h3>Practise at the right moment</h3><p>Flags come back just before you'd forget them, so a few minutes a day is enough.</p></div>
              <div><span class="step">3</span><h3>Never mix them up</h3><p>Chad or Romania? Indonesia or Monaco? Lookalikes are practised side by side until you can tell them apart.</p></div>
            </div>
            <p class="muted small">Free, no account needed. Your progress is saved in this browser.</p>
          </section>`
    }`;
  renderWhenReady(root, html, images, keepScroll === undefined ? 350 : 0).then((shown) => {
    if (!shown) return;
    bindPicker(root);
    if (keepScroll !== undefined) scrollTo(0, keepScroll);
    if (focus) root.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true });
  });
}

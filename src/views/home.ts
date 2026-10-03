import { ALL, byCode, Country, preload } from '../data';
import { deck, dueCards, level, newCards, state, streak } from '../store';
import { countryLink, esc, flagImg, plural, renderWhenReady, sample } from '../ui';

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
  const pool = seen.length >= 3 ? seen : ALL.filter((c) => c.trivia.length);
  if (!pool.length) return '';
  const c = sample(pool);
  images.push(preload(c.code, 320));
  return `
    <a class="card trivia-card" href="${countryLink(c)}">
      <div class="trivia-flag">${flagImg(c, { size: 'sm' })}</div>
      <div>
        <p class="eyebrow">Did you know? · ${esc(c.name)}</p>
        <p>${esc(sample(c.trivia))}</p>
      </div>
    </a>`;
}

export function homeView(root: HTMLElement) {
  const all = deck();
  const learned = all.filter((c) => level(c.code) !== 'new').length;
  const due = dueCards().length;
  const remaining = newCards().length;
  const fresh = Math.min(remaining, state.settings.lessonSize);
  const started = Object.keys(state.cards).length > 0;
  const days = streak();

  let title: string;
  let detail: string;
  let cta: string;
  if (!started) {
    title = 'Learn every flag in the world';
    detail = `Start from zero. In a few minutes a day you'll know all ${all.length} flags.`;
    cta = `<a class="btn primary big" href="#/study">Start learning</a>`;
  } else if (due) {
    title = 'Time to practice';
    detail = `${plural(due, 'flag')} to review${remaining ? ` · ${remaining} still to learn` : ''}`;
    cta = `<a class="btn primary big" href="#/study">Continue</a>${remaining ? `<a class="btn ghost big" href="#/study/new">Learn new flags</a>` : ''}`;
  } else if (remaining) {
    title = 'Ready for new flags';
    detail = `${plural(remaining, 'flag')} left to learn.`;
    cta = `<a class="btn primary big" href="#/study">Learn ${plural(fresh, 'new flag')}</a>`;
  } else {
    title = 'You know every flag';
    detail = 'Keep coming back for short reviews so they stay locked in.';
    cta = '';
  }

  const images: Promise<void>[] = started ? [] : HERO.map((k) => preload(k, 320));
  const html = `
    <section class="today card${started ? ' started' : ''}">
      <div class="today-main">
        <h1>${esc(title)}</h1>
        <p class="muted">${esc(detail)}</p>
        <div class="today-cta">${cta}</div>
      </div>
      ${
        started
          ? `<div class="today-ring">
              ${ring(learned / all.length)}
              <div class="ring-label"><strong>${learned}</strong><span>of ${all.length}</span></div>
              ${days > 1 ? `<p class="streak">${days}-day streak</p>` : ''}
            </div>`
          : `<div class="hero-flags" aria-hidden="true">${HERO
              .map((k) => byCode.get(k))
              .filter((c): c is Country => !!c)
              .map((c) => flagImg(c, { size: 'sm', alt: '' }))
              .join('')}</div>`
      }
    </section>

    ${didYouKnow(images)}

    <section class="about">
      <h2>How it works</h2>
      <div class="features">
        <div><h3>Small daily lessons</h3><p>Meet a handful of new flags at a time, each with a quick tip to make it stick.</p></div>
        <div><h3>Reviews at the right moment</h3><p>Flags come back just before you'd forget them, so a few minutes a day is enough.</p></div>
        <div><h3>No more mix-ups</h3><p>Chad or Romania? Indonesia or Monaco? Lookalike flags are practised side by side until you can tell them apart.</p></div>
      </div>
      <p class="muted small">Free, no account needed. Your progress is saved in this browser.</p>
    </section>`;
  renderWhenReady(root, html, images);
}

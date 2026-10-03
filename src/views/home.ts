import { ALL, byCode, Country, preload } from '../data';
import { deck, dueCards, level, newCards, state, streak } from '../store';
import { countryLink, esc, flagImg, icon, plural, renderWhenReady, sample, thumb } from '../ui';

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

export function homeView(root: HTMLElement) {
  const all = deck();
  const learned = all.filter((c) => level(c.code) !== 'new').length;
  const due = dueCards().length;
  const upcoming = newCards();
  const remaining = upcoming.length;
  const fresh = Math.min(remaining, state.settings.lessonSize);
  const started = Object.keys(state.cards).length > 0;
  const days = streak();
  const images: Promise<void>[] = started ? [] : HERO.map((k) => preload(k, 320));

  let title: string;
  let detail: string;
  let cta: string;
  let next = '';
  if (!started) {
    title = 'Learn every flag in the world';
    detail = `Start from zero. A few minutes a day and you'll know all ${all.length} flags, from Afghanistan to Zimbabwe.`;
    cta = `<a class="btn primary big" href="#/study">Start learning ${icon('arrow')}</a>`;
  } else if (due) {
    title = due === 1 ? '1 flag to review' : `${due} flags to review`;
    detail = 'A quick review now keeps them from slipping away.';
    cta = `<a class="btn primary big" href="#/study">Start review ${icon('arrow')}</a>${remaining ? `<a class="btn ghost big" href="#/study/new">Learn new flags</a>` : ''}`;
  } else if (remaining) {
    title = 'Ready for new flags';
    detail = `You're all caught up on reviews. ${remaining} flags left to learn.`;
    cta = `<a class="btn primary big" href="#/study">Learn today's flags ${icon('arrow')}</a>`;
    next = upNext(upcoming.slice(0, fresh), images);
  } else {
    title = 'You know every flag';
    detail = 'Come back for short reviews so they stay locked in.';
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
          : `<div class="hero-flags" aria-hidden="true">${HERO
              .map((k) => byCode.get(k))
              .filter((c): c is Country => !!c)
              .map((c) => flagImg(c, { size: 'sm', alt: '' }))
              .join('')}</div>`
      }
    </section>

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
  renderWhenReady(root, html, images);
}

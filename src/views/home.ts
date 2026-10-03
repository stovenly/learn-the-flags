import { ALL, byCode, Country } from '../data';
import { deck, dueCards, dueLaterToday, level, newCards, newLeftToday, state, streak } from '../store';
import { countryLink, esc, flagImg, plural, sample } from '../ui';

function ring(pct: number) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return `<svg class="ring" viewBox="0 0 120 120" aria-hidden="true">
    <circle cx="60" cy="60" r="${r}" class="ring-track"/>
    <circle cx="60" cy="60" r="${r}" class="ring-fill" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/>
  </svg>`;
}

function didYouKnow(): string {
  const seen = Object.keys(state.cards).map((k) => byCode.get(k)).filter((c): c is Country => !!c && c.trivia.length > 0);
  const pool = seen.length >= 3 ? seen : ALL.filter((c) => c.trivia.length);
  if (!pool.length) return '';
  const c = sample(pool);
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
  const fresh = Math.min(newCards().length, newLeftToday(), state.settings.lessonSize);
  const remaining = newCards().length;
  const started = Object.keys(state.cards).length > 0;
  const days = streak();

  let title: string;
  let detail: string;
  let cta: string;
  if (!started) {
    title = 'Learn every flag in the world';
    detail = `Start from zero. In a few minutes a day you'll know all ${all.length} flags.`;
    cta = `<a class="btn primary big" href="#/study">Start learning</a>`;
  } else if (due || fresh) {
    title = due ? 'Time to practice' : 'Ready for new flags';
    detail = [due ? plural(due, 'flag') + ' to review' : '', fresh ? plural(fresh, 'new flag') : ''].filter(Boolean).join(' · ');
    cta = `<a class="btn primary big" href="#/study">Continue</a>`;
  } else if (remaining) {
    const later = dueLaterToday();
    title = "You're all caught up";
    detail = later ? `A few more flags will be ready later today.` : 'Come back tomorrow to keep your flags fresh.';
    cta = `<a class="btn ghost big" href="#/study/more">Learn ${Math.min(state.settings.lessonSize, remaining)} more anyway</a>`;
  } else {
    title = 'You know every flag';
    detail = 'Keep coming back for short reviews so they stay locked in.';
    cta = '';
  }

  root.innerHTML = `
    <section class="today card">
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
          : `<div class="hero-flags" aria-hidden="true">${['jp', 'br', 'ca', 'za', 'np', 'ch', 'kr', 'bt', 'gb']
              .map((k) => byCode.get(k))
              .filter((c): c is Country => !!c)
              .map((c) => flagImg(c, { size: 'sm', alt: '' }))
              .join('')}</div>`
      }
    </section>

    ${didYouKnow()}

    <section class="about">
      <h2>How it works</h2>
      <div class="features">
        <div><h3>Small daily lessons</h3><p>Meet a handful of new flags at a time, each with a quick tip to make it stick.</p></div>
        <div><h3>Reviews at the right moment</h3><p>Flags come back just before you'd forget them, so a few minutes a day is enough.</p></div>
        <div><h3>No more mix-ups</h3><p>Chad or Romania? Indonesia or Monaco? Lookalike flags are practised side by side until you can tell them apart.</p></div>
      </div>
      <p class="muted small">Free, no account needed. Your progress is saved in this browser.</p>
    </section>`;
}

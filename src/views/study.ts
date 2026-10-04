import { url } from '../data';
import { navigate } from '../router';
import { dueCards, newCards, save, Settings, state } from '../store';
import { $, $$, icon, plural } from '../ui';
import { buildStudy, runSession } from './session';

// Long backlogs are split into several short sittings; new flags join once the backlog fits in one.
const MAX_REVIEWS = 30;

const SIZES = [3, 5, 8, 10];
const STYLES: [Settings['answerStyle'], string][] = [
  ['auto', 'Mix'],
  ['choice', 'Picking'],
  ['typing', 'Typing'],
];

// "study/" and "study/new/" ask for lesson settings first; a trailing "go/" starts straight away.
export function studyView(root: HTMLElement, param: string) {
  const parts = param.split('/');
  const onlyNew = parts[0] === 'new';
  const plan = () => {
    const allDue = dueCards();
    const due = onlyNew ? [] : allDue.slice(0, MAX_REVIEWS);
    const fresh = onlyNew || allDue.length <= MAX_REVIEWS ? newCards().slice(0, state.settings.lessonSize) : [];
    return { due, fresh, canLearn: onlyNew || allDue.length <= MAX_REVIEWS };
  };
  const { due, fresh } = plan();
  if (!due.length && !fresh.length) {
    navigate(url(), true);
    return;
  }
  if (parts.includes('go')) start(root, due, fresh);
  else setup(root, onlyNew, plan);
}

function start(root: HTMLElement, due: ReturnType<typeof dueCards>, fresh: ReturnType<typeof newCards>) {
  document.body.dataset.route = 'study';
  runSession(root, {
    items: buildStudy(due, fresh),
    scheduled: true,
    title: fresh.length && !due.length ? 'Lesson' : 'Session',
    onDone: () => {
      const more = dueCards().length > 0 || newCards().length > 0;
      return `<a class="btn ghost" href="${url()}">Home</a>${more ? `<a class="btn primary" href="${url('study/go/')}">Keep going</a>` : ''}`;
    },
  });
}

function setup(root: HTMLElement, onlyNew: boolean, plan: () => { due: unknown[]; fresh: unknown[]; canLearn: boolean }) {
  document.body.dataset.route = 'setup';
  const radios = <T,>(key: keyof Settings, label: string, options: [T, string][]) =>
    `<div class="setup-row">
      <span class="setup-label">${label}</span>
      <div class="chips" role="radiogroup" aria-label="${label}">${options
        .map(([v, text]) => `<button class="chip${state.settings[key] === v ? ' active' : ''}" role="radio" aria-checked="${state.settings[key] === v}" data-key="${key}" data-value="${v}">${text}</button>`)
        .join('')}</div>
    </div>`;
  const summary = () => {
    const { due, fresh } = plan();
    return [due.length ? plural(due.length, 'review') : '', fresh.length ? `${plural(fresh.length, 'new flag')}` : ''].filter(Boolean).join(' · ');
  };
  const { canLearn, due } = plan();
  root.innerHTML = `
    <article class="card stage quiz-kind fade-in">
      <span class="pill">${onlyNew || !due.length ? 'Lesson' : 'Session'}</span>
      <h1>Today's flags</h1>
      <p class="muted setup-summary">${summary()}</p>
      <div class="setup">
        ${canLearn ? radios('lessonSize', 'New flags', SIZES.map((n) => [n, String(n)])) : ''}
        ${radios('answerStyle', 'Answer by', STYLES)}
      </div>
      <div class="setup-actions">
        <a class="back" href="${url()}">← Back</a>
        <a class="btn primary" href="${url(onlyNew ? 'study/new/go/' : 'study/go/')}">Start ${icon('arrow')}</a>
      </div>
    </article>`;
  for (const b of $$('[data-key]', root)) {
    b.addEventListener('click', () => {
      const key = b.dataset.key as 'lessonSize' | 'answerStyle';
      const v = key === 'lessonSize' ? Number(b.dataset.value) : (b.dataset.value as Settings['answerStyle']);
      (state.settings as unknown as Record<string, unknown>)[key] = v;
      save();
      for (const o of $$(`[data-key="${key}"]`, root)) {
        const on = o === b;
        o.classList.toggle('active', on);
        o.setAttribute('aria-checked', String(on));
      }
      $('.setup-summary', root).textContent = summary();
    });
  }
  $('.btn.primary', root).focus({ preventScroll: true });
}

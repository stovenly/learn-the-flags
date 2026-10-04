import { deckKey, LESSON_SIZES, save, Settings, state } from '../store';
import { esc, icon } from '../ui';
import { KINDS, kindNoun } from './quiz';

const STYLES: [Settings['answerStyle'], string][] = [
  ['auto', 'Mix'],
  ['choice', 'Picking'],
  ['typing', 'Typing'],
];

type Key = 'lessonSize' | 'answerStyle' | 'quizKind';

const chips = (key: Key, label: string, options: [string | number, string][]) =>
  `<div class="option-row">
    <span class="option-label">${label}</span>
    <div class="chips" role="radiogroup" aria-label="${label}">${options
      .map(([v, text]) => `<button type="button" class="chip" role="radio" data-key="${key}" data-value="${v}">${text}</button>`)
      .join('')}</div>
  </div>`;

function quizKinds() {
  const name = kindNoun();
  return `<div class="kinds" role="radiogroup" aria-label="Question type">${KINDS.map((k) => {
    const best = state.quizzes[`${deckKey()}:${k.slug}`];
    return `<button type="button" class="kind" role="radio" data-key="quizKind" data-value="${k.slug}">
      <strong>${esc(k.title(name))}</strong>
      <span class="muted">${k.detail}</span>
      ${best ? `<span class="kind-best">Best ${Math.round((best.correct / best.total) * 100)}%</span>` : ''}
    </button>`;
  }).join('')}</div>`;
}

// A modal for the Learn or Quiz card's options; choices save as they're made, and onClose runs once it shuts.
export function openOptions(which: 'lesson' | 'quiz', onClose: () => void) {
  const dialog = document.createElement('dialog');
  dialog.className = 'options-modal';
  dialog.setAttribute('aria-labelledby', 'options-title');
  dialog.innerHTML = `
    <div class="options-head">
      <h2 id="options-title">${which === 'lesson' ? 'Lesson options' : 'Quiz options'}</h2>
      <button type="button" class="icon-btn" data-close aria-label="Close">${icon('cross')}</button>
    </div>
    ${
      which === 'lesson'
        ? chips('lessonSize', 'New flags', LESSON_SIZES.map((n) => [n, String(n)])) +
          chips('answerStyle', 'Answer by', STYLES)
        : quizKinds()
    }`;
  const sync = () => {
    for (const b of dialog.querySelectorAll<HTMLElement>('[data-key]')) {
      const on = String(state.settings[b.dataset.key as Key]) === b.dataset.value;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', String(on));
    }
  };
  dialog.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === dialog || t.closest('[data-close]')) return dialog.close();
    const b = t.closest<HTMLElement>('[data-key]');
    if (!b) return;
    const key = b.dataset.key as Key;
    (state.settings as unknown as Record<string, unknown>)[key] = key === 'lessonSize' ? Number(b.dataset.value) : b.dataset.value;
    save();
    sync();
  });
  dialog.addEventListener('close', () => {
    dialog.remove();
    onClose();
  });
  sync();
  document.body.append(dialog);
  dialog.showModal();
  dialog.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
}

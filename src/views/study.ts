import { dueCards, newCards, state } from '../store';
import { buildStudy, runSession } from './session';

// Long backlogs are split into several short sittings; new flags join once the backlog fits in one.
const MAX_REVIEWS = 30;

export function studyView(root: HTMLElement, param: string) {
  const onlyNew = param === 'new';
  const allDue = dueCards();
  const due = onlyNew ? [] : allDue.slice(0, MAX_REVIEWS);
  const fresh = onlyNew || allDue.length <= MAX_REVIEWS ? newCards().slice(0, state.settings.lessonSize) : [];

  if (!due.length && !fresh.length) {
    location.replace('#/');
    return;
  }

  runSession(root, {
    items: buildStudy(due, fresh),
    scheduled: true,
    title: fresh.length && !due.length ? 'Lesson' : 'Session',
    onDone: () => {
      const more = dueCards().length > 0 || newCards().length > 0;
      return `<a class="btn ghost" href="#/">Home</a>${more ? `<a class="btn primary" href="#/study">Keep going</a>` : ''}`;
    },
  });
}

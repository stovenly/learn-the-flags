import { url } from '../data';
import { navigate } from '../router';
import { dueCards, newCards, state } from '../store';
import { buildStudy, runSession } from './session';

// Long backlogs are split into several short sittings; new flags join once the backlog fits in one.
const MAX_REVIEWS = 30;

export function studyView(root: HTMLElement) {
  const allDue = dueCards();
  const due = allDue.slice(0, MAX_REVIEWS);
  const fresh = allDue.length <= MAX_REVIEWS ? newCards().slice(0, state.settings.lessonSize) : [];

  if (!due.length && !fresh.length) {
    navigate(url(), true);
    return;
  }

  runSession(root, {
    items: buildStudy(due, fresh),
    scheduled: true,
    title: fresh.length && !due.length ? 'Lesson' : 'Session',
    onDone: () => {
      const more = dueCards().length > 0 || newCards().length > 0;
      return `<a class="btn ghost" href="${url()}">Home</a>${more ? `<a class="btn primary" href="${url('study/')}">Keep going</a>` : ''}`;
    },
  });
}

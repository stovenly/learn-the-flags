import { Country, url } from '../data';
import { navigate } from '../router';
import { dueCards, newCards, state } from '../store';
import { buildStudy, runSession } from './session';

// Long backlogs are split into several short sittings; new flags join once the backlog fits in one.
export const MAX_REVIEWS = 30;

let last: { due: Country[]; fresh: Country[] } | null = null;

// "study/again/" replays the last lesson's flags as practice, with fresh answer choices and order.
export function studyView(root: HTMLElement, param: string) {
  const again = param === 'again';
  if (again && !last) return navigate(url('study/'), true);
  const allDue = dueCards();
  const { due, fresh } = again
    ? last!
    : { due: allDue.slice(0, MAX_REVIEWS), fresh: allDue.length <= MAX_REVIEWS ? newCards().slice(0, state.settings.lessonSize) : [] };

  if (!due.length && !fresh.length) {
    navigate(url(), true);
    return;
  }
  last = { due, fresh };

  runSession(root, {
    items: buildStudy(due, fresh),
    scheduled: !again,
    title: fresh.length && !due.length ? 'Lesson' : 'Session',
    onDone: () => {
      const more = dueCards().length > 0 || newCards().length > 0;
      return `<a class="btn ghost" href="${url()}">Home</a><a class="btn ghost" href="${url('study/again/')}">Restart lesson</a>${more ? `<a class="btn primary" href="${url('study/')}">Keep going</a>` : ''}`;
    },
  });
}

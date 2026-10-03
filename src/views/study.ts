import { dueCards, newCards, newLeftToday, state } from '../store';
import { buildStudy, runSession } from './session';

// Long backlogs are split into several short sittings; new flags wait until the backlog is small.
const MAX_REVIEWS = 30;
const BACKLOG_BLOCKS_NEW = 40;

export function studyView(root: HTMLElement, param: string) {
  const extra = param === 'more';
  const allDue = dueCards();
  const due = allDue.slice(0, MAX_REVIEWS);
  const room = extra ? state.settings.lessonSize : allDue.length > BACKLOG_BLOCKS_NEW ? 0 : Math.min(newLeftToday(), state.settings.lessonSize);
  const fresh = newCards().slice(0, room);

  if (!due.length && !fresh.length) {
    location.replace('#/');
    return;
  }

  runSession(root, {
    items: buildStudy(due, fresh),
    scheduled: true,
    title: fresh.length && !due.length ? 'Lesson' : 'Session',
    onDone: () => {
      const more = dueCards().length > 0 || (newLeftToday() > 0 && newCards().length > 0);
      return `<a class="btn ghost" href="#/">Home</a>${more ? `<a class="btn primary" href="#/study">Keep going</a>` : ''}`;
    },
  });
}

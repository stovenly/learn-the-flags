import { url } from '../data';
import { deck, deckKey, state } from '../store';
import { shuffle } from '../ui';
import { Mode, quiz, runSession } from './session';

// Every chosen flag once, in random order, scored at the end; answers don't touch the review schedule.
export function quizView(root: HTMLElement) {
  const style = state.settings.answerStyle;
  const mode = (): Mode => (style === 'typing' ? 'type-name' : Math.random() < 0.5 ? 'pick-name' : 'pick-flag');
  runSession(root, {
    items: shuffle(deck()).map((c) => quiz(c, mode())),
    scheduled: false,
    test: { key: deckKey() },
    title: 'Quiz',
    onDone: () => `<a class="btn ghost" href="${url()}">Home</a><a class="btn primary" href="${url('quiz/')}">Try again</a>`,
  });
}

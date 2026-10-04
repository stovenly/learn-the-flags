import './styles.css';
import { route, startRouter } from './router';
import { applyTheme } from './theme';
import { mountCorners } from './corners';
import { homeView } from './views/home';
import { studyView } from './views/study';
import { browseView } from './views/browse';
import { countryView } from './views/country';
import { progressView } from './views/progress';
import { quizView } from './views/quiz';

const TITLE = 'Learn the Flags';
const titled = (title: string | null, view: (root: HTMLElement, param: string) => void) => (root: HTMLElement, param: string) => {
  document.title = title ? `${title} · Learn the Flags` : TITLE;
  view(root, param);
};

applyTheme();
mountCorners();
route('', titled(null, homeView));
route('study', titled('Study', studyView));
const allFlags = titled('All flags', browseView);
const flag = titled(null, countryView);
route('flags', (root, slug) => (slug ? flag(root, slug) : allFlags(root, slug)));
route('quiz', titled('Quiz', quizView));
route('progress', titled('Progress', progressView));

startRouter();

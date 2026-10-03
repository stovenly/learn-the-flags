import './styles.css';
import { render, route, startRouter } from './router';
import { applyTheme } from './theme';
import { homeView } from './views/home';
import { studyView } from './views/study';
import { browseView } from './views/browse';
import { countryView } from './views/country';
import { progressView } from './views/progress';
import { settingsView } from './views/settings';

const TITLE = document.title;
const titled = (title: string | null, view: (root: HTMLElement, param: string) => void) => (root: HTMLElement, param: string) => {
  document.title = title ? `${title} · Learn the Flags` : TITLE;
  view(root, param);
};

applyTheme();
route('', titled(null, homeView));
route('study', titled('Study', studyView));
route('browse', titled('All flags', browseView));
route('flag', titled(null, countryView));
route('progress', titled('Progress', progressView));
route('settings', titled('Settings', settingsView));

// A link to the page already open would not fire hashchange, so re-render instead.
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest('a');
  if (a && a.getAttribute('href') === location.hash && a.target !== '_blank') {
    e.preventDefault();
    render();
  }
});

startRouter();

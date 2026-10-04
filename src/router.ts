import { BASE } from './data';

type View = (root: HTMLElement, param: string) => void;

const routes = new Map<string, View>();
let cleanups: (() => void)[] = [];

export function route(name: string, view: View) {
  routes.set(name, view);
}

export function onCleanup(fn: () => void) {
  cleanups.push(fn);
}

export function navigate(path: string, replace = false) {
  if (path !== location.pathname) history[replace ? 'replaceState' : 'pushState'](null, '', path);
  render();
}

// "/learn-the-flags/flags/texas/" → ["flags", "texas"]
const segments = (path: string) => (path.startsWith(BASE) ? path.slice(BASE.length) : '').split('/').filter(Boolean).map(decodeURIComponent);

export function render() {
  cleanups.forEach((fn) => fn());
  cleanups = [];
  const [name = '', ...rest] = segments(location.pathname);
  const view = routes.get(name) ?? routes.get('')!;
  const root = document.getElementById('app')!;
  document.body.dataset.route = routes.has(name) ? name || 'home' : 'home';
  for (const a of document.querySelectorAll<HTMLAnchorElement>('.nav a')) {
    a.classList.toggle('active', segments(new URL(a.href).pathname)[0] === (name || undefined));
  }
  view(root, rest.join('/'));
  window.scrollTo(0, 0);
}

// Old "#/flag/texas" links from before clean URLs.
const LEGACY: Record<string, string> = { browse: 'flags', flag: 'flags' };
function fromHash() {
  if (!location.hash.startsWith('#/')) return;
  const [name = '', ...rest] = location.hash.slice(2).split('/').filter(Boolean);
  const parts = [LEGACY[name] ?? name, ...rest].filter(Boolean);
  history.replaceState(null, '', BASE + parts.map((p) => `${p}/`).join(''));
}

export function startRouter() {
  fromHash();
  window.addEventListener('popstate', render);
  // In-app links change the view without a page load; new tabs, modified clicks and files are left to the browser.
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a || a.target || a.hasAttribute('download') || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const to = new URL(a.href);
    if (to.origin !== location.origin || !to.pathname.startsWith(BASE) || /\.\w+$/.test(to.pathname)) return;
    e.preventDefault();
    navigate(to.pathname);
  });
  render();
}

type View = (root: HTMLElement, param: string) => void;

const routes = new Map<string, View>();
let cleanups: (() => void)[] = [];

export function route(name: string, view: View) {
  routes.set(name, view);
}

export function onCleanup(fn: () => void) {
  cleanups.push(fn);
}

export function navigate(hash: string) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

export function render() {
  cleanups.forEach((fn) => fn());
  cleanups = [];
  const [name = '', param = ''] = location.hash.replace(/^#\/?/, '').split('/');
  const view = routes.get(name) ?? routes.get('')!;
  const root = document.getElementById('app')!;
  document.body.dataset.route = routes.has(name) ? name || 'home' : 'home';
  for (const a of document.querySelectorAll<HTMLAnchorElement>('.nav a')) {
    a.classList.toggle('active', a.getAttribute('href') === `#/${name}`);
  }
  view(root, decodeURIComponent(param));
  window.scrollTo(0, 0);
}

export function startRouter() {
  window.addEventListener('hashchange', render);
  render();
}

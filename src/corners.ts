import { save, state } from './store';
import { applyTheme } from './theme';
import { icon } from './ui';

const REPO = 'https://github.com/stovenly/learn-the-flags';

const out = (href: string, text: string) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;

function corner(side: 'left' | 'right', label: string, face: string, body: string, onOpen = () => {}) {
  const box = document.createElement('div');
  box.className = `corner corner-${side}`;
  box.innerHTML = `<div class="corner-pop" hidden>${body}</div><button type="button" class="corner-btn" aria-label="${label}" aria-expanded="false">${face}</button>`;
  const pop = box.querySelector<HTMLElement>('.corner-pop')!;
  const btn = box.querySelector<HTMLButtonElement>('.corner-btn')!;
  let open = false;
  const show = (on: boolean) => {
    open = on;
    pop.hidden = !on;
    btn.setAttribute('aria-expanded', String(on));
  };
  btn.addEventListener('click', () => {
    if (!open) onOpen();
    show(!open);
  });
  addEventListener('pointerdown', (e) => !box.contains(e.target as Node) && show(false));
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) {
      show(false);
      btn.focus();
    }
  });
  document.body.append(box);
  return box;
}

export function mountCorners() {
  const THEMES = [
    ['auto', 'System'],
    ['light', 'Light'],
    ['dark', 'Dark'],
  ] as const;
  const gear = corner(
    'left',
    'Display settings',
    icon('gear'),
    `<div class="gear-row"><span>Theme</span><div class="segmented" role="radiogroup" aria-label="Theme">${THEMES.map(
      ([v, label]) => `<button type="button" role="radio" data-theme-value="${v}">${label}</button>`,
    ).join('')}</div></div>
    <button type="button" class="switch" role="switch"><span>Dyslexia-friendly font</span><span class="switch-track"></span></button>`,
    () => sync(),
  );
  const toggle = gear.querySelector<HTMLButtonElement>('.switch')!;
  const themes = [...gear.querySelectorAll<HTMLButtonElement>('[data-theme-value]')];
  const sync = () => {
    toggle.setAttribute('aria-checked', String(state.settings.dyslexic));
    for (const b of themes) b.setAttribute('aria-checked', String(b.dataset.themeValue === state.settings.theme));
  };
  toggle.addEventListener('click', () => {
    state.settings.dyslexic = !state.settings.dyslexic;
    save();
    applyTheme();
    sync();
  });
  for (const b of themes) {
    b.addEventListener('click', () => {
      state.settings.theme = b.dataset.themeValue as typeof state.settings.theme;
      save();
      applyTheme();
      sync();
    });
  }
  sync();

  corner(
    'right',
    'About',
    '<span aria-hidden="true">?</span>',
    `<p class="made-by">Made by ${out('https://stovenly.com/projects/learn-the-flags/', 'stovenly')}<img src="heart.png" alt="" width="30" height="30"></p>
    <p>${out(`${REPO}/blob/main/CREDITS.md`, 'Credits')}</p>
    <p>${out(REPO, 'Source code')}</p>
    <p>${out(`${REPO}/issues/new`, 'Report an issue')}</p>`,
  );
}

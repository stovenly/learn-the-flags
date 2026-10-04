import { save, state } from './store';
import { applyTheme } from './theme';

const REPO = 'https://github.com/stovenly/learn-the-flags';
const GEAR =
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

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
  const sync = () => toggle.setAttribute('aria-checked', String(state.settings.dyslexic));
  const gear = corner(
    'left',
    'Accessibility',
    GEAR,
    '<button type="button" class="switch" role="switch"><span>Dyslexia-friendly font</span><span class="switch-track"></span></button>',
    () => sync(),
  );
  const toggle = gear.querySelector<HTMLButtonElement>('.switch')!;
  toggle.addEventListener('click', () => {
    state.settings.dyslexic = !state.settings.dyslexic;
    save();
    applyTheme();
    sync();
  });
  sync();

  corner(
    'right',
    'About',
    '<span aria-hidden="true">?</span>',
    `<p class="made-by">Made by ${out('https://stovenly.com/games/learn-the-flags/', 'stovenly')}<img src="heart.png" alt="" width="30" height="30"></p>
    <p>${out(`${REPO}/blob/main/CREDITS.md`, 'Credits')}</p>
    <p>${out(REPO, 'Source code')}</p>
    <p>${out(`${REPO}/issues/new`, 'Report an issue')}</p>`,
  );
}

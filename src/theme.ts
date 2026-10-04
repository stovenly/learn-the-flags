import { state } from './store';

// Fetched only once someone turns it on; styles.css swaps the type stack behind html.dyslexic.
const FONT = new URL('fonts/OpenDyslexic-Regular.otf', document.baseURI).href;
let font: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';

export function applyTheme() {
  const t = state.settings.theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = t;
  applyFont();
}

function applyFont() {
  const want = state.settings.dyslexic;
  document.documentElement.classList.toggle('dyslexic', want && font === 'ready');
  if (!want || font !== 'idle') return;
  font = 'loading';
  new FontFace('OpenDyslexic', `url(${FONT})`)
    .load()
    .then((face) => {
      document.fonts.add(face);
      font = 'ready';
      applyFont();
    })
    .catch(() => {
      font = 'failed';
    });
}

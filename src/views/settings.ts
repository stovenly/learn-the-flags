import { REGIONS } from '../data';
import { exportProgress, importProgress, resetProgress, save, Settings, state } from '../store';
import { $, esc } from '../ui';
import { applyTheme } from '../theme';

function select<K extends keyof Settings>(key: K, label: string, options: [Settings[K], string][], hint = '') {
  return `<label class="field">
    <span class="field-label">${label}${hint ? `<small class="muted">${hint}</small>` : ''}</span>
    <select data-key="${key}">${options
      .map(([v, text]) => `<option value="${esc(v)}"${state.settings[key] === v ? ' selected' : ''}>${esc(text)}</option>`)
      .join('')}</select>
  </label>`;
}

export function settingsView(root: HTMLElement) {
  root.innerHTML = `
    <header class="page-head"><h1>Settings</h1></header>
    <section class="card form">
      ${select('newPerDay', 'New flags per day', [[5, '5'], [10, '10'], [15, '15'], [20, '20'], [30, '30']])}
      ${select('focusRegion', 'Learn new flags from', [['all', 'Everywhere'], ...REGIONS.map((r) => [r, r] as [string, string])])}
      ${select('answerStyle', 'Answer by', [['auto', 'Mix of picking and typing'], ['choice', 'Picking only'], ['typing', 'Typing only']])}
      ${select('includePartial', 'Include Kosovo and Taiwan', [[false, 'No'], [true, 'Yes']], 'Partially recognized states')}
      ${select('theme', 'Appearance', [['auto', 'Match system'], ['light', 'Light'], ['dark', 'Dark']])}
    </section>

    <section class="card">
      <h2>Your progress</h2>
      <p class="muted">Progress is stored in this browser only. Save a backup to move it to another device.</p>
      <div class="actions left">
        <button class="btn ghost" data-act="export">Save backup</button>
        <label class="btn ghost">Restore backup<input type="file" accept="application/json,.json" hidden data-act="import"></label>
        <button class="btn ghost danger" data-act="reset">Start over</button>
      </div>
      <p class="notice muted" aria-live="polite"></p>
    </section>`;

  const notice = $('.notice', root);
  for (const el of root.querySelectorAll<HTMLSelectElement>('select[data-key]')) {
    el.addEventListener('change', () => {
      const key = el.dataset.key as keyof Settings;
      const cur = state.settings[key];
      const v = typeof cur === 'number' ? Number(el.value) : typeof cur === 'boolean' ? el.value === 'true' : el.value;
      (state.settings as unknown as Record<string, unknown>)[key] = v;
      save();
      if (key === 'theme') applyTheme();
    });
  }

  $('[data-act=export]', root).addEventListener('click', () => {
    const blob = new Blob([exportProgress()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `learn-the-flags-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $('[data-act=import]', root).addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      importProgress(await file.text());
      applyTheme();
      notice.textContent = 'Backup restored.';
    } catch (err) {
      notice.textContent = (err as Error).message;
    }
  });

  $('[data-act=reset]', root).addEventListener('click', () => {
    if (confirm('Erase all progress and start from scratch?')) {
      resetProgress();
      notice.textContent = 'Progress erased.';
    }
  });
}

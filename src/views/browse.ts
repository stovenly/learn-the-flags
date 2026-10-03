import { ALL, normalize, REGIONS } from '../data';
import { level, state } from '../store';
import { $, $$, countryLink, esc, flagImg } from '../ui';

let lastQuery = '';
let lastRegion = 'all';

export function browseView(root: HTMLElement) {
  const list = ALL.filter((c) => state.settings.includePartial || c.status !== 'partially-recognized');
  root.innerHTML = `
    <header class="page-head">
      <h1>All flags</h1>
      <p class="muted">${list.length} sovereign states. Tap a flag to read about it.</p>
    </header>
    <div class="filters">
      <input class="search" type="search" placeholder="Search countries" aria-label="Search countries" value="${esc(lastQuery)}">
      <div class="chips" role="group" aria-label="Region">
        ${['all', ...REGIONS].map((r) => `<button class="chip${r === lastRegion ? ' active' : ''}" data-region="${r}">${r === 'all' ? 'All' : r}</button>`).join('')}
      </div>
    </div>
    <div class="grid">
      ${list
        .map(
          (c) => `<a class="tile" href="${countryLink(c)}" data-region="${c.region}" data-search="${esc(normalize(`${c.name} ${c.aliases.join(' ')} ${c.capital}`))}">
            <div class="tile-flag">${flagImg(c, { size: 'sm', lazy: true })}</div>
            <span class="tile-name">${esc(c.name)}</span>
            ${level(c.code) === 'new' ? '' : `<span class="dot dot-${level(c.code)}" title="${level(c.code) === 'learning' ? 'Learning' : 'Learned'}"></span>`}
          </a>`,
        )
        .join('')}
    </div>
    <p class="empty muted" hidden>No countries match.</p>`;

  const search = $('.search', root) as HTMLInputElement;
  const tiles = $$('.tile', root);
  const apply = () => {
    const q = normalize(lastQuery);
    let shown = 0;
    for (const t of tiles) {
      const ok = (lastRegion === 'all' || t.dataset.region === lastRegion) && (!q || t.dataset.search!.includes(q));
      t.hidden = !ok;
      if (ok) shown++;
    }
    $('.empty', root).hidden = shown > 0;
  };
  search.addEventListener('input', () => {
    lastQuery = search.value;
    apply();
  });
  for (const chip of $$('.chip', root)) {
    chip.addEventListener('click', () => {
      lastRegion = chip.dataset.region!;
      $$('.chip', root).forEach((c) => c.classList.toggle('active', c === chip));
      apply();
    });
  }
  apply();
}

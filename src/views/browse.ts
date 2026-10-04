import { ALL, CONTINENTS, inSet, normalize, SETS, SOVEREIGN } from '../data';
import { level } from '../store';
import { $, $$, countryLink, esc, flagImg } from '../ui';

let lastQuery = '';
let lastSet = 'all';
let lastContinent = 'all';

export function browseView(root: HTMLElement) {
  const chip = (attr: string, value: string, label: string, on: boolean) =>
    `<button class="chip${on ? ' active' : ''}" data-${attr}="${esc(value)}">${esc(label)}</button>`;
  root.innerHTML = `
    <header class="page-head">
      <h1>All flags</h1>
      <p class="muted">${ALL.length} flags in ${SETS.length} sets. Pick one to see what it means and how to tell it from lookalikes.</p>
    </header>
    <div class="filters">
      <input class="search" type="search" placeholder="Search flags" aria-label="Search flags" value="${esc(lastQuery)}">
      <div class="chips" role="group" aria-label="Set">
        ${chip('set', 'all', 'All', lastSet === 'all')}${SETS.map((s) => chip('set', s.id, s.name, s.id === lastSet)).join('')}
      </div>
      <div class="chips continent-chips" role="group" aria-label="Continent">
        ${chip('continent', 'all', 'All continents', lastContinent === 'all')}${CONTINENTS.map((k) => chip('continent', k, k, k === lastContinent)).join('')}
      </div>
    </div>
    ${SETS.map(
      (s) => `<section class="browse-set" data-set="${s.id}">
        <h2>${esc(s.name)}</h2>
        <div class="grid">
          ${inSet(s.id)
            .map(
              (c) => `<a class="tile" href="${countryLink(c)}" data-continent="${c.continent ?? ''}" data-search="${esc(normalize(`${c.name} ${c.aliases.join(' ')} ${c.endonyms.map((l) => `${l.name} ${l.romanized}`).join(' ')}`))}">
                <div class="tile-flag">${flagImg(c, { size: 'sm', lazy: true, alt: '' })}</div>
                <span class="tile-name">${esc(c.name)}${level(c.code) === 'new' ? '' : `<span class="dot dot-${level(c.code)}" aria-label="${level(c.code) === 'learning' ? 'Learning' : 'Learned'}"></span>`}</span>
              </a>`,
            )
            .join('')}
        </div>
      </section>`,
    ).join('')}
    <p class="empty muted" hidden>No flags match.</p>`;

  const search = $('.search', root) as HTMLInputElement;
  const sections = $$('.browse-set', root);
  const apply = () => {
    const q = normalize(lastQuery);
    const continents = lastSet === SOVEREIGN;
    $('.continent-chips', root).hidden = !continents;
    let shown = 0;
    for (const sec of sections) {
      let here = 0;
      const setOk = lastSet === 'all' || sec.dataset.set === lastSet;
      for (const t of $$('.tile', sec)) {
        const ok = setOk && (!continents || lastContinent === 'all' || t.dataset.continent === lastContinent) && (!q || t.dataset.search!.includes(q));
        t.hidden = !ok;
        if (ok) here++;
      }
      sec.hidden = !here;
      $('h2', sec).hidden = lastSet !== 'all';
      shown += here;
    }
    $('.empty', root).hidden = shown > 0;
  };
  search.addEventListener('input', () => {
    lastQuery = search.value;
    apply();
  });
  for (const attr of ['set', 'continent'] as const) {
    const chips = $$(`.chip[data-${attr}]`, root);
    for (const c of chips) {
      c.addEventListener('click', () => {
        if (attr === 'set') lastSet = c.dataset.set!;
        else lastContinent = c.dataset.continent!;
        chips.forEach((x) => x.classList.toggle('active', x === c));
        apply();
      });
    }
  }
  apply();
}

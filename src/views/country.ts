import { ALL, currencyText, fmtNumber, fmtPopulation, localNameText, preload, preloadMap, STATUS_LABEL } from '../data';
import { level } from '../store';
import { esc, flagImg, hookHtml, lookalikeList, mapImg, pairList, renderWhenReady } from '../ui';

const SWATCH: Record<string, string> = {
  red: '#d62828', orange: '#f77f00', yellow: '#fcbf49', green: '#2a9d4b', blue: '#1d4e9e', 'light-blue': '#5fa8e0',
  white: '#ffffff', black: '#111111', maroon: '#7a1f2b', brown: '#7b4a2a', purple: '#6a3d9a',
};

export function countryView(root: HTMLElement, slug: string) {
  const c = ALL.find((x) => x.slug === slug || x.code === slug);
  if (!c) {
    root.innerHTML = `<div class="card"><h1>Not found</h1><p><a href="#/browse">See all flags</a></p></div>`;
    return;
  }
  document.title = `Flag of ${c.name} · Learn the Flags`;
  const lv = level(c.code);
  const tags = [
    c.subregion || c.region,
    c.status !== 'un-member' ? STATUS_LABEL[c.status] : '',
  ].filter(Boolean);
  const facts: [string, string][] = [
    ['Population', fmtPopulation(c.population)],
    ['Area', c.area ? `${fmtNumber(Math.round(c.area))} km²` : '—'],
    ['Languages', c.languages.join(', ')],
    ['Currency', currencyText(c)],
    ['Demonym', c.demonym],
  ];
  const looks = lookalikeList(c);
  const html = `
    <a class="back" href="#/browse">← All flags</a>
    <article class="country">
      <header class="card country-hero">
        <div class="country-flag">${flagImg(c, { size: 'lg' })}</div>
        <div class="country-id">
          <h1>${esc(c.name)}</h1>
          ${localNameText(c) ? `<p class="local-name">${esc(localNameText(c))}</p>` : ''}
          ${c.officialName !== c.name ? `<p class="muted">${esc(c.officialName)}</p>` : ''}
          <div class="tags">
            ${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}
            ${lv === 'new' ? '' : `<span class="tag tag-${lv === 'learning' ? 'learning' : 'learned'}">${lv === 'learning' ? 'Learning' : 'Learned'}</span>`}
          </div>
        </div>
      </header>

      <div class="country-body">
        <div class="country-main">
          <section class="card">
            <h2>About the flag</h2>
            ${c.flag.description ? `<p>${esc(c.flag.description)}</p>` : ''}
            ${c.flag.symbolism ? `<p class="muted">${esc(c.flag.symbolism)}</p>` : ''}
            <div class="flag-meta">
              ${c.flag.adopted ? `<span><span class="muted">Adopted</span> ${esc(c.flag.adopted)}</span>` : ''}
              ${
                c.flag.colors.length
                  ? `<span class="swatches" aria-label="Colours: ${esc(c.flag.colors.join(', ').replace(/-/g, ' '))}">${c.flag.colors.map((col) => `<i style="background:${SWATCH[col]}" title="${col.replace('-', ' ')}"></i>`).join('')}</span>`
                  : ''
              }
            </div>
            ${hookHtml(c)}
          </section>

          ${looks.length ? `<section class="card"><h2>Easy to confuse with</h2>${pairList(c, looks, true)}</section>` : ''}

          ${
            c.trivia.length
              ? `<section class="card"><h2>Did you know?</h2><ul class="trivia">${c.trivia.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>`
              : ''
          }
        </div>

        <aside class="country-side">
          <section class="card map-card">${mapImg(c, 'lg')}</section>
          <section class="card">
            <h2>Quick facts</h2>
            <dl class="facts">${facts.filter(([, v]) => v).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
          </section>
        </aside>
      </div>
    </article>`;
  renderWhenReady(root, html, [preload(c.code), preloadMap(c.code)]);
}

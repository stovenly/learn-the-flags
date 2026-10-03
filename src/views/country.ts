import { ALL, fmtNumber, fmtPopulation, preload, STATUS_LABEL } from '../data';
import { level } from '../store';
import { countryLink, esc, flagImg, lookalikeList, renderWhenReady } from '../ui';

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
  const badge = lv === 'new' ? '' : `<span class="badge badge-${lv}">${lv === 'learning' ? 'Learning' : 'Learned'}</span>`;
  const facts: [string, string][] = [
    ['Capital', c.capital],
    ['Region', c.subregion || c.region],
    ['Population', fmtPopulation(c.population)],
    ['Area', c.area ? `${fmtNumber(Math.round(c.area))} km²` : '—'],
    ['Languages', c.languages.join(', ')],
    ['Currency', c.currencies.join(', ')],
  ];
  const looks = lookalikeList(c);
  const html = `
    <a class="back" href="#/browse">← All flags</a>
    <article class="country">
      <div class="country-flag card">${flagImg(c, { size: 'lg' })}</div>
      <header class="country-head">
        <h1>${esc(c.name)} ${badge}</h1>
        <p class="muted">${esc(c.officialName)}${c.status !== 'un-member' ? ` · ${STATUS_LABEL[c.status]}` : ''}</p>
      </header>

      <section class="card">
        <h2>The flag</h2>
        ${c.flag.description ? `<p>${esc(c.flag.description)}</p>` : ''}
        ${c.flag.symbolism ? `<p class="muted">${esc(c.flag.symbolism)}</p>` : ''}
        <div class="flag-meta">
          ${c.flag.adopted ? `<span><span class="muted">Adopted</span> ${esc(c.flag.adopted)}</span>` : ''}
          ${
            c.flag.colors.length
              ? `<span class="swatches">${c.flag.colors.map((col) => `<i style="background:${SWATCH[col]}" title="${col.replace('-', ' ')}"></i>`).join('')}</span>`
              : ''
          }
        </div>
        ${c.hook ? `<div class="hook"><span class="hook-label">Memory hook</span><p>${esc(c.hook)}</p></div>` : ''}
      </section>

      ${
        c.trivia.length
          ? `<section class="card"><h2>Did you know?</h2><ul class="trivia">${c.trivia.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>`
          : ''
      }

      <section class="card">
        <h2>Quick facts</h2>
        <dl class="facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v || '—')}</dd></div>`).join('')}</dl>
      </section>

      ${
        looks.length
          ? `<section class="card"><h2>Easy to confuse with</h2><div class="mini-grid">${looks
              .map((o) => `<a class="mini" href="${countryLink(o)}"><span class="mini-flag">${flagImg(o, { size: 'sm' })}</span><span>${esc(o.name)}</span></a>`)
              .join('')}</div></section>`
          : ''
      }
    </article>`;
  renderWhenReady(root, html, [preload(c.code)]);
}

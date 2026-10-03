import { byCode, Country, REGIONS } from '../data';
import { deck, level, state, streak } from '../store';
import { countryLink, esc, flagImg } from '../ui';

function meter(learned: number, learning: number, total: number) {
  const pct = (n: number) => (total ? (n / total) * 100 : 0);
  return `<div class="meter" role="img" aria-label="${learned} learned, ${learning} in progress, of ${total}">
    ${learned ? `<span class="seg seg-learned" style="width:${pct(learned)}%" title="Learned: ${learned}"></span>` : ''}
    ${learning ? `<span class="seg seg-learning" style="width:${pct(learning)}%" title="In progress: ${learning}"></span>` : ''}
  </div>`;
}

export function progressView(root: HTMLElement) {
  const all = deck();
  const count = (list: Country[]) => {
    let learned = 0, learning = 0;
    for (const c of list) {
      const lv = level(c.code);
      if (lv === 'known' || lv === 'mastered') learned++;
      else if (lv === 'learning') learning++;
    }
    return { learned, learning, total: list.length };
  };
  const overall = count(all);
  const answers = Object.values(state.days).reduce((n, d) => n + d.reviews, 0);
  const correct = Object.values(state.days).reduce((n, d) => n + d.correct, 0);
  const tricky = Object.entries(state.cards)
    .filter(([, m]) => m.lapses >= 2)
    .sort((a, b) => b[1].lapses - a[1].lapses)
    .slice(0, 8)
    .map(([k]) => byCode.get(k))
    .filter((c): c is Country => !!c);

  root.innerHTML = `
    <header class="page-head"><h1>Progress</h1></header>
    <section class="card">
      <div class="stats">
        <div><strong>${overall.learned}</strong><span>flags learned</span></div>
        <div><strong>${overall.learning}</strong><span>in progress</span></div>
        <div><strong>${streak()}</strong><span>day streak</span></div>
        <div><strong>${answers ? Math.round((correct / answers) * 100) + '%' : '—'}</strong><span>accuracy</span></div>
      </div>
      ${meter(overall.learned, overall.learning, overall.total)}
      <div class="legend">
        <span><i class="seg-learned"></i>Learned</span>
        <span><i class="seg-learning"></i>In progress</span>
        <span><i class="seg-empty"></i>Not started</span>
      </div>
    </section>

    <section class="card">
      <h2>By region</h2>
      <div class="regions">
        ${REGIONS.map((r) => {
          const s = count(all.filter((c) => c.region === r));
          return `<div class="region-row">
            <span class="region-name">${r}</span>
            ${meter(s.learned, s.learning, s.total)}
            <span class="region-count muted">${s.learned} / ${s.total}</span>
          </div>`;
        }).join('')}
      </div>
    </section>

    ${
      tricky.length
        ? `<section class="card"><h2>Flags you mix up most</h2><div class="mini-grid">${tricky
            .map((c) => `<a class="mini" href="${countryLink(c)}"><span class="mini-flag">${flagImg(c, { size: 'sm' })}</span><span>${esc(c.name)}</span></a>`)
            .join('')}</div></section>`
        : ''
    }`;
}

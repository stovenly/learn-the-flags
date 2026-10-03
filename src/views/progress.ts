import { byCode, Country, REGIONS } from '../data';
import { deck, level, Level, SessionLog, state, streak } from '../store';
import { $, $$, countryLink, esc, flagImg, plural } from '../ui';

type Status = 'learned' | 'learning' | 'new';
const statusOf = (lv: Level): Status => (lv === 'known' || lv === 'mastered' ? 'learned' : lv);

const INFO = {
  learned: "You've got this flag right over several days. It's solid enough that it only comes back every week or more for a quick check.",
  learning: "You've met this flag, but it still needs a few more reviews before it sticks.",
};

function info(label: string, text: string) {
  return `<details class="info"><summary aria-label="What does “${label}” mean?">?</summary><p class="info-pop">${esc(text)}</p></details>`;
}

function meter(learned: number, learning: number, total: number) {
  const pct = (n: number) => (total ? (n / total) * 100 : 0);
  return `<div class="meter" role="img" aria-label="${learned} learned, ${learning} in progress, of ${total}">
    ${learned ? `<span class="seg seg-learned" style="width:${pct(learned)}%" title="Learned: ${learned}"></span>` : ''}
    ${learning ? `<span class="seg seg-learning" style="width:${pct(learning)}%" title="In progress: ${learning}"></span>` : ''}
  </div>`;
}

function when(ms: number): string {
  const d = new Date(ms);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(ms).setHours(0, 0, 0, 0)) / 86400000);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  const date = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: days > 300 ? 'numeric' : undefined });
  return `${date}, ${time}`;
}

const minutes = (ms: number) => (ms < 60000 ? '<1 min' : `${Math.round(ms / 60000)} min`);

function sessionRow(s: SessionLog) {
  const learned = s.learned.map((k) => byCode.get(k)).filter((c): c is Country => !!c);
  const pct = Math.round((s.correct / s.answered) * 100);
  return `<li class="history-row">
    <div class="history-main">
      <strong>${when(s.at)}</strong>
      <span class="muted">${minutes(s.ms)} · ${plural(s.answered, 'answer')} · ${pct}% correct${learned.length ? ` · ${plural(learned.length, 'new flag')}` : ''}</span>
    </div>
    ${
      learned.length
        ? `<div class="history-flags">${learned
            .slice(0, 8)
            .map((c) => `<a href="${countryLink(c)}" title="${esc(c.name)}">${flagImg(c, { size: 'sm', lazy: true })}</a>`)
            .join('')}${learned.length > 8 ? `<span class="muted">+${learned.length - 8}</span>` : ''}</div>`
        : ''
    }
  </li>`;
}

let gridFilter: Status | 'all' = 'all';

export function progressView(root: HTMLElement) {
  const all = deck();
  const status = new Map(all.map((c) => [c.code, statusOf(level(c.code))]));
  const count = (list: Country[]) => {
    let learned = 0, learning = 0;
    for (const c of list) {
      const s = status.get(c.code);
      if (s === 'learned') learned++;
      else if (s === 'learning') learning++;
    }
    return { learned, learning, fresh: list.length - learned - learning, total: list.length };
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
  const sessions = state.sessions;

  root.innerHTML = `
    <header class="page-head"><h1>Progress</h1></header>
    <section class="card">
      <div class="stats">
        <div><strong>${overall.learned}</strong><span>flags learned ${info('learned', INFO.learned)}</span></div>
        <div><strong>${overall.learning}</strong><span>in progress ${info('in progress', INFO.learning)}</span></div>
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

    <section class="card">
      <div class="section-head">
        <h2>Your flags</h2>
        <div class="chips" role="group" aria-label="Show">
          ${(
            [
              ['all', `All ${overall.total}`],
              ['learned', `Learned ${overall.learned}`],
              ['learning', `In progress ${overall.learning}`],
              ['new', `Not started ${overall.fresh}`],
            ] as const
          )
            .map(([k, label]) => `<button class="chip${gridFilter === k ? ' active' : ''}" data-filter="${k}">${label}</button>`)
            .join('')}
        </div>
      </div>
      <div class="flag-wall">
        ${all
          .map((c) => {
            const s = status.get(c.code)!;
            const label = s === 'learned' ? 'learned' : s === 'learning' ? 'in progress' : 'not started';
            return `<a class="wall-flag is-${s}" href="${countryLink(c)}" data-status="${s}" title="${esc(c.name)} · ${label}">${flagImg(c, { size: 'sm', lazy: true })}</a>`;
          })
          .join('')}
      </div>
    </section>

    ${
      tricky.length
        ? `<section class="card"><h2>Flags you mix up most</h2><div class="mini-grid">${tricky
            .map((c) => `<a class="mini" href="${countryLink(c)}"><span class="mini-flag">${flagImg(c, { size: 'sm' })}</span><span>${esc(c.name)}</span></a>`)
            .join('')}</div></section>`
        : ''
    }

    <section class="card">
      <h2>Session history</h2>
      ${
        sessions.length
          ? `<ul class="history">${sessions.slice(0, 10).map(sessionRow).join('')}</ul>
             ${sessions.length > 10 ? `<button class="btn ghost" data-act="more">Show all ${sessions.length} sessions</button>` : ''}`
          : `<p class="muted">Your finished sessions will show up here.</p>`
      }
    </section>`;

  const tiles = $$('.wall-flag', root);
  const apply = () => tiles.forEach((t) => (t.hidden = gridFilter !== 'all' && t.dataset.status !== gridFilter));
  for (const chip of $$('[data-filter]', root)) {
    chip.addEventListener('click', () => {
      gridFilter = chip.dataset.filter as typeof gridFilter;
      $$('[data-filter]', root).forEach((c) => c.classList.toggle('active', c === chip));
      apply();
    });
  }
  apply();
  $('[data-act=more]', root)?.addEventListener('click', (e) => {
    $('.history', root).innerHTML = sessions.map(sessionRow).join('');
    (e.currentTarget as HTMLElement).remove();
  });
}

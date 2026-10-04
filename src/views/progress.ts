import { ALL, url, byCode, CONTINENTS, Country, inSet, SETS, SOVEREIGN } from '../data';
import { attachTips, Status, STATUS_TEXT, statusOf } from '../tips';
import { level, SessionLog, state, streak } from '../store';
import { $, $$, countryLink, esc, flagImg, plural, thumb } from '../ui';


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
    ${learned ? `<span class="seg seg-learned" style="width:${pct(learned)}%"></span>` : ''}
    ${learning ? `<span class="seg seg-learning" style="width:${pct(learning)}%"></span>` : ''}
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
      <span class="muted">${minutes(s.ms)} · ${plural(s.answered, 'answer')} · ${pct}% correct</span>
    </div>
    ${
      learned.length
        ? `<div class="history-flags">${learned
            .slice(0, 5)
            .map((c) => `<a href="${countryLink(c)}" data-tip="${c.code}" aria-label="${esc(c.name)}">${flagImg(c, { size: 'sm', lazy: true, alt: '' })}</a>`)
            .join('')}${learned.length > 5 ? `<span class="muted small">+${learned.length - 5}</span>` : ''}</div>`
        : ''
    }
  </li>`;
}

let gridFilter: Status | 'all' = 'all';

export function progressView(root: HTMLElement) {
  const all = ALL;
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
  const sessions = state.sessions;

  if (!overall.learned && !overall.learning) {
    root.innerHTML = `
      <header class="page-head"><h1>Progress</h1></header>
      <section class="card empty-state">
        <h2>Nothing here yet</h2>
        <p class="muted">Finish your first lesson and your flags, streak and sessions will show up here.</p>
        <a class="btn primary" href="${url('study/')}">Start learning</a>
      </section>`;
    return;
  }

  const answers = Object.values(state.days).reduce((n, d) => n + d.reviews, 0);
  const correct = Object.values(state.days).reduce((n, d) => n + d.correct, 0);
  const tricky = Object.entries(state.cards)
    .filter(([, m]) => m.lapses >= 2)
    .sort((a, b) => b[1].lapses - a[1].lapses)
    .slice(0, 8)
    .map(([k]) => byCode.get(k))
    .filter((c): c is Country => !!c);

  const wall = (list: Country[]) =>
    `<div class="flag-wall">${list
      .map((c) => {
        const s = status.get(c.code)!;
        return `<a class="wall-flag is-${s}" href="${countryLink(c)}" data-tip="${c.code}" data-status="${s}" aria-label="${esc(c.name)}, ${STATUS_TEXT[s].toLowerCase()}">${flagImg(c, { size: 'sm', lazy: true, alt: '' })}</a>`;
      })
      .join('')}</div>`;
  const groupHead = (name: string, list: Country[], tag = 'h2') => {
    const s = count(list);
    return `<div class="wall-head"><${tag}>${esc(name)}</${tag}><span class="muted small">${s.learned} of ${s.total} learned</span></div>`;
  };
  const setCards = SETS.map((set) => {
    const list = inSet(set.id);
    const body =
      set.id === SOVEREIGN
        ? CONTINENTS.map((k) => {
            const sub = list.filter((c) => c.continent === k);
            return `<div class="wall-group">${groupHead(k, sub, 'h3')}${wall(sub)}</div>`;
          }).join('')
        : wall(list);
    return `<section class="card wall-card" data-set="${set.id}">${groupHead(set.name, list)}${body}</section>`;
  }).join('');

  root.innerHTML = `
    <header class="page-head"><h1>Progress</h1></header>
    <section class="card overview">
      <div class="overview-main">
        <div class="big-number"><strong>${overall.learned}</strong><span>${overall.learned === 1 ? 'flag' : 'flags'} learned ${info('learned', INFO.learned)}</span></div>
        <div class="legend">
          <span><i class="seg-learned"></i>Learned ${overall.learned}</span>
          <span><i class="seg-learning"></i>In progress ${overall.learning} ${info('in progress', INFO.learning)}</span>
        </div>
        <div class="stats">
          <div class="stat"><strong>${streak()}</strong><span>day streak</span></div>
          <div class="stat"><strong>${answers ? Math.round((correct / answers) * 100) + '%' : '—'}</strong><span>accuracy</span></div>
          <div class="stat"><strong>${sessions.length}</strong><span>${sessions.length === 1 ? 'session' : 'sessions'}</span></div>
        </div>
      </div>
      <div class="overview-regions">
        <h2 class="label">By set</h2>
        ${SETS.map((set) => {
          const s = count(inSet(set.id));
          return `<div class="region-row">
            <span class="region-name">${esc(set.name)}</span>
            ${meter(s.learned, s.learning, s.total)}
            <span class="region-count muted">${s.learned}/${s.total}</span>
          </div>`;
        }).join('')}
      </div>
    </section>

    <div class="section-head wall-toolbar">
      <h2>Your flags</h2>
      <div class="chips" role="group" aria-label="Show">
        ${(
          [
            ['all', 'All'],
            ['learned', 'Learned'],
            ['learning', 'In progress'],
            ['new', 'Not started'],
          ] as const
        )
          .map(([k, label]) => `<button class="chip${gridFilter === k ? ' active' : ''}" data-filter="${k}">${label}</button>`)
          .join('')}
      </div>
    </div>
    ${setCards}
    <p class="empty muted" hidden>No flags here yet.</p>

    <div class="progress-cols${tricky.length ? '' : ' single'}">
      ${
        tricky.length
          ? `<section class="card"><h2>Flags you mix up most</h2><div class="thumb-grid">${tricky
              .map((c) => `<a class="thumb-link" href="${countryLink(c)}">${thumb(c)}<span>${esc(c.name)}</span></a>`)
              .join('')}</div></section>`
          : ''
      }
      <section class="card">
        <h2>Recent sessions</h2>
        ${
          sessions.length
            ? `<ul class="history">${sessions.slice(0, 6).map(sessionRow).join('')}</ul>
               ${sessions.length > 6 ? `<button class="btn quiet" data-act="more">Show all ${sessions.length} sessions</button>` : ''}`
            : `<p class="muted">Your finished sessions will show up here.</p>`
        }
      </section>
    </div>`;

  attachTips(root);
  const tiles = $$('.wall-flag', root);
  const apply = () => {
    tiles.forEach((t) => (t.hidden = gridFilter !== 'all' && t.dataset.status !== gridFilter));
    for (const g of $$('.wall-group, .wall-card', root)) g.hidden = !$$('.wall-flag', g).some((t) => !t.hidden);
    $('.empty', root).hidden = tiles.some((t) => !t.hidden);
  };
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

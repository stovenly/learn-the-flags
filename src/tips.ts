import { badgeTip } from './badges';
import { byCode, Country } from './data';
import { onCleanup } from './router';
import { dayNumber } from './srs';
import { level, Level, state } from './store';
import { esc, plural } from './ui';

export type Status = 'learned' | 'learning' | 'new';
export const statusOf = (lv: Level): Status => (lv === 'known' || lv === 'mastered' ? 'learned' : lv);
export const STATUS_TEXT: Record<Status, string> = { learned: 'Learned', learning: 'In progress', new: 'Not started' };

function fromNow(ms: number): string {
  const d = dayNumber(ms) - dayNumber(Date.now());
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d === -1) return 'yesterday';
  return d > 0 ? `in ${plural(d, 'day')}` : `${plural(-d, 'day')} ago`;
}

function tipHtml(c: Country) {
  const s = statusOf(level(c.code));
  const m = state.cards[c.code];
  const lines = [c.subregion || c.region];
  if (m) {
    lines.push(`Practised ${fromNow(m.last)}`);
    lines.push(m.due <= Date.now() ? 'Due for review now' : `Next review ${fromNow(m.due)}`);
    if (m.lapses) lines.push(`Forgotten ${m.lapses === 1 ? 'once' : `${m.lapses} times`}`);
  }
  return `<div class="tip-head"><strong>${esc(c.name)}</strong><span class="tip-status is-${s}">${STATUS_TEXT[s]}</span></div>${lines
    .map((l) => `<span>${esc(l)}</span>`)
    .join('')}`;
}

// One tooltip for every [data-tip="<code>"] and [data-badge="<id>"] inside root, on mouse hover and keyboard focus; removed when the view changes.
export function attachTips(root: HTMLElement) {
  const tip = document.createElement('div');
  tip.className = 'tip';
  tip.setAttribute('role', 'tooltip');
  tip.hidden = true;
  document.body.append(tip);
  const off = new AbortController();
  const signal = off.signal;
  onCleanup(() => {
    off.abort();
    tip.remove();
  });
  let current: HTMLElement | null = null;
  const show = (el: HTMLElement) => {
    const c = byCode.get(el.dataset.tip ?? '');
    const html = el.dataset.badge ? badgeTip(el.dataset.badge) : c && tipHtml(c);
    if (!html) return;
    current = el;
    tip.innerHTML = html;
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const above = r.top - t.height - 8;
    tip.style.left = `${Math.min(Math.max(8, r.left + r.width / 2 - t.width / 2), innerWidth - t.width - 8)}px`;
    tip.style.top = `${above >= 8 ? above : r.bottom + 8}px`;
  };
  const hide = () => {
    current = null;
    tip.hidden = true;
  };
  const tileOf = (e: Event) => (e.target as HTMLElement).closest<HTMLElement>('[data-tip], [data-badge]');
  root.addEventListener(
    'pointerover',
    (e) => {
      const el = tileOf(e);
      if (!el) hide();
      else if (el !== current && e.pointerType === 'mouse') show(el);
    },
    { signal },
  );
  root.addEventListener('pointerleave', hide, { signal });
  root.addEventListener(
    'focusin',
    (e) => {
      const el = tileOf(e);
      if (el) show(el);
    },
    { signal },
  );
  root.addEventListener('focusout', hide, { signal });
  addEventListener('scroll', hide, { passive: true, signal });
}

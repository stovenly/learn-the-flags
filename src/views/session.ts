import { ALL, url, byCode, Country, endonymText, matchAnswer, preload, preloadMap, setById, SOVEREIGN } from '../data';
import { Again, Easy, Good, Grade, Hard, Memory, review } from '../srs';
import { logSession, recordQuiz, save, state, today } from '../store';
import { $, $$, countryLink, esc, flagImg, hookHtml, icon, lookalikeList, mapImg, nameLink, pairList, plural, shuffle, thumb } from '../ui';
import { onCleanup } from '../router';

export type Mode = 'pick-name' | 'pick-flag' | 'type-name';

interface Intro {
  kind: 'intro';
  c: Country;
}
interface Quiz {
  kind: 'quiz';
  c: Country;
  mode: Mode;
  options?: Country[];
}
export type Item = Intro | Quiz;

interface Track {
  isNew: boolean;
  graded: boolean;
  needed: number; // further correct answers required before the card leaves the session
  attempts: number;
  missed: boolean;
}

export interface SessionConfig {
  items: Item[];
  scheduled: boolean; // false for practice: answers do not touch the review schedule
  title: string;
  test?: { key: string }; // a quiz: one question per flag, no retries, scored at the end
  onDone: (summary: Summary) => string; // returns HTML for the end screen actions
}

export interface Summary {
  answered: number;
  correct: number;
  learned: Country[];
  missed: Country[];
}

function once(fn: () => void) {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    fn();
  };
}

const intro = (c: Country): Intro => ({ kind: 'intro', c });
export const quiz = (c: Country, mode: Mode): Quiz => ({ kind: 'quiz', c, mode });

export function modeFor(c: Country, step?: number): Mode {
  const pick = (): Mode =>
    step === undefined ? (Math.random() < 0.5 ? 'pick-name' : 'pick-flag') : step % 2 === 0 ? 'pick-name' : 'pick-flag';
  const style = state.settings.answerStyle;
  if (style === 'typing') return 'type-name';
  if (style === 'choice') return pick();
  const m = state.cards[c.code];
  if (!m) return pick();
  const r = Math.random();
  if (m.s < 2) return r < 0.4 ? 'type-name' : r < 0.7 ? 'pick-flag' : 'pick-name';
  if (m.s < 10) return r < 0.65 ? 'type-name' : 'pick-flag';
  return r < 0.8 ? 'type-name' : 'pick-flag';
}

// Reviews warm up first, then each new flag is introduced and quizzed one step behind the next introduction.
export function buildStudy(due: Country[], fresh: Country[]): Item[] {
  const reviews = shuffle(due).map((c) => quiz(c, modeFor(c)));
  const half = Math.ceil(reviews.length / 2);
  const lesson: Item[] = [];
  fresh.forEach((c, i) => {
    lesson.push(intro(c));
    if (i > 0) lesson.push(quiz(fresh[i - 1], modeFor(fresh[i - 1], 0)));
  });
  if (fresh.length) lesson.push(quiz(fresh[fresh.length - 1], modeFor(fresh[fresh.length - 1], 0)));
  return [...reviews.slice(0, half), ...lesson, ...reviews.slice(half)];
}

function distractors(c: Country, n = 3): Country[] {
  const known = (x: Country) => !!state.cards[x.code];
  const pool = ALL.filter((x) => x.code !== c.code && x.set === c.set && !c.identical.includes(x.code));
  const out: Country[] = [];
  const add = (x?: Country) => {
    if (x && x.code !== c.code && !c.identical.includes(x.code) && !out.some((o) => o.code === x.code)) out.push(x);
  };
  const look = shuffle(lookalikeList(c).filter((x) => x.set === c.set));
  const m = state.cards[c.code];
  const lookCount = !m || m.s < 1 ? 1 : 2;
  look.slice(0, lookCount).forEach(add);
  shuffle(c.nearest.slice(0, 8).map((k) => byCode.get(k)!).filter((x) => known(x) && x.set === c.set)).slice(0, 1).forEach(add);
  const learned = shuffle(pool.filter(known));
  while (out.length < n && learned.length) add(learned.pop());
  const rest = shuffle(pool);
  while (out.length < n && rest.length) add(rest.pop());
  return shuffle([c, ...out.slice(0, n)]);
}

function ensureOptions(item: Item) {
  if (item.kind === 'quiz' && item.mode !== 'type-name' && !item.options) item.options = distractors(item.c);
}

function preloadItem(item: Item): Promise<unknown> {
  ensureOptions(item);
  const jobs = [preload(item.c.code), preloadMap(item.c)];
  if (item.kind === 'quiz' && item.mode === 'pick-flag') jobs.push(preloadMap(item.c, true));
  if (item.kind === 'quiz' && item.mode === 'pick-flag') item.options!.forEach((o) => jobs.push(preload(o.code)));
  if (item.kind === 'intro') lookalikeList(item.c).slice(0, 3).forEach((o) => jobs.push(preload(o.code, 320)));
  return Promise.all(jobs);
}

export function runSession(root: HTMLElement, cfg: SessionConfig) {
  const queue = [...cfg.items];
  const tracks = new Map<string, Track>();
  const summary: Summary = { answered: 0, correct: 0, learned: [], missed: [] };
  let total = queue.filter((i) => i.kind === 'quiz').length;
  let done = 0;
  let current: Item | undefined;
  let keyHandler: ((e: KeyboardEvent) => void) | null = null;
  const startedAt = Date.now();
  let logged = false;
  const record = () => {
    if (logged || !cfg.scheduled || !summary.answered) return;
    logged = true;
    logSession({
      at: startedAt,
      ms: Date.now() - startedAt,
      answered: summary.answered,
      correct: summary.correct,
      learned: summary.learned.map((c) => c.code),
      missed: summary.missed.map((c) => c.code),
    });
  };

  for (const item of queue) {
    if (tracks.has(item.c.code)) continue;
    const isNew = cfg.scheduled && !state.cards[item.c.code];
    tracks.set(item.c.code, { isNew, graded: false, needed: isNew ? 2 : 1, attempts: 0, missed: false });
  }

  root.innerHTML = `
    <div class="session">
      <div class="session-bar">
        <a class="icon-btn" href="${url()}" aria-label="End session" title="End session (progress is saved)">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </a>
        <div class="progress"><div class="progress-fill"></div></div>
        <span class="session-count muted"></span>
      </div>
      <div class="session-stage"></div>
    </div>`;
  const stage = $('.session-stage', root);

  const onKey = (e: KeyboardEvent) => keyHandler?.(e);
  document.addEventListener('keydown', onKey);
  onCleanup(() => {
    document.removeEventListener('keydown', onKey);
    record();
  });

  function updateBar() {
    const pct = total ? Math.min(100, (done / total) * 100) : 0;
    $('.progress-fill', root).style.width = `${pct}%`;
    $('.session-count', root).textContent = `${done} / ${total}`;
  }

  function insertAt(offset: number, item: Item) {
    queue.splice(Math.min(offset, queue.length), 0, item);
  }

  let advancing = false;
  async function next() {
    if (advancing) return;
    advancing = true;
    keyHandler = null;
    current = queue.shift();
    updateBar();
    if (current) {
      await preloadItem(current);
      queue.slice(0, 3).forEach(preloadItem);
      if (current.kind === 'intro') renderIntro(current);
      else renderQuiz(current);
    } else finish();
    advancing = false;
  }

  function grade(c: Country, g: Grade, correct: boolean): Memory | undefined {
    const t = tracks.get(c.code)!;
    t.attempts++;
    const prev = state.cards[c.code];
    summary.answered++;
    if (correct) summary.correct++;
    if (!correct && !t.missed) {
      t.missed = true;
      summary.missed.push(c);
    }
    if (!cfg.scheduled) return prev;
    const day = today();
    day.reviews++;
    if (correct) day.correct++;
    if (!t.graded && t.isNew) {
      day.learned++;
      summary.learned.push(c);
    }
    t.graded = true;
    state.cards[c.code] = review(prev, g, state.settings.retention);
    save();
    return prev;
  }

  function regrade(c: Country, prev: Memory | undefined, g: Grade) {
    summary.correct++;
    const t = tracks.get(c.code)!;
    if (t.missed && t.attempts === 1) {
      t.missed = false;
      summary.missed = summary.missed.filter((x) => x.code !== c.code);
    }
    if (!cfg.scheduled) return;
    today().correct++;
    state.cards[c.code] = review(prev, g, state.settings.retention);
    save();
  }

  function schedule(item: Quiz, correct: boolean) {
    const t = tracks.get(item.c.code)!;
    done++;
    if (cfg.test) return;
    if (correct) t.needed--;
    else {
      t.needed = Math.max(t.needed, 1) + (t.isNew && t.needed < 2 ? 1 : 0);
      if (!cfg.scheduled) t.needed = Math.min(t.needed, 1);
    }
    if (t.needed > 0 && t.attempts < 6) {
      const style = state.settings.answerStyle;
      // In a lesson, a correct pick is followed by typing the name; a miss by picking among lookalikes.
      const mode: Mode =
        style === 'typing' ? 'type-name' : style === 'choice' ? (item.mode === 'pick-name' ? 'pick-flag' : 'pick-name') : correct ? 'type-name' : 'pick-flag';
      insertAt(correct ? 4 + Math.floor(Math.random() * 3) : 2 + Math.floor(Math.random() * 2), quiz(item.c, mode));
      total++;
    }
  }

  function unschedule(item: Quiz, prev: Memory | undefined, g: Grade) {
    const t = tracks.get(item.c.code)!;
    regrade(item.c, prev, g);
    const idx = queue.findIndex((q) => q.c.code === item.c.code);
    if (idx !== -1 && t.needed <= 1) {
      queue.splice(idx, 1);
      total--;
    }
    t.needed = Math.max(0, t.needed - 1);
  }

  function renderIntro(item: Intro) {
    const c = item.c;
    const looks = lookalikeList(c).slice(0, 3);
    stage.innerHTML = `
      <article class="card stage intro split fade-in">
        <div class="pane-main">
          <span class="pill">New flag</span>
          <div class="flag-stage">${flagImg(c, { size: 'lg' })}</div>
          <h2 class="intro-name">${nameLink(c)}</h2>
          ${endonymText(c) ? `<p class="endonym">${esc(endonymText(c))}</p>` : ''}
          <p class="muted intro-meta">${esc(c.subregion || c.region)}</p>
          ${mapImg(c, 'md')}
        </div>
        <div class="pane-side">
          ${c.flag.description ? `<p class="intro-desc">${esc(c.flag.description)}</p>` : ''}
          ${hookHtml(c)}
          ${looks.length ? `<section class="lookalikes"><h3 class="label">Don't mix it up with</h3>${pairList(c, looks)}</section>` : ''}
          <div class="actions">
            ${cfg.scheduled ? `<button class="btn quiet" data-act="known">I already know this one</button>` : ''}
            <button class="btn primary" data-act="next">Got it <kbd>Enter</kbd></button>
          </div>
        </div>
      </article>`;
    const go = once(next);
    $('[data-act=next]', stage).addEventListener('click', go);
    $('[data-act=known]', stage)?.addEventListener('click', once(() => {
      const t = tracks.get(c.code)!;
      grade(c, Easy, true);
      summary.answered--;
      summary.correct--;
      t.needed = 0;
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i].c.code === c.code) {
        queue.splice(i, 1);
        total--;
      }
      go();
    }));
    keyHandler = (e) => {
      if (e.key === 'Enter') go();
    };
    $('[data-act=next]', stage).focus({ preventScroll: true });
  }

  // `withMap` is false when the question already shows the map; `compare` is false when both flags are already on screen.
  function feedbackHtml(c: Country, ok: boolean, chosen?: Country, note?: string, withMap = true, compare = true) {
    if (ok) {
      return `<div class="result ok">${icon('check')}<p><strong>Correct</strong> · ${nameLink(c)}${note ? `<span class="muted"> · ${esc(note)}</span>` : ''}</p>${withMap ? mapImg(c, 'xs') : ''}</div>`;
    }
    const tell = chosen && c.differences[chosen.code];
    return `<div class="result bad">${icon('cross')}<p><strong>Not quite.</strong> It's ${nameLink(c)}${chosen ? `, not ${esc(chosen.name)}` : ''}.</p></div>
      ${
        chosen && compare
          ? `<div class="versus">
              <figure class="is-answer">${thumb(c)}<figcaption>${esc(c.name)}</figcaption></figure>
              <figure>${thumb(chosen)}<figcaption>${esc(chosen.name)}</figcaption></figure>
            </div>`
          : ''
      }
      ${tell ? `<div class="note note-tell">${icon('tell')}<div><span class="note-label">How to tell them apart</span><p>${esc(tell)}</p></div></div>` : hookHtml(c)}
      ${withMap && c.hasMap ? `<div class="fb-map">${mapImg(c, 'md')}</div>` : ''}`;
  }

  function afterAnswer(extra = '') {
    const actions = $('.actions', stage);
    actions.innerHTML = `${extra}<button class="btn primary" data-act="continue">Continue <kbd>Enter</kbd></button>`;
    const go = once(next);
    $('[data-act=continue]', actions).addEventListener('click', go);
    $('[data-act=continue]', actions).focus({ preventScroll: true });
    keyHandler = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        go();
      }
    };
  }

  // Wide screens show the answer's map under the flag instead of the thumbnail in the feedback.
  function showAnswerMap(c: Country) {
    if (c.hasMap) $('.pane-main', stage).insertAdjacentHTML('beforeend', `<div class="answer-map">${mapImg(c, 'md')}</div>`);
  }

  function renderQuiz(item: Quiz) {
    const c = item.c;
    const noun = setById.get(c.set)!.noun;
    const started = performance.now();
    const elapsed = () => (performance.now() - started) / 1000;
    let answered = false;

    if (item.mode === 'pick-name') {
      stage.innerHTML = `
        <article class="card stage quiz split fade-in">
          <div class="pane-main">
          <p class="prompt">Which ${noun} is this?</p>
          <div class="flag-stage">${flagImg(c, { size: 'lg', alt: 'Flag to identify' })}</div>
          </div>
          <div class="pane-side">
          <div class="options">${item
            .options!.map((o, i) => `<button class="option" data-code="${o.code}"><kbd>${i + 1}</kbd><span>${esc(o.name)}</span></button>`)
            .join('')}</div>
          <div class="feedback-slot"></div>
          <div class="actions"></div>
          </div>
        </article>`;
    } else if (item.mode === 'pick-flag') {
      stage.innerHTML = `
        <article class="card stage quiz split fade-in">
          <div class="pane-main">
          <p class="prompt">Which is the flag of</p>
          <h2 class="quiz-name">${esc(c.name)}</h2>${mapImg(c, 'sm', true)}
          </div>
          <div class="pane-side">
          <div class="flag-options">${item
            .options!.map(
              (o, i) =>
                `<button class="flag-option" data-code="${o.code}" aria-label="Option ${i + 1}"><kbd>${i + 1}</kbd>${flagImg(o, { size: 'md', alt: `Option ${i + 1}` })}<span class="flag-option-name"></span></button>`,
            )
            .join('')}</div>
          <div class="feedback-slot"></div>
          <div class="actions"></div>
          </div>
        </article>`;
    } else {
      stage.innerHTML = `
        <article class="card stage quiz split fade-in">
          <div class="pane-main">
          <p class="prompt">Name this ${noun}</p>
          <div class="flag-stage">${flagImg(c, { size: 'lg', alt: 'Flag to identify' })}</div>
          </div>
          <div class="pane-side">
          <form class="type-form" autocomplete="off">
            <input class="type-input" type="text" placeholder="Type the name…" aria-label="Name" autocapitalize="words" spellcheck="false" enterkeyhint="done">
            <button class="btn primary" type="submit">Check</button>
          </form>
          <div class="feedback-slot"></div>
          <div class="actions"><button class="btn quiet" data-act="unknown">I don't know <kbd>Esc</kbd></button></div>
          </div>
        </article>`;
    }

    const slot = $('.feedback-slot', stage);

    if (item.mode !== 'type-name') {
      const buttons = $$('[data-code]', stage);
      const choose = (code: string) => {
        if (answered) return;
        answered = true;
        const ok = code === c.code;
        const chosen = byCode.get(code)!;
        const g: Grade = ok ? (elapsed() > 10 ? Hard : Good) : Again;
        grade(c, g, ok);
        schedule(item, ok);
        for (const b of buttons) {
          b.setAttribute('disabled', '');
          if (b.dataset.code === c.code) b.classList.add('is-correct');
          else if (b.dataset.code === code) b.classList.add('is-wrong');
          if (item.mode === 'pick-flag') {
            $('.flag-option-name', b).textContent = byCode.get(b.dataset.code!)!.name;
          }
        }
        slot.innerHTML = feedbackHtml(c, ok, ok ? undefined : chosen, undefined, item.mode !== 'pick-flag', item.mode !== 'pick-flag');
        if (item.mode === 'pick-name') showAnswerMap(c);
        if (item.mode === 'pick-flag') $('.quiz-name', stage).innerHTML = nameLink(c);
        afterAnswer();
      };
      buttons.forEach((b) => b.addEventListener('click', () => choose(b.dataset.code!)));
      keyHandler = (e) => {
        const n = Number(e.key);
        if (n >= 1 && n <= buttons.length) choose(buttons[n - 1].dataset.code!);
      };
      return;
    }

    const input = $('.type-input', stage) as HTMLInputElement;
    input.focus({ preventScroll: true });
    const submit = (giveUp: boolean) => {
      if (answered) return;
      const text = input.value.trim();
      if (!giveUp && !text) return;
      answered = true;
      input.disabled = true;
      $('.type-form button', stage).setAttribute('disabled', '');
      const match = giveUp ? 'wrong' : matchAnswer(text, c);
      const ok = match !== 'wrong';
      const g: Grade = !ok ? Again : elapsed() > 15 ? Hard : Good;
      const prev = grade(c, g, ok);
      schedule(item, ok);
      input.classList.add(ok ? 'is-correct' : 'is-wrong');
      const guessed = ALL.find((o) => o.code !== c.code && [c.set, SOVEREIGN].includes(o.set) && matchAnswer(text, o) === 'exact');
      slot.innerHTML = feedbackHtml(c, ok, ok ? undefined : guessed, match === 'typo' ? `spelled “${c.name}”` : undefined);
      showAnswerMap(c);
      if (!ok && text && !guessed) {
        afterAnswer(`<button class="btn quiet" data-act="accept">I was right</button>`);
        $('[data-act=accept]', stage).addEventListener('click', once(() => {
          unschedule(item, prev, Good);
          next();
        }));
      } else afterAnswer();
    };
    $('.type-form', stage).addEventListener('submit', (e) => {
      e.preventDefault();
      submit(false);
    });
    $('[data-act=unknown]', stage).addEventListener('click', () => submit(true));
    keyHandler = (e) => {
      if (e.key === 'Escape') submit(true);
    };
  }

  function finish() {
    keyHandler = null;
    record();
    if (cfg.test) return finishTest(cfg.test.key);
    const pct = summary.answered ? Math.round((summary.correct / summary.answered) * 100) : 0;
    const mins = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
    const strip = (title: string, list: Country[]) =>
      list.length
        ? `<section class="done-group"><h3 class="label">${title}</h3><div class="thumb-grid">${list
            .map((c) => `<a class="thumb-link" href="${countryLink(c)}">${thumb(c)}<span>${esc(c.name)}</span></a>`)
            .join('')}</div></section>`
        : '';
    stage.innerHTML = `
      <article class="card stage done fade-in">
        <span class="pill">${esc(cfg.title)} complete</span>
        <h2>${!summary.answered ? 'All done' : pct >= 90 ? 'Great work' : pct >= 70 ? 'Nice work' : 'Good practice'}</h2>
        ${
          summary.answered
            ? `<div class="stats stats-inline">
                <div class="stat"><strong>${pct}%</strong><span>correct</span></div>
                <div class="stat"><strong>${summary.answered}</strong><span>${summary.answered === 1 ? 'answer' : 'answers'}</span></div>
                <div class="stat"><strong>${summary.learned.length}</strong><span>new ${summary.learned.length === 1 ? 'flag' : 'flags'}</span></div>
                <div class="stat"><strong>${mins}</strong><span>${mins === 1 ? 'minute' : 'minutes'}</span></div>
              </div>`
            : ''
        }
        ${strip('New today', summary.learned)}
        ${strip('Worth another look', summary.missed)}
        <div class="actions">${cfg.onDone(summary)}</div>
      </article>`;
    $('.session-count', root).textContent = '';
    $('.progress-fill', root).style.width = '100%';
  }

  function finishTest(key: string) {
    const total = summary.answered;
    const pct = total ? Math.round((summary.correct / total) * 100) : 0;
    const prev = total ? recordQuiz(key, summary.correct, total) : undefined;
    const prevPct = prev ? Math.round((prev.correct / prev.total) * 100) : null;
    const verdict = pct === 100 ? 'Perfect score' : pct >= 90 ? 'Outstanding' : pct >= 75 ? 'Great work' : pct >= 50 ? 'Good effort' : 'Keep practising';
    stage.innerHTML = `
      <article class="card stage done quiz-result fade-in">
        <span class="pill">${esc(cfg.title)} complete</span>
        <h2>${verdict}</h2>
        <div class="score"><strong>${summary.correct}</strong><span>of ${total} correct</span></div>
        <p class="score-meta muted">${[
          `${pct}%`,
          plural(Math.max(1, Math.round((Date.now() - startedAt) / 60000)), 'minute'),
          prevPct === null ? '' : pct > prevPct ? `New best (was ${prevPct}%)` : `Best ${prevPct}%`,
        ]
          .filter(Boolean)
          .join(' · ')}</p>
        ${
          summary.missed.length
            ? `<section class="done-group"><h3 class="label">Missed</h3><div class="thumb-grid">${summary.missed
                .map((c) => `<a class="thumb-link" href="${countryLink(c)}">${thumb(c)}<span>${esc(c.name)}</span></a>`)
                .join('')}</div></section>`
            : ''
        }
        <div class="actions">${cfg.onDone(summary)}</div>
      </article>`;
    $('.session-count', root).textContent = '';
    $('.progress-fill', root).style.width = '100%';
  }

  next();
}

import { ALL, byCode, Country, matchAnswer, preload, preloadGlobe } from '../data';
import { Again, Easy, Good, Grade, Hard, Memory, review } from '../srs';
import { save, state, today } from '../store';
import { $, $$, countryLink, differencesHtml, esc, flagImg, globeImg, lookalikeList, plural, shuffle } from '../ui';
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
  const pool = ALL.filter((x) => x.code !== c.code && (state.settings.includePartial || x.status !== 'partially-recognized'));
  const out: Country[] = [];
  const add = (x?: Country) => {
    if (x && x.code !== c.code && !out.some((o) => o.code === x.code) && pool.includes(x)) out.push(x);
  };
  const look = shuffle(lookalikeList(c));
  const m = state.cards[c.code];
  const lookCount = !m || m.s < 1 ? 1 : 2;
  look.slice(0, lookCount).forEach(add);
  shuffle(c.nearest.slice(0, 8).map((k) => byCode.get(k)!).filter(known)).slice(0, 1).forEach(add);
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
  const jobs = [preload(item.c.code), preloadGlobe(item.c.code)];
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
  let timer = 0;

  for (const item of queue) {
    if (tracks.has(item.c.code)) continue;
    const isNew = cfg.scheduled && !state.cards[item.c.code];
    tracks.set(item.c.code, { isNew, graded: false, needed: isNew ? 2 : 1, attempts: 0, missed: false });
  }

  root.innerHTML = `
    <div class="session">
      <div class="session-bar">
        <a class="icon-btn" href="#/" aria-label="End session" title="End session (progress is saved)">
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
    clearTimeout(timer);
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
    clearTimeout(timer);
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
      <article class="card intro fade-in">
        <p class="eyebrow">New flag</p>
        <div class="flag-stage">${flagImg(c, { size: 'lg' })}</div>
        <div class="name-row">
          ${globeImg(c, 'md')}
          <div>
            <h2 class="intro-name">${esc(c.name)}</h2>
            <p class="muted intro-meta">${esc(c.subregion || c.region)}</p>
          </div>
        </div>
        ${c.flag.description ? `<p class="intro-desc">${esc(c.flag.description)}</p>` : ''}
        ${c.hook ? `<div class="hook"><span class="hook-label">Memory hook</span><p>${esc(c.hook)}</p></div>` : ''}
        ${
          looks.length
            ? `<div class="contrast"><p class="eyebrow">Don't confuse with</p><div class="contrast-row">${looks
                .map((o) => `<figure>${flagImg(o, { size: 'sm' })}<figcaption>${esc(o.name)}</figcaption></figure>`)
                .join('')}</div>${differencesHtml(c, looks)}</div>`
            : ''
        }
        <div class="actions">
          ${cfg.scheduled ? `<button class="btn ghost" data-act="known">I already know this one</button>` : ''}
          <button class="btn primary" data-act="next">Got it <kbd>Enter</kbd></button>
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

  function feedbackHtml(c: Country, ok: boolean, chosen?: Country, note?: string) {
    if (ok) {
      return `<div class="feedback ok fb-head">${globeImg(c, 'sm')}<p><strong>Correct</strong> — ${esc(c.name)}${note ? `<span class="muted"> · ${esc(note)}</span>` : ''}</p></div>`;
    }
    const compare = chosen
      ? `<div class="compare">
          <figure>${flagImg(c, { size: 'sm' })}<figcaption><strong>${esc(c.name)}</strong></figcaption></figure>
          <figure>${flagImg(chosen, { size: 'sm' })}<figcaption>${esc(chosen.name)}</figcaption></figure>
        </div>`
      : '';
    const tell = chosen ? differencesHtml(c, [chosen]) : '';
    return `<div class="feedback bad">
        <div class="fb-head">${globeImg(c, 'sm')}<p><strong>It's ${esc(c.name)}.</strong>${chosen ? ` You answered ${esc(chosen.name)}.` : ''}</p></div>
        ${compare}
        ${tell || (c.hook ? `<div class="hook"><span class="hook-label">Memory hook</span><p>${esc(c.hook)}</p></div>` : '')}
        <p class="more"><a href="${countryLink(c)}" target="_blank" rel="noopener">More about ${esc(c.name)} ↗</a></p>
      </div>`;
  }

  function afterAnswer(item: Quiz, ok: boolean, extra = '') {
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
    if (ok) timer = window.setTimeout(go, 900);
  }

  function renderQuiz(item: Quiz) {
    const c = item.c;
    const started = performance.now();
    const elapsed = () => (performance.now() - started) / 1000;
    let answered = false;

    if (item.mode === 'pick-name') {
      stage.innerHTML = `
        <article class="card quiz fade-in">
          <p class="eyebrow">Which country is this?</p>
          <div class="flag-stage">${flagImg(c, { size: 'lg', alt: 'Flag to identify' })}</div>
          <div class="options">${item
            .options!.map((o, i) => `<button class="option" data-code="${o.code}"><kbd>${i + 1}</kbd><span>${esc(o.name)}</span></button>`)
            .join('')}</div>
          <div class="feedback-slot"></div>
          <div class="actions"></div>
        </article>`;
    } else if (item.mode === 'pick-flag') {
      stage.innerHTML = `
        <article class="card quiz fade-in">
          <p class="eyebrow">Which is the flag of</p>
          <div class="name-row quiz-name-row">${globeImg(c, 'md')}<h2 class="quiz-name">${esc(c.name)}</h2></div>
          <div class="flag-options">${item
            .options!.map(
              (o, i) =>
                `<button class="flag-option" data-code="${o.code}" aria-label="Option ${i + 1}"><kbd>${i + 1}</kbd>${flagImg(o, { size: 'md', alt: `Option ${i + 1}` })}<span class="flag-option-name"></span></button>`,
            )
            .join('')}</div>
          <div class="feedback-slot"></div>
          <div class="actions"></div>
        </article>`;
    } else {
      stage.innerHTML = `
        <article class="card quiz fade-in">
          <p class="eyebrow">Name this country</p>
          <div class="flag-stage">${flagImg(c, { size: 'lg', alt: 'Flag to identify' })}</div>
          <form class="type-form" autocomplete="off">
            <input class="type-input" type="text" placeholder="Type the country name…" aria-label="Country name" autocapitalize="words" spellcheck="false" enterkeyhint="done">
            <button class="btn primary" type="submit">Check</button>
          </form>
          <div class="feedback-slot"></div>
          <div class="actions"><button class="btn ghost" data-act="unknown">I don't know</button></div>
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
        slot.innerHTML = feedbackHtml(c, ok, ok ? undefined : chosen);
        afterAnswer(item, ok);
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
      const guessed = ALL.find((o) => o.code !== c.code && matchAnswer(text, o) === 'exact');
      slot.innerHTML = feedbackHtml(c, ok, ok ? undefined : guessed, match === 'typo' ? `spelled “${c.name}”` : undefined);
      if (!ok && text && !guessed) {
        afterAnswer(item, false, `<button class="btn ghost" data-act="accept">I was right</button>`);
        $('[data-act=accept]', stage).addEventListener('click', once(() => {
          unschedule(item, prev, Good);
          next();
        }));
      } else afterAnswer(item, ok && match === 'exact');
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
    const pct = summary.answered ? Math.round((summary.correct / summary.answered) * 100) : 0;
    const strip = (list: Country[]) =>
      `<div class="mini-grid">${list
        .map((c) => `<a class="mini" href="${countryLink(c)}"><span class="mini-flag">${flagImg(c, { size: 'sm' })}</span><span>${esc(c.name)}</span></a>`)
        .join('')}</div>`;
    stage.innerHTML = `
      <article class="card done fade-in">
        <p class="eyebrow">${esc(cfg.title)} complete</p>
        <h2>${summary.answered ? `${pct}% correct` : 'All done'}</h2>
        <p class="muted">${plural(summary.answered, 'answer')}${summary.learned.length ? ` · ${plural(summary.learned.length, 'new flag')}` : ''}</p>
        ${summary.learned.length ? `<h3>Learned today</h3>${strip(summary.learned)}` : ''}
        ${summary.missed.length ? `<h3>Worth another look</h3>${strip(summary.missed)}` : ''}
        <div class="actions">${cfg.onDone(summary)}</div>
      </article>`;
    $('.session-count', root).textContent = '';
    $('.progress-fill', root).style.width = '100%';
  }

  next();
}

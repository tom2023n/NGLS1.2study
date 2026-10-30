/**
 * Study logic for NGSL 常用词学习.
 *
 * The FSRS card shape and review/preview wrappers are adapted from
 * Word Atlas (MIT, Copyright (c) 2026 Word Atlas contributors):
 * https://github.com/designfuchen/word-atlas
 * Scheduling itself is ts-fsrs (MIT, Copyright (c) 2026 Open Spaced Repetition).
 */
import { createEmptyCard, fsrs, Rating, State } from "./vendor/ts-fsrs.mjs";

export { Rating, State };

export const MASTERED_STABILITY = 21;
export const STORAGE_KEY = "ngsl-study-progress-v1";
export const DAILY_DATE_KEY = "ngsl-study-today";

const schedulers = new Map();

function scheduler(retention, fuzz) {
  const key = `${retention}:${fuzz ? 1 : 0}`;
  let instance = schedulers.get(key);
  if (!instance) {
    instance = fsrs({
      request_retention: retention,
      enable_fuzz: fuzz,
      enable_short_term: true,
      learning_steps: ["1m", "10m"],
      relearning_steps: ["10m"],
    });
    schedulers.set(key, instance);
  }
  return instance;
}

function toCard(card) {
  return {
    due: new Date(card.due),
    stability: card.s,
    difficulty: card.d,
    elapsed_days: card.el,
    scheduled_days: card.sd,
    learning_steps: card.ls,
    reps: card.reps,
    lapses: card.lapses,
    state: card.st,
    last_review: card.last ? new Date(card.last) : undefined,
  };
}

function fromCard(card, seen) {
  return {
    due: card.due.getTime(),
    s: card.stability,
    d: card.difficulty,
    el: card.elapsed_days,
    sd: card.scheduled_days,
    ls: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    st: card.state,
    last: card.last_review ? card.last_review.getTime() : undefined,
    seen,
  };
}

export function review(prev, grade, now, retention = 0.9, fuzz = true) {
  const card = prev ? toCard(prev) : createEmptyCard(new Date(now));
  const next = scheduler(retention, fuzz).next(card, new Date(now), grade).card;
  return fromCard(next, prev?.seen ?? now);
}

export function preview(prev, now, retention = 0.9, fuzz = true) {
  const card = prev ? toCard(prev) : createEmptyCard(new Date(now));
  const record = scheduler(retention, fuzz).repeat(card, new Date(now));
  return {
    [Rating.Again]: record[Rating.Again].card.due.getTime() - now,
    [Rating.Hard]: record[Rating.Hard].card.due.getTime() - now,
    [Rating.Good]: record[Rating.Good].card.due.getTime() - now,
    [Rating.Easy]: record[Rating.Easy].card.due.getTime() - now,
  };
}

export function isMastered(card) {
  return !!card && card.st === State.Review && card.s >= MASTERED_STABILITY;
}

export function isLearning(card) {
  return !!card && !isMastered(card);
}

export function statusOf(card) {
  if (!card) return "unseen";
  return isMastered(card) ? "mastered" : "learning";
}

export function formatInterval(ms) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 1) return "<1分";
  if (minutes < 60) return `${minutes}分`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}小时`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days}天`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}个月`;
  return `${(days / 365).toFixed(1)}年`;
}

export function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function daysBetween(start, end) {
  const [ay, am, ad] = start.split("-").map(Number);
  const [by, bm, bd] = end.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/** Keep real question marks. Only trim surrounding whitespace. */
export function sanitizeText(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

/**
 * Detect GB18030-as-Latin1 mojibake clusters.
 * "径" is a normal character (路径、途径) and must not be treated as mojibake.
 */
const MOJIBAKE = /[閸掓瑥娴犻弰閺堥幋︽]/g;
export function seemsMojibake(text) {
  if (!text) return false;
  const hits = text.match(MOJIBAKE);
  return !!hits && hits.length >= 2;
}

export function glossKey(text) {
  return sanitizeText(text).replace(/\s+/g, "");
}

function shuffle(list) {
  const array = [...list];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Distractors must not share the answer's Chinese gloss.
 * Prefer the same part of speech, then fill from the rest of the deck.
 */
export function pickDistractors(answer, words, count = 3) {
  const answerGloss = glossKey(answer.chinese);
  const unique = [];
  const seenGloss = new Set();
  if (answerGloss) seenGloss.add(answerGloss);
  const pool = words.filter((word) => word.id !== answer.id && glossKey(word.chinese) !== answerGloss);
  const samePos = pool.filter((word) => word.partOfSpeech === answer.partOfSpeech);
  for (const word of shuffle([...samePos, ...shuffle(pool)])) {
    const gloss = glossKey(word.chinese);
    if (!gloss || seenGloss.has(gloss)) continue;
    seenGloss.add(gloss);
    unique.push(word);
    if (unique.length >= count) break;
  }
  return unique;
}

export function emptyProgress(now = Date.now()) {
  return {
    version: 2,
    cards: {},
    favorites: [],
    recent: [],
    streak: 0,
    lastStudyDate: "",
    lastWordId: null,
    lastFilter: "all",
    lastRank: "all",
    lastMode: "today",
    lastQuery: "",
    lastPanel: "study",
    viewPositions: {},
    days: {},
    settings: { accent: "us", dailyNew: 10 },
    todayDone: 0,
    [DAILY_DATE_KEY]: localDate(new Date(now)),
  };
}

function finite(value, min = -Infinity, max = Infinity) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function validCard(value) {
  return (
    value &&
    typeof value === "object" &&
    finite(value.due, 0) &&
    finite(value.s, 0) &&
    finite(value.d, 0, 11) &&
    finite(value.el, 0) &&
    finite(value.sd, 0) &&
    finite(value.ls, 0) &&
    finite(value.reps, 0) &&
    finite(value.lapses, 0) &&
    [0, 1, 2, 3].includes(value.st) &&
    finite(value.seen, 0)
  );
}

function seedCard(kind, now) {
  if (kind === "mastered") {
    return {
      due: now + 21 * 86400000,
      s: MASTERED_STABILITY,
      d: 5,
      el: 21,
      sd: 21,
      ls: 0,
      reps: 6,
      lapses: 0,
      st: State.Review,
      last: now,
      seen: now,
    };
  }
  return {
    due: now,
    s: 0.4,
    d: 6,
    el: 0,
    sd: 0,
    ls: 0,
    reps: 1,
    lapses: 0,
    st: State.Learning,
    last: now,
    seen: now,
  };
}

function sanitizeDays(days) {
  const out = {};
  if (!days || typeof days !== "object") return out;
  for (const [key, value] of Object.entries(days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !value || typeof value !== "object") continue;
    out[key] = {
      n: finite(value.n, 0) ? value.n : 0,
      r: finite(value.r, 0) ? value.r : 0,
      c: finite(value.c, 0) ? value.c : 0,
      extra: finite(value.extra, 0) ? value.extra : 0,
    };
  }
  return out;
}

function sanitizeSettings(settings) {
  const accent = settings?.accent === "uk" ? "uk" : "us";
  const dailyNew = finite(settings?.dailyNew, 0, 100) ? Math.round(settings.dailyNew) : 10;
  return { accent, dailyNew };
}

/**
 * Read either a v2 record or the original v1 progress object.
 * v1 `status` of mastered/learning is turned into FSRS cards so existing
 * localStorage progress keeps its meaning.
 */
export function migrateProgress(stored, now = Date.now()) {
  const base = emptyProgress(now);
  if (!stored || typeof stored !== "object") return base;

  const ids = (list, limit) =>
    [...new Set((Array.isArray(list) ? list : []).map(Number).filter((id) => Number.isInteger(id)))].slice(0, limit);
  base.favorites = ids(stored.favorites, 5000);
  base.recent = ids(stored.recent, 40);
  base.streak = finite(stored.streak, 0) ? stored.streak : 0;
  base.lastStudyDate = typeof stored.lastStudyDate === "string" ? stored.lastStudyDate : "";
  base.lastWordId = finite(stored.lastWordId, 1) ? stored.lastWordId : null;
  base.lastFilter = typeof stored.lastFilter === "string" ? stored.lastFilter : "all";
  base.lastRank = typeof stored.lastRank === "string" ? stored.lastRank : "all";
  base.lastMode = stored.lastMode === "browse" ? "browse" : "today";
  base.lastQuery = typeof stored.lastQuery === "string" ? stored.lastQuery : "";
  base.lastPanel = typeof stored.lastPanel === "string" ? stored.lastPanel : "study";
  base.viewPositions =
    stored.viewPositions && typeof stored.viewPositions === "object" ? stored.viewPositions : {};
  base.days = sanitizeDays(stored.days);
  base.settings = sanitizeSettings(stored.settings);
  base.todayDone = finite(stored.todayDone, 0) ? stored.todayDone : 0;

  if (stored.version === 2 && stored.cards && typeof stored.cards === "object") {
    for (const [id, card] of Object.entries(stored.cards)) {
      if (validCard(card)) base.cards[String(Number(id))] = card;
    }
    return base;
  }

  const status = stored.status && typeof stored.status === "object" ? stored.status : {};
  for (const [id, value] of Object.entries(status)) {
    if (value === "mastered" || value === "learning") {
      base.cards[String(Number(id))] = seedCard(value, now);
    }
  }

  const today = localDate(new Date(now));
  if (stored[DAILY_DATE_KEY] === today && base.todayDone) {
    const day = base.days[today] || { n: 0, r: 0, c: 0, extra: 0 };
    day.r = Math.max(day.r, base.todayDone);
    base.days[today] = day;
  } else if (stored[DAILY_DATE_KEY] && stored[DAILY_DATE_KEY] !== today) {
    base.todayDone = 0;
  }
  base[DAILY_DATE_KEY] = today;
  return base;
}

export function touchDay(progress, now, patch) {
  const key = localDate(new Date(now));
  const current = progress.days[key] || { n: 0, r: 0, c: 0, extra: 0 };
  progress.days[key] = {
    n: current.n + (patch.n || 0),
    r: current.r + (patch.r || 0),
    c: current.c + (patch.c || 0),
    extra: current.extra + (patch.extra || 0),
  };
  progress.todayDone = progress.days[key].r;
  progress[DAILY_DATE_KEY] = key;
  if (progress.lastStudyDate !== key) {
    if (!progress.lastStudyDate) progress.streak = 1;
    else {
      const gap = daysBetween(progress.lastStudyDate, key);
      progress.streak = gap === 1 ? (progress.streak || 0) + 1 : 1;
    }
    progress.lastStudyDate = key;
  }
}

export function dayStat(progress, now = Date.now()) {
  return progress.days[localDate(new Date(now))] || { n: 0, r: 0, c: 0, extra: 0 };
}

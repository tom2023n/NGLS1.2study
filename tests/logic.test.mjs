import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  Rating,
  dayStat,
  daysBetween,
  formatInterval,
  glossKey,
  isMastered,
  localDate,
  migrateProgress,
  pickDistractors,
  preview,
  review,
  sanitizeText,
  seemsMojibake,
  statusOf,
  touchDay,
} from "../logic.js";

const DAY = 86400000;

test("question marks at the end of sentences stay", () => {
  assert.equal(sanitizeText("Is this seat free?"), "Is this seat free?");
  assert.equal(sanitizeText("  hello  "), "hello");
  assert.equal(sanitizeText(null), "");
});

test("径 in 路径 and 途径 is not treated as mojibake", () => {
  assert.equal(seemsMojibake("小路；路径"), false);
  assert.equal(seemsMojibake("1.航道；海峡；2.途径；渠道"), false);
  assert.equal(seemsMojibake("閸掓瑥娴犻弰"), true);
  assert.equal(seemsMojibake("路径"), false);
});

test("local dates follow the machine timezone, not UTC", () => {
  const eveningBeforeUtcMidnight = new Date("2026-10-29T18:30:00Z");
  const utcDay = eveningBeforeUtcMidnight.toISOString().slice(0, 10);
  const local = localDate(eveningBeforeUtcMidnight);
  if (process.env.TZ === "Asia/Shanghai") {
    assert.equal(local, "2026-10-30");
    assert.notEqual(local, utcDay);
  } else {
    assert.match(local, /^\d{4}-\d{2}-\d{2}$/);
  }
  assert.equal(daysBetween("2026-10-29", "2026-10-30"), 1);
  assert.equal(daysBetween("2026-10-30", "2026-10-30"), 0);
});

test("one Good answer does not master a word; repeated Good reviews do", () => {
  const now = Date.UTC(2026, 9, 25, 12);
  const intervals = preview(undefined, now, 0.9, false);
  assert.ok(intervals[Rating.Again] < intervals[Rating.Good]);
  assert.ok(intervals[Rating.Good] <= intervals[Rating.Easy]);
  let card = review(undefined, Rating.Good, now, 0.9, false);
  assert.equal(isMastered(card), false);
  assert.equal(statusOf(card), "learning");
  let time = now;
  for (let i = 0; i < 12 && !isMastered(card); i += 1) {
    time = Math.max(card.due, time + DAY);
    card = review(card, Rating.Good, time, 0.9, false);
  }
  assert.equal(isMastered(card), true);
  const before = card.s;
  const lapsed = review(card, Rating.Again, card.due, 0.9, false);
  assert.equal(lapsed.lapses, 1);
  assert.ok(lapsed.s < before);
  assert.equal(isMastered(lapsed), false);
});

test("quiz distractors never share the answer gloss", () => {
  const words = [
    { id: 1, word: "object", partOfSpeech: "verb", chinese: "反对" },
    { id: 2, word: "oppose", partOfSpeech: "verb", chinese: "反对" },
    { id: 3, word: "opposition", partOfSpeech: "noun", chinese: "反对" },
    { id: 4, word: "resistance", partOfSpeech: "noun", chinese: "反对" },
    { id: 5, word: "agree", partOfSpeech: "verb", chinese: "同意" },
    { id: 6, word: "support", partOfSpeech: "verb", chinese: "支持" },
    { id: 7, word: "refuse", partOfSpeech: "verb", chinese: "拒绝" },
    { id: 8, word: "accept", partOfSpeech: "verb", chinese: "接受" },
  ];
  for (let i = 0; i < 30; i += 1) {
    const picked = pickDistractors(words[0], words, 3);
    assert.equal(picked.length, 3);
    for (const item of picked) {
      assert.notEqual(glossKey(item.chinese), "反对");
      assert.notEqual(item.id, 1);
    }
  }
});

test("same-gloss groups in the real word list stay unambiguous", () => {
  const raw = fs.readFileSync(new URL("../words.js", import.meta.url), "utf8");
  const words = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
  const groups = new Map();
  for (const word of words) {
    const key = glossKey(word.chinese);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(word);
  }
  const duplicated = [...groups.values()].filter((group) => group.length > 1);
  assert.ok(duplicated.length >= 200);
  for (const group of duplicated) {
    const answer = group[0];
    const picked = pickDistractors(answer, words, 3);
    assert.equal(picked.length, 3);
    for (const item of picked) assert.notEqual(glossKey(item.chinese), glossKey(answer.chinese));
  }
});

test("v1 mastered and learning progress migrates into FSRS cards", () => {
  const now = Date.UTC(2026, 9, 30, 2);
  const migrated = migrateProgress(
    {
      status: { 1: "mastered", 2: "learning", 3: "unseen" },
      favorites: [2, 2, 9],
      recent: [2],
      streak: 4,
      lastStudyDate: "2026-10-29",
      todayDone: 3,
      "ngsl-study-today": "2026-10-30",
      lastFilter: "learning",
    },
    now
  );
  assert.equal(migrated.version, 2);
  assert.equal(isMastered(migrated.cards["1"]), true);
  assert.equal(statusOf(migrated.cards["2"]), "learning");
  assert.equal(migrated.cards["3"], undefined);
  assert.deepEqual(migrated.favorites, [2, 9]);
  assert.equal(migrated.streak, 4);
  assert.equal(migrated.lastFilter, "learning");
  touchDay(migrated, now, { r: 1, c: 1 });
  assert.equal(dayStat(migrated, now).r >= 1, true);
  assert.match(formatInterval(10 * 60000), /10分|小时/);
});

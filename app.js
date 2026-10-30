import {
  DAILY_DATE_KEY,
  Rating,
  STORAGE_KEY,
  dayStat,
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
} from "./logic.js";

const HUES = ["#e7c2b3", "#d7e0cc", "#f0ddb0", "#c9d7e4", "#e3d0dc", "#d5e4df"];
const rawWords = Array.isArray(window.NGSL_WORDS) ? window.NGSL_WORDS : [];
const words = rawWords.map((entry) => ({
  ...entry,
  chinese: sanitizeText(entry.chinese),
  exampleChinese: sanitizeText(entry.exampleChinese),
  definition: sanitizeText(entry.definition),
  example: sanitizeText(entry.example),
  partOfSpeech: sanitizeText(entry.partOfSpeech),
  pronunciation: sanitizeText(entry.pronunciation),
}));
const byId = new Map(words.map((word) => [word.id, word]));

const state = {
  mode: "today",
  queue: [],
  index: 0,
  filter: "all",
  rank: "all",
  query: "",
  quiz: null,
  progress: loadProgress(),
  deferredPrompt: null,
};

const $ = (id) => document.getElementById(id);
const els = {
  accentToggle: $("accentToggle"),
  filterBtn: $("filterBtn"),
  filterDialog: $("filterDialog"),
  filterClose: $("filterClose"),
  filterRoot: $("filterRoot"),
  rail: $("rail"),
  installBtn: $("installBtn"),
  iosHint: $("iosHint"),
  iosHintClose: $("iosHintClose"),
  queueLabel: $("queueLabel"),
  modeBtn: $("modeBtn"),
  shuffleBtn: $("shuffleBtn"),
  progressLabel: $("progressLabel"),
  streakLabel: $("streakLabel"),
  progressTrack: $("progressTrack"),
  progressBar: $("progressBar"),
  studyEmpty: $("studyEmpty"),
  emptyCopy: $("emptyCopy"),
  moreBtn: $("moreBtn"),
  browseBtn: $("browseBtn"),
  cardFrame: $("cardFrame"),
  wordCard: $("wordCard"),
  flipBtn: $("flipBtn"),
  flipBackBtn: $("flipBackBtn"),
  frontIllo: $("frontIllo"),
  frontImg: $("frontImg"),
  frontPlate: $("frontPlate"),
  frontInitial: $("frontInitial"),
  backIllo: $("backIllo"),
  backImg: $("backImg"),
  backInitial: $("backInitial"),
  studyOrder: $("studyOrder"),
  studyWord: $("studyWord"),
  studyHint: $("studyHint"),
  ipaRow: $("ipaRow"),
  studyPos: $("studyPos"),
  studyWordBack: $("studyWordBack"),
  favoriteBtn: $("favoriteBtn"),
  studyChinese: $("studyChinese"),
  studyDefinition: $("studyDefinition"),
  studyExample: $("studyExample"),
  studyExampleChinese: $("studyExampleChinese"),
  memoryNote: $("memoryNote"),
  speakExampleBtn: $("speakExampleBtn"),
  againBtn: $("againBtn"),
  goodBtn: $("goodBtn"),
  againIv: $("againIv"),
  goodIv: $("goodIv"),
  gradeRow: $("gradeRow"),
  prevBtn: $("prevBtn"),
  nextBtn: $("nextBtn"),
  speakBtn: $("speakBtn"),
  searchInput: $("searchInput"),
  rankChips: $("rankChips"),
  filterChips: $("filterChips"),
  quizPrompt: $("quizPrompt"),
  quizOptions: $("quizOptions"),
  quizFeedback: $("quizFeedback"),
  newQuizBtn: $("newQuizBtn"),
  masteredCount: $("masteredCount"),
  learningCount: $("learningCount"),
  todayCount: $("todayCount"),
  favoriteCount: $("favoriteCount"),
  weekList: $("weekList"),
  weekStreak: $("weekStreak"),
  dailyNewInput: $("dailyNewInput"),
  favoritesList: $("favoritesList"),
  recentList: $("recentList"),
  exportBtn: $("exportBtn"),
  importBtn: $("importBtn"),
  importFile: $("importFile"),
  resetProgressBtn: $("resetProgressBtn"),
  backupStatus: $("backupStatus"),
  aboutBtn: $("aboutBtn"),
  aboutDialog: $("aboutDialog"),
  aboutClose: $("aboutClose"),
  tabs: [...document.querySelectorAll(".tab")],
  panels: [...document.querySelectorAll(".panel")],
};

let currentAudio = null;

init();

function init() {
  restoreView();
  placeFilters();
  bindEvents();
  rebuildQueue(true);
  render();
  buildQuiz();
  setupInstall();
  registerServiceWorker();
}

function bindEvents() {
  els.accentToggle.addEventListener("click", (event) => {
    const button = event.target.closest("[data-accent]");
    if (!button) return;
    state.progress.settings.accent = button.dataset.accent === "uk" ? "uk" : "us";
    save();
    render();
    speakCurrentWord();
  });
  els.filterBtn.addEventListener("click", () => els.filterDialog.showModal());
  els.filterClose.addEventListener("click", () => els.filterDialog.close());
  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    if (state.query) state.mode = "browse";
    rebuildQueue(true);
    render();
  });
  els.rankChips.addEventListener("click", (event) => {
    const button = event.target.closest("[data-rank]");
    if (!button) return;
    state.rank = button.dataset.rank;
    syncChips();
    rebuildQueue(true);
    render();
  });
  els.filterChips.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    state.filter = button.dataset.filter;
    state.mode = "browse";
    syncChips();
    rebuildQueue(true);
    render();
  });
  els.tabs.forEach((tab) => tab.addEventListener("click", () => switchPanel(tab.dataset.target)));
  els.modeBtn.addEventListener("click", () => {
    state.mode = state.mode === "today" ? "browse" : "today";
    rebuildQueue(true);
    render();
  });
  els.shuffleBtn.addEventListener("click", () => {
    if (!state.queue.length) return;
    state.index = Math.floor(Math.random() * state.queue.length);
    resetFace();
    render();
  });
  els.flipBtn.addEventListener("click", flip);
  els.flipBackBtn.addEventListener("click", flip);
  els.favoriteBtn.addEventListener("click", () => {
    const word = currentWord();
    if (word) toggleFavorite(word.id);
  });
  els.prevBtn.addEventListener("click", () => step(-1));
  els.nextBtn.addEventListener("click", () => step(1));
  els.speakBtn.addEventListener("click", speakCurrentWord);
  els.speakExampleBtn.addEventListener("click", speakCurrentExample);
  els.againBtn.addEventListener("click", () => grade(Rating.Again));
  els.goodBtn.addEventListener("click", () => grade(Rating.Good));
  els.moreBtn.addEventListener("click", () => {
    touchDay(state.progress, Date.now(), { extra: 5 });
    save();
    state.mode = "today";
    rebuildQueue(true);
    render();
  });
  els.browseBtn.addEventListener("click", () => {
    state.mode = "browse";
    state.filter = "all";
    syncChips();
    rebuildQueue(true);
    render();
  });
  els.newQuizBtn.addEventListener("click", buildQuiz);
  els.dailyNewInput.addEventListener("change", () => {
    const value = Math.max(0, Math.min(50, Number(els.dailyNewInput.value) || 0));
    state.progress.settings.dailyNew = value;
    els.dailyNewInput.value = String(value);
    save();
    if (state.mode === "today") rebuildQueue(false);
    render();
  });
  els.exportBtn.addEventListener("click", exportProgress);
  els.importBtn.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", importProgress);
  els.resetProgressBtn.addEventListener("click", resetProgress);
  els.aboutBtn.addEventListener("click", () => els.aboutDialog.showModal());
  els.aboutClose.addEventListener("click", () => els.aboutDialog.close());
  els.iosHintClose.addEventListener("click", () => {
    localStorage.setItem("ngsl-ios-hint-dismissed", "1");
    els.iosHint.classList.add("hidden");
  });
  window.matchMedia("(min-width: 1000px)").addEventListener("change", placeFilters);
  document.addEventListener("keydown", onKeydown);
  if ("speechSynthesis" in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }
}

function onKeydown(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const tag = event.target?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  const panel = activePanel();
  if (panel === "study") {
    if (event.key === " " && tag !== "BUTTON") {
      event.preventDefault();
      flip();
    } else if (event.key === " " && event.target?.id === "flipBtn") {
      event.preventDefault();
      flip();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    } else if (event.key === "1") {
      event.preventDefault();
      grade(Rating.Again);
    } else if (event.key === "2") {
      event.preventDefault();
      grade(Rating.Good);
    }
    return;
  }
  if (panel === "quiz" && state.quiz) {
    if (!state.quiz.answered && /^[1-4]$/.test(event.key)) {
      const button = els.quizOptions.querySelectorAll(".quiz-option")[Number(event.key) - 1];
      if (button) {
        event.preventDefault();
        button.click();
      }
    } else if (state.quiz.answered && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      buildQuiz();
    }
  }
}

function placeFilters() {
  const desktop = window.matchMedia("(min-width: 1000px)").matches;
  if (desktop) {
    els.rail.append(els.filterRoot);
    if (els.filterDialog.open) els.filterDialog.close();
  } else if (!els.filterDialog.contains(els.filterRoot)) {
    els.filterDialog.append(els.filterRoot);
  }
}

function loadProgress() {
  try {
    return migrateProgress(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
  } catch {
    return migrateProgress(null);
  }
}

function save() {
  state.progress.version = 2;
  state.progress[DAILY_DATE_KEY] = localDate();
  state.progress.lastMode = state.mode;
  state.progress.lastFilter = state.filter;
  state.progress.lastRank = state.rank;
  state.progress.lastQuery = state.query;
  state.progress.lastPanel = activePanel();
  const word = currentWord();
  if (word) {
    state.progress.lastWordId = word.id;
    state.progress.viewPositions[viewKey()] = word.id;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function restoreView() {
  state.filter = state.progress.lastFilter || "all";
  state.rank = state.progress.lastRank || "all";
  state.mode = state.progress.lastMode === "browse" ? "browse" : "today";
  state.query = state.progress.lastQuery || "";
  els.searchInput.value = state.query;
  els.dailyNewInput.value = String(state.progress.settings.dailyNew ?? 10);
  syncChips();
  switchPanel(state.progress.lastPanel || "study", false);
}

function viewKey() {
  return [state.mode, state.filter, state.rank, state.query].join("|");
}

function cardOf(id) {
  return state.progress.cards[String(id)];
}

function currentWord() {
  return state.queue[state.index] || null;
}

function activePanel() {
  return els.panels.find((panel) => panel.classList.contains("active"))?.dataset.panel || "study";
}

function inRank(word) {
  if (state.rank === "all") return true;
  const [start, end] = state.rank.split("-").map(Number);
  return word.id >= start && word.id <= end;
}

function matchesBrowse(word) {
  if (!inRank(word)) return false;
  const query = state.query;
  if (query) {
    const hay = `${word.word} ${word.chinese} ${word.definition} ${word.partOfSpeech}`.toLowerCase();
    if (!hay.includes(query)) return false;
  }
  const status = statusOf(cardOf(word.id));
  if (state.filter === "favorites") return state.progress.favorites.includes(word.id);
  if (state.filter === "due") return !!cardOf(word.id) && cardOf(word.id).due <= Date.now();
  if (state.filter === "all") return true;
  return status === state.filter;
}

function rebuildQueue(resetIndex) {
  const saved = state.progress.viewPositions[viewKey()] || state.progress.lastWordId;
  if (state.mode === "browse") {
    state.queue = words.filter(matchesBrowse);
  } else {
    const now = Date.now();
    const due = words
      .filter((word) => cardOf(word.id) && cardOf(word.id).due <= now)
      .sort((a, b) => cardOf(a.id).due - cardOf(b.id).due);
    const today = dayStat(state.progress, now);
    const room = Math.max(0, (state.progress.settings.dailyNew || 0) + (today.extra || 0) - (today.n || 0));
    const fresh = words.filter((word) => inRank(word) && !cardOf(word.id)).slice(0, room);
    state.queue = [...due, ...fresh];
  }
  if (!resetIndex && state.index < state.queue.length) return;
  const found = saved ? state.queue.findIndex((word) => word.id === saved) : -1;
  state.index = found >= 0 ? found : 0;
  resetFace();
}

function step(direction) {
  if (!state.queue.length) return;
  state.index = (state.index + direction + state.queue.length) % state.queue.length;
  resetFace();
  render();
  save();
}

function flip() {
  if (!currentWord()) return;
  els.wordCard.classList.toggle("is-flipped");
  els.flipBtn.setAttribute("aria-pressed", String(els.wordCard.classList.contains("is-flipped")));
}

function resetFace() {
  els.wordCard.classList.remove("is-flipped");
  els.flipBtn.setAttribute("aria-pressed", "false");
  const body = els.wordCard.querySelector(".back-body");
  if (body) body.scrollTop = 0;
}

function grade(rating) {
  const word = currentWord();
  if (!word || activePanel() !== "study") return;
  const now = Date.now();
  const prev = cardOf(word.id);
  const next = review(prev, rating, now, 0.9, true);
  state.progress.cards[String(word.id)] = next;
  touchDay(state.progress, now, {
    n: prev ? 0 : 1,
    r: 1,
    c: rating === Rating.Again ? 0 : 1,
  });
  rememberRecent(word.id);
  if (state.mode === "today") {
    state.queue = state.queue.filter((item) => item.id !== word.id);
    if (next.due - now < 20 * 60 * 1000) {
      const at = Math.min(state.queue.length, state.index + 2);
      state.queue.splice(at, 0, word);
    }
    if (state.index >= state.queue.length) state.index = 0;
  } else {
    step(1);
    save();
    renderMe();
    return;
  }
  resetFace();
  save();
  render();
}

function toggleFavorite(id) {
  const favorites = new Set(state.progress.favorites);
  if (favorites.has(id)) favorites.delete(id);
  else favorites.add(id);
  state.progress.favorites = [...favorites];
  rememberRecent(id);
  save();
  render();
}

function rememberRecent(id) {
  state.progress.recent = [id, ...state.progress.recent.filter((item) => item !== id)].slice(0, 20);
}

function render() {
  renderStats();
  renderCard();
  renderMe();
  syncAccent();
}

function syncAccent() {
  const accent = state.progress.settings.accent === "uk" ? "uk" : "us";
  [...els.accentToggle.querySelectorAll("button")].forEach((button) => {
    button.classList.toggle("is-on", button.dataset.accent === accent);
  });
}

function syncChips() {
  [...els.rankChips.querySelectorAll(".chip")].forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.rank === state.rank);
  });
  [...els.filterChips.querySelectorAll(".chip")].forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.filter === state.filter);
  });
}

function renderStats() {
  const mastered = words.filter((word) => isMastered(cardOf(word.id))).length;
  const learning = words.filter((word) => statusOf(cardOf(word.id)) === "learning").length;
  const percent = words.length ? Math.round((mastered / words.length) * 100) : 0;
  const today = dayStat(state.progress);
  els.progressLabel.textContent = `掌握 ${percent}%`;
  els.streakLabel.textContent = `连续 ${state.progress.streak || 0} 天`;
  els.progressBar.style.width = `${percent}%`;
  els.progressTrack.setAttribute("aria-valuenow", String(percent));
  els.masteredCount.textContent = String(mastered);
  els.learningCount.textContent = String(learning);
  els.todayCount.textContent = String(today.r || 0);
  els.favoriteCount.textContent = String(state.progress.favorites.length);
  els.weekStreak.textContent = `连续 ${state.progress.streak || 0} 天`;
  const due = words.filter((word) => cardOf(word.id) && cardOf(word.id).due <= Date.now()).length;
  const fresh = state.mode === "today" ? state.queue.filter((word) => !cardOf(word.id)).length : 0;
  if (state.mode === "today") {
    els.queueLabel.textContent = due || fresh ? `复习 ${due} · 新词 ${fresh}` : "今日队列已完成";
    els.modeBtn.textContent = "浏览词库";
  } else {
    els.queueLabel.textContent = `浏览 ${state.queue.length} 个词`;
    els.modeBtn.textContent = "回到今日";
  }
}

function atlasOf(word) {
  const row = window.NGSL_ATLAS?.[word.word.toLowerCase()];
  if (!row) return null;
  return { id: row[0], uk: row[1] || "", us: row[2] || "", flags: row[3] || 0 };
}

function paintIllo(figure, img, initialEl, word, eager) {
  const atlas = atlasOf(word);
  const hue = HUES[Math.abs(hash(word.word)) % HUES.length];
  figure.style.setProperty("--hue", hue);
  initialEl.textContent = word.word.slice(0, 1).toUpperCase();
  const showImage = !!(atlas && atlas.flags & 1);
  figure.classList.remove("is-loaded");
  if (!showImage) {
    img.removeAttribute("src");
    figure.classList.add("is-fallback");
    return;
  }
  figure.classList.remove("is-fallback");
  const src = `./assets/thumb/${atlas.id}.webp`;
  img.alt = `${word.word} 插画`;
  img.loading = eager ? "eager" : "lazy";
  img.onload = () => figure.classList.add("is-loaded");
  img.onerror = () => {
    figure.classList.remove("is-loaded");
    figure.classList.add("is-fallback");
    img.removeAttribute("src");
  };
  if (img.getAttribute("src") !== src) img.src = src;
  if (img.complete && img.naturalWidth > 0) figure.classList.add("is-loaded");
}

function renderCard() {
  const word = currentWord();
  const empty = !word;
  els.studyEmpty.classList.toggle("hidden", !empty);
  els.cardFrame.classList.toggle("hidden", empty);
  els.gradeRow.classList.toggle("hidden", empty);
  if (!word) {
    const today = dayStat(state.progress);
    els.emptyCopy.textContent = `今天已评分 ${today.r || 0} 次，新认识 ${today.n || 0} 个词。到期的都会再出现。`;
    return;
  }
  const atlas = atlasOf(word);
  const status = statusOf(cardOf(word.id));
  const statusText = status === "mastered" ? "已掌握" : status === "learning" ? "学习中" : "未学";
  els.studyOrder.textContent = `#${word.id} · ${statusText}`;
  els.studyWord.textContent = word.word;
  els.studyWordBack.textContent = word.word;
  els.studyHint.textContent = "轻点查看释义和例句";
  els.flipBtn.setAttribute("aria-label", `查看 ${word.word} 的释义`);
  els.studyPos.textContent = word.partOfSpeech || "word";
  els.studyChinese.textContent = displayChinese(word.chinese);
  els.studyDefinition.textContent = word.definition || "暂无英文释义。";
  els.studyExample.textContent = word.example || "";
  els.studyExampleChinese.textContent = displayChinese(word.exampleChinese);
  const favorite = state.progress.favorites.includes(word.id);
  els.favoriteBtn.textContent = favorite ? "★" : "☆";
  els.favoriteBtn.classList.toggle("is-on", favorite);
  els.favoriteBtn.setAttribute("aria-pressed", String(favorite));
  els.favoriteBtn.setAttribute("aria-label", favorite ? "取消收藏" : "收藏单词");
  paintIllo(els.frontIllo, els.frontImg, els.frontInitial, word, true);
  paintIllo(els.backIllo, els.backImg, els.backInitial, word, false);
  renderIpa(word, atlas);
  const card = cardOf(word.id);
  const intervals = preview(card, Date.now(), 0.9, false);
  els.againIv.textContent = formatInterval(intervals[Rating.Again]);
  els.goodIv.textContent = formatInterval(intervals[Rating.Good]);
  els.memoryNote.textContent = card
    ? `${card.due <= Date.now() ? "现在可以复习" : `下次 ${formatInterval(card.due - Date.now())}后`} · 稳定度 ${card.s < 1 ? "<1" : Math.round(card.s)} 天 · 已复习 ${card.reps} 次`
    : "还没评过分。按 1 或 2 会开始安排复习，不会一次就标成已掌握。";
}

function renderIpa(word, atlas) {
  els.ipaRow.replaceChildren();
  const accent = state.progress.settings.accent === "uk" ? "uk" : "us";
  if (atlas && (atlas.uk || atlas.us)) {
    const items = [
      ["uk", "英", atlas.uk],
      ["us", "美", atlas.us],
    ].filter((item) => item[2]);
    for (const [key, label, ipa] of items) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `ipa-btn${key === accent ? " is-on" : ""}`;
      const em = document.createElement("em");
      em.textContent = label;
      const span = document.createElement("span");
      span.className = "ipa";
      span.textContent = ipa;
      button.append(em, span);
      button.addEventListener("click", () => {
        state.progress.settings.accent = key;
        save();
        render();
        speakCurrentWord();
      });
      els.ipaRow.append(button);
    }
    return;
  }
  const span = document.createElement("span");
  span.className = "ipa";
  span.textContent = word.pronunciation || "";
  els.ipaRow.append(span);
}

function displayChinese(text) {
  return seemsMojibake(text) ? "" : text;
}

function renderMe() {
  renderWeek();
  renderWordList(els.favoritesList, state.progress.favorites.map((id) => byId.get(id)), "还没有收藏");
  renderWordList(els.recentList, state.progress.recent.map((id) => byId.get(id)), "最近还没有学习记录");
}

function renderWeek() {
  els.weekList.replaceChildren();
  const today = localDate();
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const key = localDate(date);
    const count = state.progress.days[key]?.r || 0;
    const item = document.createElement("li");
    if (key === today) item.classList.add("is-today");
    const bar = document.createElement("span");
    const fill = document.createElement("i");
    fill.style.setProperty("--h", String(Math.min(1, count / 20)));
    bar.append(fill);
    const label = document.createElement("small");
    label.textContent = "日一二三四五六"[date.getDay()];
    item.title = `${key}：${count} 次评分`;
    item.append(bar, label);
    els.weekList.append(item);
  }
}

function renderWordList(container, entries, emptyText) {
  container.replaceChildren();
  const valid = entries.filter(Boolean).slice(0, 12);
  if (!valid.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = emptyText;
    container.append(empty);
    return;
  }
  for (const word of valid) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "word-item";
    button.addEventListener("click", () => openWord(word.id));
    const left = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = word.word;
    title.lang = "en";
    const meta = document.createElement("p");
    meta.className = "word-meta";
    meta.textContent = `${word.partOfSpeech || "word"} · ${labelStatus(statusOf(cardOf(word.id)))}`;
    left.append(title, meta);
    const right = document.createElement("span");
    right.className = "word-item-cn";
    right.textContent = displayChinese(word.chinese);
    button.append(left, right);
    container.append(button);
  }
}

function labelStatus(status) {
  if (status === "mastered") return "已掌握";
  if (status === "learning") return "学习中";
  return "未学";
}

function openWord(id) {
  switchPanel("study");
  state.mode = "browse";
  state.filter = "all";
  state.rank = "all";
  state.query = "";
  els.searchInput.value = "";
  syncChips();
  rebuildQueue(false);
  const index = state.queue.findIndex((word) => word.id === id);
  state.index = index >= 0 ? index : 0;
  resetFace();
  render();
  save();
}

function switchPanel(name, persist = true) {
  els.tabs.forEach((tab) => {
    const on = tab.dataset.target === name;
    tab.classList.toggle("active", on);
    tab.setAttribute("aria-current", on ? "page" : "false");
  });
  els.panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === name));
  if (name === "quiz" && !state.quiz) buildQuiz();
  if (persist) save();
}

function buildQuiz() {
  const pool = (state.mode === "browse" && state.queue.length ? state.queue : words).filter(
    (word) => glossKey(word.chinese) && !seemsMojibake(word.chinese)
  );
  const source = pool.length ? pool : words;
  const answer = source[Math.floor(Math.random() * source.length)];
  const distractors = pickDistractors(answer, words, 3);
  const options = shuffle([answer, ...distractors]);
  const duplicates = words.filter((word) => glossKey(word.chinese) === glossKey(answer.chinese)).length;
  state.quiz = { answerId: answer.id, answered: false };
  els.quizPrompt.textContent = duplicates > 1 ? `${answer.chinese}（${answer.partOfSpeech}）` : answer.chinese || answer.definition;
  els.quizFeedback.textContent = "";
  els.newQuizBtn.textContent = "换一题";
  els.quizOptions.replaceChildren();
  options.forEach((word, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quiz-option";
    const key = document.createElement("kbd");
    key.textContent = String(index + 1);
    const label = document.createElement("span");
    label.lang = "en";
    label.textContent = word.word;
    button.append(key, label);
    button.addEventListener("click", () => answerQuiz(button, word, answer));
    els.quizOptions.append(button);
  });
}

function answerQuiz(button, choice, answer) {
  if (state.quiz?.answered) return;
  state.quiz.answered = true;
  const correct = choice.id === answer.id;
  const now = Date.now();
  const prev = cardOf(answer.id);
  const next = review(prev, correct ? Rating.Good : Rating.Again, now, 0.9, true);
  state.progress.cards[String(answer.id)] = next;
  touchDay(state.progress, now, { n: prev ? 0 : 1, r: 1, c: correct ? 1 : 0 });
  rememberRecent(answer.id);
  [...els.quizOptions.querySelectorAll(".quiz-option")].forEach((item) => {
    item.disabled = true;
  });
  button.classList.add(correct ? "correct" : "wrong");
  const correctButton = [...els.quizOptions.querySelectorAll(".quiz-option")].find(
    (item) => item.querySelector("span")?.textContent === answer.word
  );
  if (correctButton) correctButton.classList.add("correct");
  const when = formatInterval(next.due - now);
  els.quizFeedback.textContent = correct
    ? `答对了：${answer.word}。下次大约 ${when}后。`
    : `正确答案是 ${answer.word}。下次大约 ${when}后再见。`;
  els.newQuizBtn.textContent = "下一题";
  save();
  renderStats();
  renderMe();
  speakWord(answer);
}

function exportProgress() {
  const payload = {
    app: "ngsl-study",
    version: 2,
    exported: new Date().toISOString(),
    progress: state.progress,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `ngsl-progress-${localDate()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  els.backupStatus.textContent = "已导出。文件只包含学习进度，不含词库。";
}

function importProgress() {
  const file = els.importFile.files?.[0];
  els.importFile.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      const progress = data && data.progress ? data.progress : data;
      if (!progress || typeof progress !== "object") throw new Error("empty");
      const ok = window.confirm("导入会覆盖这台设备上的学习进度。继续吗？");
      if (!ok) return;
      state.progress = migrateProgress(progress);
      save();
      restoreView();
      rebuildQueue(true);
      render();
      buildQuiz();
      els.backupStatus.textContent = `已导入 ${Object.keys(state.progress.cards).length} 条记忆记录。`;
    } catch {
      els.backupStatus.textContent = "这个文件不是可识别的进度 JSON。";
    }
  };
  reader.readAsText(file);
}

function resetProgress() {
  if (!window.confirm("确定清空收藏、连续天数和全部记忆进度吗？")) return;
  const settings = state.progress.settings;
  state.progress = migrateProgress(null);
  state.progress.settings = settings;
  state.mode = "today";
  state.filter = "all";
  state.rank = "all";
  state.query = "";
  els.searchInput.value = "";
  syncChips();
  save();
  rebuildQueue(true);
  render();
  buildQuiz();
  els.backupStatus.textContent = "进度已重置。";
}

function speakCurrentWord() {
  const word = currentWord();
  if (word) speakWord(word);
}

function speakCurrentExample() {
  const word = currentWord();
  if (word?.example) speakText(word.example, state.progress.settings.accent);
}

function speakWord(word) {
  const atlas = atlasOf(word);
  const accent = state.progress.settings.accent === "uk" ? "uk" : "us";
  const hasAudio = atlas && atlas.flags & (accent === "uk" ? 2 : 4);
  if (hasAudio) {
    playUrl(`./assets/audio/${accent}/${atlas.id}.mp3`).catch(() => speakText(word.word, accent));
    return;
  }
  speakText(word.word, accent);
}

function playUrl(url) {
  if (currentAudio) currentAudio.pause();
  const audio = new Audio(url);
  currentAudio = audio;
  return audio.play();
}

function speakText(text, accent) {
  if (!text || !window.speechSynthesis) return;
  if (currentAudio) currentAudio.pause();
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const lang = accent === "uk" ? "en-GB" : "en-US";
  utterance.lang = lang;
  utterance.rate = 0.92;
  const voices = window.speechSynthesis.getVoices();
  const wanted = lang.toLowerCase();
  const pool = voices.filter((voice) => (voice.lang || "").toLowerCase().replace("_", "-").startsWith(wanted.slice(0, 5).toLowerCase()) || (voice.lang || "").toLowerCase().startsWith(wanted.slice(0, 2)));
  const match = pool.filter((voice) => (voice.lang || "").toLowerCase().replace("_", "-") === wanted.toLowerCase());
  const list = match.length ? match : pool;
  const preferred =
    list.find((voice) => /natural|premium|enhanced|google/i.test(voice.name)) ||
    list.find((voice) => (accent === "uk" ? /daniel|serena|kate|arthur|martha/i : /samantha|aaron|nicky|ava|allison/i).test(voice.name)) ||
    list[0];
  if (preferred) {
    utterance.voice = preferred;
    utterance.lang = preferred.lang || lang;
  }
  window.speechSynthesis.speak(utterance);
}

function setupInstall() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  if (ios && !standalone && !localStorage.getItem("ngsl-ios-hint-dismissed")) {
    els.iosHint.classList.remove("hidden");
  }
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredPrompt = event;
    els.installBtn.classList.remove("hidden");
  });
  els.installBtn.addEventListener("click", async () => {
    if (!state.deferredPrompt) return;
    state.deferredPrompt.prompt();
    await state.deferredPrompt.userChoice;
    state.deferredPrompt = null;
    els.installBtn.classList.add("hidden");
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) window.location.reload();
    hadController = true;
  });
  navigator.serviceWorker.register("./sw.js").then((registration) => {
    if (registration.waiting && navigator.serviceWorker.controller) {
      registration.waiting.postMessage("SKIP_WAITING");
    }
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          worker.postMessage("SKIP_WAITING");
        }
      });
    });
  }).catch(() => {});
}

function shuffle(list) {
  const array = [...list];
  for (let index = array.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [array[index], array[swap]] = [array[swap], array[index]];
  }
  return array;
}

function hash(text) {
  let value = 0;
  for (const char of text) value = (value * 33 + char.charCodeAt(0)) >>> 0;
  return value;
}

const STORAGE_KEY = "ngsl-study-progress-v1";
const DAILY_DATE_KEY = "ngsl-study-today";

const rawWords = Array.isArray(window.NGSL_WORDS) ? window.NGSL_WORDS : [];
const words = rawWords.map((entry, index) => ({
  ...entry,
  chinese: sanitizeText(entry.chinese),
  exampleChinese: sanitizeText(entry.exampleChinese),
  definition: sanitizeText(entry.definition),
  example: sanitizeText(entry.example),
  partOfSpeech: sanitizeText(entry.partOfSpeech),
  pronunciation: sanitizeText(entry.pronunciation),
  initial: sanitizeText(entry.initial || entry.word?.[0] || ""),
  index,
}));

const state = {
  filteredWords: [...words],
  currentIndex: 0,
  currentFilter: "all",
  currentRank: "all",
  reviewMode: "normal",
  query: "",
  quiz: null,
  progress: loadProgress(),
  deferredPrompt: null,
};

const els = {
  heroWordCount: document.getElementById("heroWordCount"),
  heroSubtitle: document.getElementById("heroSubtitle"),
  progressLabel: document.getElementById("progressLabel"),
  streakCount: document.getElementById("streakCount"),
  progressBar: document.getElementById("progressBar"),
  masteredCount: document.getElementById("masteredCount"),
  todayCount: document.getElementById("todayCount"),
  favoriteCount: document.getElementById("favoriteCount"),
  searchInput: document.getElementById("searchInput"),
  rankChips: document.getElementById("rankChips"),
  filterChips: document.getElementById("filterChips"),
  tabs: [...document.querySelectorAll(".tab")],
  panels: [...document.querySelectorAll(".panel")],
  card: document.getElementById("flipCardBtn"),
  studyOrder: document.getElementById("studyOrder"),
  studyWord: document.getElementById("studyWord"),
  studyPronunciation: document.getElementById("studyPronunciation"),
  studyPronunciationBack: document.getElementById("studyPronunciationBack"),
  studyPos: document.getElementById("studyPos"),
  studyHint: document.getElementById("studyHint"),
  studyChinese: document.getElementById("studyChinese"),
  studyDefinition: document.getElementById("studyDefinition"),
  studyExample: document.getElementById("studyExample"),
  studyExampleChinese: document.getElementById("studyExampleChinese"),
  favoriteBtn: document.getElementById("favoriteBtn"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  shuffleBtn: document.getElementById("shuffleBtn"),
  speakBtn: document.getElementById("speakBtn"),
  speakExampleBtn: document.getElementById("speakExampleBtn"),
  mistakeModeBtn: document.getElementById("mistakeModeBtn"),
  hardBtn: document.getElementById("hardBtn"),
  goodBtn: document.getElementById("goodBtn"),
  quizPrompt: document.getElementById("quizPrompt"),
  quizOptions: document.getElementById("quizOptions"),
  quizFeedback: document.getElementById("quizFeedback"),
  newQuizBtn: document.getElementById("newQuizBtn"),
  favoritesList: document.getElementById("favoritesList"),
  recentList: document.getElementById("recentList"),
  resetProgressBtn: document.getElementById("resetProgressBtn"),
  installBtn: document.getElementById("installBtn"),
};

init();

function init() {
  bindEvents();
  restoreViewState();
  applyFilters();
  renderStats();
  renderCard();
  buildQuiz();
  renderReviewLists();
  registerServiceWorker();
}

function bindEvents() {
  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    applyFilters();
  });

  els.rankChips.addEventListener("click", (event) => {
    const button = event.target.closest("[data-rank]");
    if (!button) return;
    state.currentRank = button.dataset.rank;
    [...els.rankChips.querySelectorAll(".chip")].forEach((chip) => {
      chip.classList.toggle("active", chip === button);
    });
    applyFilters();
  });

  els.filterChips.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    state.currentFilter = button.dataset.filter;
    [...els.filterChips.querySelectorAll(".chip")].forEach((chip) => {
      chip.classList.toggle("active", chip === button);
    });
    applyFilters();
  });

  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchPanel(tab.dataset.target));
  });

  els.card.addEventListener("click", (event) => {
    if (event.target.closest("#favoriteBtn")) return;
    els.card.classList.toggle("is-flipped");
  });

  els.card.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    els.card.classList.toggle("is-flipped");
  });

  els.favoriteBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const word = getCurrentWord();
    if (!word) return;
    toggleFavorite(word.id);
  });

  els.prevBtn.addEventListener("click", () => stepCard(-1));
  els.nextBtn.addEventListener("click", () => stepCard(1));
  els.shuffleBtn.addEventListener("click", () => {
    if (!state.filteredWords.length) return;
    state.currentIndex = Math.floor(Math.random() * state.filteredWords.length);
    resetCardFace();
    renderCard();
  });
  els.speakBtn.addEventListener("click", speakCurrentWord);
  els.speakExampleBtn.addEventListener("click", speakCurrentExample);
  els.mistakeModeBtn.addEventListener("click", toggleMistakeMode);
  els.hardBtn.addEventListener("click", () => rateWord("learning"));
  els.goodBtn.addEventListener("click", () => rateWord("mastered"));

  els.newQuizBtn.addEventListener("click", buildQuiz);
  els.resetProgressBtn.addEventListener("click", resetProgress);

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

function sanitizeText(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\?$/g, "").trim();
}

function seemsMojibake(text) {
  if (!text) return false;
  return /[閸掓瑥娴犻弰閺堥幋閸︽径]/.test(text);
}

function loadProgress() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const today = new Date().toISOString().slice(0, 10);
    stored.status = stored.status || {};
    stored.favorites = stored.favorites || [];
    stored.recent = stored.recent || [];
    stored.todayDone = stored.todayDone || 0;
    stored.streak = stored.streak || 0;
    stored.lastStudyDate = stored.lastStudyDate || "";
    stored.lastWordId = stored.lastWordId || null;
    stored.lastFilter = stored.lastFilter || "all";
    stored.lastRank = stored.lastRank || "all";
    stored.lastReviewMode = stored.lastReviewMode || "normal";
    stored.lastQuery = stored.lastQuery || "";
    stored.lastPanel = stored.lastPanel || "study";
    if (stored[DAILY_DATE_KEY] !== today) {
      stored.todayDone = 0;
      stored[DAILY_DATE_KEY] = today;
    }
    return stored;
  } catch {
    return {
      status: {},
      favorites: [],
      recent: [],
      todayDone: 0,
      streak: 0,
      lastStudyDate: "",
      lastWordId: null,
      lastFilter: "all",
      lastRank: "all",
      lastReviewMode: "normal",
      lastQuery: "",
      lastPanel: "study",
      [DAILY_DATE_KEY]: new Date().toISOString().slice(0, 10),
    };
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function persistViewState() {
  const currentWord = getCurrentWord();
  if (currentWord) {
    state.progress.lastWordId = currentWord.id;
  }
  state.progress.lastFilter = state.currentFilter;
  state.progress.lastRank = state.currentRank;
  state.progress.lastReviewMode = state.reviewMode;
  state.progress.lastQuery = state.query;
  state.progress.lastPanel =
    els.panels.find((panel) => panel.classList.contains("active"))?.dataset.panel || "study";
  saveProgress();
}

function restoreViewState() {
  state.currentFilter = state.progress.lastFilter || "all";
  state.currentRank = state.progress.lastRank || "all";
  state.reviewMode = state.progress.lastReviewMode || "normal";
  state.query = state.progress.lastQuery || "";
  els.searchInput.value = state.query;

  [...els.filterChips.querySelectorAll(".chip")].forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.filter === state.currentFilter);
  });
  [...els.rankChips.querySelectorAll(".chip")].forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.rank === state.currentRank);
  });
  switchPanel(state.progress.lastPanel || "study");
}

function getStatus(id) {
  return state.progress.status[id] || "unseen";
}

function getCurrentWord() {
  return state.filteredWords[state.currentIndex] || null;
}

function applyFilters() {
  const query = state.query;
  const filtered = words.filter((word) => {
    const status = getStatus(word.id);
    const isFavorite = state.progress.favorites.includes(word.id);
    const matchesRank = inRankRange(word.id, state.currentRank);
    const matchesQuery =
      !query ||
      word.word.toLowerCase().includes(query) ||
      word.chinese.toLowerCase().includes(query) ||
      word.definition.toLowerCase().includes(query) ||
      word.partOfSpeech.toLowerCase().includes(query);

    if (!matchesQuery || !matchesRank) return false;
    if (state.currentFilter === "favorites") return isFavorite;
    if (state.currentFilter === "all") return true;
    return status === state.currentFilter;
  });

  state.filteredWords =
    state.reviewMode === "mistakes" ? sortWordsForMistakeMode(filtered) : filtered;

  const savedWordId = state.progress.lastWordId;
  if (savedWordId) {
    const savedIndex = state.filteredWords.findIndex((word) => word.id === savedWordId);
    if (savedIndex >= 0) {
      state.currentIndex = savedIndex;
    } else if (state.currentIndex >= state.filteredWords.length) {
      state.currentIndex = 0;
    }
  } else if (state.currentIndex >= state.filteredWords.length) {
    state.currentIndex = 0;
  }

  renderStats();
  renderCard();
}

function renderStats() {
  const mastered = words.filter((word) => getStatus(word.id) === "mastered").length;
  const favorites = state.progress.favorites.length;
  const progressPercent = Math.round((mastered / words.length) * 100);
  const learningCount = words.filter((word) => getStatus(word.id) === "learning").length;
  els.heroWordCount.textContent = `${words.length} 个核心词，随时开练`;
  els.heroSubtitle.textContent =
    state.filteredWords.length === words.length &&
    state.currentRank === "all" &&
    state.reviewMode === "normal"
      ? "闪卡、测验、收藏和复习进度都会自动保存在本机。"
      : state.reviewMode === "mistakes"
        ? `错词优先模式已开启，当前有 ${learningCount} 个学习中单词。`
        : `当前筛选结果 ${state.filteredWords.length} 个词。`;
  els.progressLabel.textContent = `掌握进度 ${progressPercent}%`;
  els.streakCount.textContent = `连续学习 ${state.progress.streak || 0} 天`;
  els.progressBar.style.width = `${progressPercent}%`;
  els.masteredCount.textContent = String(mastered);
  els.todayCount.textContent = String(state.progress.todayDone || 0);
  els.favoriteCount.textContent = String(favorites);
  els.mistakeModeBtn.classList.toggle("active-toggle", state.reviewMode === "mistakes");
  els.mistakeModeBtn.textContent =
    state.reviewMode === "mistakes" ? "错词优先中" : "错词优先";
}

function renderCard() {
  const word = getCurrentWord();
  if (!word) {
    els.studyOrder.textContent = "#0";
    els.studyWord.textContent = "没有匹配结果";
    els.studyPronunciation.textContent = "";
    els.studyPronunciationBack.textContent = "";
    els.studyPos.textContent = "";
    els.studyChinese.textContent = "";
    els.studyDefinition.textContent = "试试换个筛选条件或搜索关键词。";
    els.studyExample.textContent = "";
    els.studyExampleChinese.textContent = "";
    els.favoriteBtn.textContent = "☆";
    return;
  }

  state.progress.lastWordId = word.id;
  persistViewState();

  const favorite = state.progress.favorites.includes(word.id);
  els.studyOrder.textContent = `#${word.id}`;
  els.studyWord.textContent = word.word;
  els.studyPronunciation.textContent = word.pronunciation || "";
  els.studyPronunciationBack.textContent = word.pronunciation || "";
  els.studyPos.textContent = word.partOfSpeech || "word";
  els.studyHint.textContent =
    getStatus(word.id) === "mastered" ? "已标记为记住了" : "点击查看释义和例句";
  els.studyChinese.textContent = seemsMojibake(word.chinese) ? "" : word.chinese;
  els.studyDefinition.textContent = word.definition || "No definition available.";
  els.studyExample.textContent = word.example || "";
  els.studyExampleChinese.textContent = seemsMojibake(word.exampleChinese)
    ? ""
    : word.exampleChinese;
  els.favoriteBtn.textContent = favorite ? "★" : "☆";
}

function resetCardFace() {
  els.card.classList.remove("is-flipped");
}

function stepCard(direction) {
  if (!state.filteredWords.length) return;
  state.currentIndex =
    (state.currentIndex + direction + state.filteredWords.length) %
    state.filteredWords.length;
  resetCardFace();
  renderCard();
}

function rateWord(nextStatus) {
  const word = getCurrentWord();
  if (!word) return;
  const previousStatus = getStatus(word.id);
  state.progress.status[word.id] = nextStatus;
  rememberRecent(word.id);
  registerStudyActivity();
  if (previousStatus !== nextStatus) {
    state.progress.todayDone = (state.progress.todayDone || 0) + 1;
  }
  saveProgress();
  renderStats();
  renderReviewLists();
  stepCard(1);
}

function toggleFavorite(id) {
  const favorites = new Set(state.progress.favorites);
  if (favorites.has(id)) {
    favorites.delete(id);
  } else {
    favorites.add(id);
  }
  state.progress.favorites = [...favorites];
  rememberRecent(id);
  registerStudyActivity();
  saveProgress();
  renderStats();
  renderCard();
  renderReviewLists();
}

function rememberRecent(id) {
  const next = [id, ...state.progress.recent.filter((item) => item !== id)].slice(0, 20);
  state.progress.recent = next;
}

function buildQuiz() {
  const visibleWords = state.filteredWords.length ? state.filteredWords : words;
  const cleanVisibleWords = visibleWords.filter((word) => !seemsMojibake(word.chinese));
  const learningWords = cleanVisibleWords.filter((word) => getStatus(word.id) === "learning");
  const quizPool =
    state.reviewMode === "mistakes" && learningWords.length
      ? learningWords
      : cleanVisibleWords.length
        ? cleanVisibleWords
        : visibleWords;
  const answer = quizPool[Math.floor(Math.random() * quizPool.length)] || words[0];
  const distractors = shuffleArray(visibleWords.filter((word) => word.id !== answer.id))
    .slice(0, 3)
    .map((word) => word.word);
  const options = shuffleArray([answer.word, ...distractors]);
  state.quiz = { answerId: answer.id, options };

  els.quizPrompt.textContent = answer.chinese || answer.definition || answer.word;
  els.quizOptions.innerHTML = "";
  els.quizFeedback.textContent = "";

  options.forEach((option) => {
    const button = document.createElement("button");
    button.className = "quiz-option";
    button.type = "button";
    button.textContent = option;
    button.addEventListener("click", () => handleQuizAnswer(button, option, answer));
    els.quizOptions.appendChild(button);
  });
}

function handleQuizAnswer(button, choice, answer) {
  const buttons = [...els.quizOptions.querySelectorAll(".quiz-option")];
  buttons.forEach((item) => (item.disabled = true));
  const correct = choice === answer.word;
  registerStudyActivity();
  if (correct) {
    button.classList.add("correct");
    els.quizFeedback.textContent = `答对了：${answer.word}`;
    state.progress.status[answer.id] = "mastered";
  } else {
    button.classList.add("wrong");
    const target = buttons.find((item) => item.textContent === answer.word);
    if (target) target.classList.add("correct");
    els.quizFeedback.textContent = `正确答案是：${answer.word}`;
    state.progress.status[answer.id] = "learning";
  }
  rememberRecent(answer.id);
  state.progress.todayDone = (state.progress.todayDone || 0) + 1;
  saveProgress();
  renderStats();
  renderReviewLists();
}

function registerStudyActivity() {
  const today = new Date().toISOString().slice(0, 10);
  const last = state.progress.lastStudyDate;
  if (last === today) return;
  if (!last) {
    state.progress.streak = 1;
  } else {
    const diffDays = Math.round(
      (new Date(`${today}T00:00:00Z`) - new Date(`${last}T00:00:00Z`)) / 86400000
    );
    state.progress.streak = diffDays === 1 ? (state.progress.streak || 0) + 1 : 1;
  }
  state.progress.lastStudyDate = today;
}

function renderReviewLists() {
  renderWordList(
    els.favoritesList,
    state.progress.favorites.map(findWordById),
    "还没有收藏单词"
  );
  renderWordList(
    els.recentList,
    state.progress.recent.map(findWordById),
    "最近还没有学习记录"
  );
}

function renderWordList(container, entries, emptyText) {
  container.innerHTML = "";
  const validEntries = entries.filter(Boolean).slice(0, 12);
  if (!validEntries.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  validEntries.forEach((word) => {
    const item = document.createElement("button");
    item.className = "word-item";
    item.type = "button";
    item.addEventListener("click", () => {
      switchPanel("study");
      const index = state.filteredWords.findIndex((entry) => entry.id === word.id);
      if (index >= 0) {
        state.currentIndex = index;
      } else {
        state.currentFilter = "all";
        [...els.filterChips.querySelectorAll(".chip")].forEach((chip) => {
          chip.classList.toggle("active", chip.dataset.filter === "all");
        });
        applyFilters();
        state.currentIndex = state.filteredWords.findIndex((entry) => entry.id === word.id);
      }
      resetCardFace();
      renderCard();
    });

    const left = document.createElement("div");
    left.className = "word-item-main";
    const title = document.createElement("strong");
    title.textContent = word.word;
    const pronunciation = document.createElement("p");
    pronunciation.className = "word-pronunciation";
    pronunciation.textContent = word.pronunciation || "";
    const meta = document.createElement("p");
    meta.className = "word-meta";
    meta.textContent = `${word.partOfSpeech || "word"} | ${statusLabel(getStatus(word.id))}`;
    left.append(title, pronunciation, meta);

    const right = document.createElement("div");
    right.className = "word-item-side";

    const chinese = document.createElement("span");
    chinese.className = "word-item-cn";
    chinese.textContent = seemsMojibake(word.chinese) ? "" : word.chinese;

    const definition = document.createElement("span");
    definition.className = "word-item-definition";
    definition.textContent = word.definition || "";

    right.append(chinese, definition);
    item.append(left, right);
    container.appendChild(item);
  });
}

function statusLabel(status) {
  if (status === "mastered") return "已掌握";
  if (status === "learning") return "学习中";
  return "未学";
}

function switchPanel(name) {
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.target === name));
  els.panels.forEach((panel) =>
    panel.classList.toggle("active", panel.dataset.panel === name)
  );
  state.progress.lastPanel = name;
  saveProgress();
}

function toggleMistakeMode() {
  state.reviewMode = state.reviewMode === "mistakes" ? "normal" : "mistakes";
  state.currentIndex = 0;
  resetCardFace();
  applyFilters();
  buildQuiz();
  persistViewState();
}

function sortWordsForMistakeMode(entries) {
  const priority = {
    learning: 0,
    unseen: 1,
    mastered: 2,
  };
  return [...entries].sort((a, b) => {
    const diff = priority[getStatus(a.id)] - priority[getStatus(b.id)];
    if (diff !== 0) return diff;
    return a.id - b.id;
  });
}

function inRankRange(id, range) {
  if (range === "all") return true;
  const [start, end] = range.split("-").map(Number);
  return id >= start && id <= end;
}

function findWordById(id) {
  return words.find((word) => word.id === id);
}

function speakCurrentWord() {
  const word = getCurrentWord();
  if (!word || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word.word);
  applyPreferredVoice(utterance, "en-GB");
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}

function speakCurrentExample() {
  const word = getCurrentWord();
  if (!word || !word.example || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word.example);
  applyPreferredVoice(utterance, "en-GB");
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

function applyPreferredVoice(utterance, lang) {
  utterance.lang = lang;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return;

  const normalizedLang = lang.toLowerCase();
  const sameLangVoices = voices.filter((voice) =>
    voice.lang && voice.lang.toLowerCase().startsWith(normalizedLang.slice(0, 2))
  );
  const pool = sameLangVoices.length ? sameLangVoices : voices;

  const femaleHints = [
    "female",
    "woman",
    "samantha",
    "victoria",
    "karen",
    "serena",
    "moira",
    "tessa",
    "ava",
    "allison",
    "susan",
    "fiona",
    "rishi",
    "zira"
  ];

  const preferred =
    pool.find((voice) =>
      femaleHints.some((hint) => voice.name.toLowerCase().includes(hint))
    ) ||
    pool.find((voice) => /en-gb/i.test(voice.lang) && /samantha|serena|kate|fiona/i.test(voice.name)) ||
    pool.find((voice) => /en-us/i.test(voice.lang) && /ava|allison|samantha|victoria|zira/i.test(voice.name)) ||
    pool[0];

  if (preferred) {
    utterance.voice = preferred;
    utterance.lang = preferred.lang || lang;
  }
}

if ("speechSynthesis" in window) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

function resetProgress() {
  const confirmed = window.confirm("确定要清空收藏和学习进度吗？");
  if (!confirmed) return;
  localStorage.removeItem(STORAGE_KEY);
  state.progress = loadProgress();
  state.currentFilter = "all";
  state.currentRank = "all";
  state.reviewMode = "normal";
  state.query = "";
  els.searchInput.value = "";
  [...els.filterChips.querySelectorAll(".chip")].forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.filter === "all");
  });
  [...els.rankChips.querySelectorAll(".chip")].forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.rank === "all");
  });
  switchPanel("study");
  applyFilters();
  renderReviewLists();
  buildQuiz();
}

function shuffleArray(input) {
  const array = [...input];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

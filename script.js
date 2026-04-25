let lessons = [];

const lessonSelectCustom = document.getElementById("lessonSelectCustom");
const lessonSelectBtn = document.getElementById("lessonSelectBtn");
const lessonSelectValue = document.getElementById("lessonSelectValue");
const lessonSelectMenu = document.getElementById("lessonSelectMenu");
const wordGrid = document.getElementById("wordGrid");
const lessonInfo = document.getElementById("lessonInfo");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const shuffleBtn = document.getElementById("shuffleBtn");
const showLatin = document.getElementById("showLatin");
const showTranslation = document.getElementById("showTranslation");
const arabicSize = document.getElementById("arabicSize");
const arabicSizeValue = document.getElementById("arabicSizeValue");
const notesInfoBtn = document.getElementById("notesInfoBtn");
const notesTooltip = document.getElementById("notesTooltip");

const wordModal = document.getElementById("wordModal");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const modalSpeakBtn = document.getElementById("modalSpeakBtn");
const modalArabic = document.getElementById("modalArabic");
const modalLatin = document.getElementById("modalLatin");
const modalMeaning = document.getElementById("modalMeaning");

let currentLesson = 0;
let displayedItems = [];
let arabicVoice = null;
let fallbackAudio = null;
let activeModalCard = null;

const ARABIC_SIZE_DEFAULT = 32;
const SHOW_LATIN_STORAGE_KEY = "showLatinEnabled";
const SHOW_TRANSLATION_STORAGE_KEY = "showTranslationEnabled";

function getStoredToggleState(key, fallback = true) {
  const stored = localStorage.getItem(key);
  if (stored === null) {
    return fallback;
  }

  return stored === "true";
}

function initializeDisplayToggles() {
  if (showLatin) {
    showLatin.checked = getStoredToggleState(SHOW_LATIN_STORAGE_KEY, true);
  }

  if (showTranslation) {
    showTranslation.checked = getStoredToggleState(SHOW_TRANSLATION_STORAGE_KEY, true);
  }
}

function clampArabicSize(value) {
  if (!arabicSize) {
    return ARABIC_SIZE_DEFAULT;
  }

  const min = Number(arabicSize.min || 24);
  const max = Number(arabicSize.max || 40);
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return ARABIC_SIZE_DEFAULT;
  }

  return Math.min(max, Math.max(min, numericValue));
}

function applyArabicSize(value) {
  const sizePx = clampArabicSize(value);
  const cardRem = sizePx / 16;
  const modalRem = (sizePx * 1.5) / 16;
  document.documentElement.style.setProperty("--arabic-size", `${cardRem}rem`);
  document.documentElement.style.setProperty("--modal-arabic-size", `${modalRem}rem`);

  if (arabicSizeValue) {
    arabicSizeValue.textContent = `${sizePx}px`;
  }

  return sizePx;
}

function initializeArabicSizeSetting() {
  if (!arabicSize) {
    return;
  }

  const saved = localStorage.getItem("arabicSizePx");
  const selectedSize = applyArabicSize(saved || arabicSize.value || ARABIC_SIZE_DEFAULT);
  arabicSize.value = String(selectedSize);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isNonEmpty(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function normalizeValue(value) {
  if (Array.isArray(value)) {
    return value.filter(isNonEmpty).map((item) => String(item));
  }

  if (!isNonEmpty(value)) {
    return null;
  }

  return String(value);
}

function joinValues(values, separator = " • ") {
  return values.filter(isNonEmpty).map((value) => String(value)).join(separator);
}

function pickAt(items, index) {
  return Array.isArray(items) ? items[index] : undefined;
}

function buildAlphabetCards(section) {
  const arabicTokens = String(section.arabic || "")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const latinTokens = String(section.latin_reading || "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
  const translationTokens = String(section.translation || "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);

  return arabicTokens.map((arabic, index) =>
    toCard({
      arabic,
      latin: latinTokens[index],
      meaning: translationTokens[index],
      clickable: true,
    })
  );
}

function toCard({
  caption = "",
  arabic = "",
  latin = "",
  meaning = "",
  extra = "",
  clickable = true,
  fullWidth = false,
}) {
  return {
    caption: normalizeValue(caption),
    arabic: normalizeValue(arabic),
    latin: normalizeValue(latin),
    meaning: normalizeValue(meaning),
    extra: normalizeValue(extra),
    clickable,
    fullWidth,
  };
}

function zipCards(base, options = {}) {
  const count = Math.max(
    Array.isArray(base.arabic) ? base.arabic.length : 0,
    Array.isArray(base.latin) ? base.latin.length : 0,
    Array.isArray(base.meaning) ? base.meaning.length : 0,
    Array.isArray(base.extra) ? base.extra.length : 0,
    Array.isArray(base.caption) ? base.caption.length : 0
  );

  const cards = [];

  for (let index = 0; index < count; index += 1) {
    cards.push(
      toCard({
        caption: pickAt(base.caption, index) ?? options.caption,
        arabic: pickAt(base.arabic, index),
        latin: pickAt(base.latin, index),
        meaning: pickAt(base.meaning, index),
        extra: pickAt(base.extra, index),
        clickable: options.clickable ?? true,
        fullWidth: options.fullWidth ?? false,
      })
    );
  }

  return cards.filter((card) => card.arabic || card.latin || card.meaning || card.extra || card.caption);
}

function collectSectionCards(section) {
  const cards = [];

  if (section.section_id === 1 && isNonEmpty(section.arabic)) {
    cards.push(...buildAlphabetCards(section));
    return cards;
  }

  if (Array.isArray(section.subsections)) {
    section.subsections.forEach((subsection) => {
      cards.push(
        ...zipCards(
          {
            caption: subsection.topic,
            arabic: subsection.arabic_words,
            latin: subsection.latin_reading,
            meaning: subsection.translation,
          },
          { caption: subsection.topic }
        )
      );
    });
  }

  if (Array.isArray(section.arabic_words)) {
    cards.push(
      ...zipCards(
        {
          caption: section.letter_name || section.title,
          arabic: section.arabic_words,
          latin: section.latin_reading,
          meaning: section.translation,
        },
        { caption: section.title }
      )
    );
  }

  if (Array.isArray(section.word_pairs)) {
    cards.push(
      ...section.word_pairs.map((pair) =>
        toCard({
          caption: section.title,
          arabic: pair.arabic,
          latin: pair.latin,
          meaning: pair.translation,
          clickable: false,
          fullWidth: false,
        })
      )
    );
  }

  if (Array.isArray(section.tanwin_types)) {
    cards.push(
      ...section.tanwin_types.map((item) =>
        toCard({
          caption: item.name,
          arabic: item.symbol,
          latin: item.sound,
          meaning: item.name,
          clickable: false,
        })
      )
    );
  }

  if (Array.isArray(section.hamza_forms)) {
    cards.push(
      ...section.hamza_forms.map((item) =>
        toCard({
          caption: item.description,
          arabic: item.arabic,
          meaning: item.description,
          clickable: false,
        })
      )
    );
  }

  if (Array.isArray(section.letters)) {
    cards.push(
      ...section.letters.map((item) =>
        toCard({
          caption: item.example_suras || section.title,
          arabic: item.arabic,
          latin: item.latin,
          meaning: item.example_suras,
          clickable: false,
        })
      )
    );
  }

  if (Array.isArray(section.example_letters)) {
    cards.push(
      ...section.example_letters.map((item) =>
        toCard({
          caption: section.title,
          arabic: [item.arabic, item.with_fatha, item.with_kasra, item.with_damma].filter(isNonEmpty).join(" / "),
          meaning: item.description || section.title,
          clickable: false,
        })
      )
    );
  }

  if (section.verb_forms && Array.isArray(section.verb_forms.arabic_words)) {
    cards.push(
      ...zipCards(
        {
          caption: section.verb_forms.note || section.title,
          arabic: section.verb_forms.arabic_words,
          latin: section.verb_forms.latin_reading,
          meaning: section.verb_forms.translation,
        },
        { caption: section.verb_forms.note || section.title, clickable: false }
      )
    );
  }

  if (section["fa'ala_forms"] && Array.isArray(section["fa'ala_forms"].arabic_words)) {
    cards.push(
      ...zipCards(
        {
          caption: section["fa'ala_forms"].note || section.title,
          arabic: section["fa'ala_forms"].arabic_words,
          latin: section["fa'ala_forms"].latin_reading,
          meaning: section["fa'ala_forms"].translation,
        },
        { caption: section["fa'ala_forms"].note || section.title, clickable: false }
      )
    );
  }

  if (Array.isArray(section.suras_included)) {
    cards.push(
      ...section.suras_included.map((item) =>
        toCard({
          caption: `${item.number}. ${item.name}`,
          arabic: item.arabic,
          latin: item.latin,
          meaning: item.translation,
          clickable: false,
        })
      )
    );
  }

  if (Array.isArray(section.waqf_rules)) {
    cards.push(
      ...section.waqf_rules.map((rule) =>
        toCard({
          caption: "Waqf rule",
          meaning: rule,
          clickable: false,
          fullWidth: true,
        })
      )
    );
  }

  const hasDetailCards = cards.length > 0;

  if (!hasDetailCards) {
    const textFields = [
      ["Arabic", section.arabic],
      ["Latin reading", section.latin_reading],
      ["Translation", section.translation],
      ["Description", section.description],
      ["Note", section.note],
      ["Uzbek note", section.note_uzbek],
      ["English note", section.note_english],
      ["Content", section.content],
      ["Examples", section.examples],
      ["Pages", section.pages],
      ["Note (kasratan)", section.note_kasratan],
      ["Note (dammatan)", section.note_dammatan],
    ];

    textFields.forEach(([label, value]) => {
      if (isNonEmpty(value)) {
        cards.push(
          toCard({
            caption: label,
            meaning: value,
            clickable: false,
            fullWidth: true,
          })
        );
      }
    });
  }

  return cards;
}

function buildLessonMeta(section, book) {
  const sectionDetails = [
    section.page ? `Page ${section.page}` : null,
    section.pages ? `Pages ${section.pages}` : null,
    section.section_id ? `Section ${section.section_id}` : null,
    section.letter ? `Letter ${section.letter}` : null,
    section.letter_name ? section.letter_name : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const bookInfo = [book.source, book.description].filter(Boolean).join(" · ");
  const sectionNotes = [section.note, section.note_uzbek, section.note_english]
    .filter(Boolean)
    .map((note) => escapeHtml(note))
    .join("<br>");

  return `
    <div class="lesson-meta-block">
      <div class="lesson-meta-label">Book</div>
      <strong>${escapeHtml(book.title)}</strong>
      <div class="lesson-meta-text">${escapeHtml(bookInfo)}</div>
      ${book.note ? `<div class="lesson-meta-text">${escapeHtml(book.note)}</div>` : ""}
    </div>
    <div class="lesson-meta-block">
      <div class="lesson-meta-label">Current section</div>
      <strong>${escapeHtml(section.title)}</strong>
      <div class="lesson-meta-text">${escapeHtml(sectionDetails)}</div>
      ${sectionNotes ? `<div class="lesson-meta-text">${sectionNotes}</div>` : ""}
    </div>
  `;
}

function buildNotesTooltipText(section, book) {
  const englishNote = section?.note_english;
  return isNonEmpty(englishNote) ? String(englishNote).trim() : "";
}

function updateNotesTooltip(section) {
  if (!notesTooltip) {
    return;
  }

  const text = buildNotesTooltipText(section, bookData);
  notesTooltip.textContent = text;

  if (notesInfoBtn) {
    notesInfoBtn.hidden = !isNonEmpty(text);
  }
}

function renderSectionCards(cards) {
  displayedItems = cards;

  wordGrid.innerHTML = cards
    .map((card, index) => {
      const cardClasses = ["word-card"];

      if (card.fullWidth) {
        cardClasses.push("word-card--full");
      }

      const arabicHtml = card.arabic ? `<div class="arabic">${escapeHtml(card.arabic)}</div>` : "";
      const latinText = card.latin ? escapeHtml(card.latin) : "";
      const shouldBlurLatin = Boolean(showLatin) && !showLatin.checked && isNonEmpty(card.latin);
      const latinClassName = shouldBlurLatin ? "latin latin--blurred" : "latin";
      const latinHtml = `<div class="${latinClassName}">${latinText}</div>`;
      const shouldShowMeaning = !showTranslation || showTranslation.checked;
      const meaningHtml = shouldShowMeaning && card.meaning ? `<div class="meaning">${escapeHtml(card.meaning)}</div>` : "";
      const extraHtml = card.extra ? `<div class="card-extra">${escapeHtml(card.extra)}</div>` : "";

      return `
        <article
          class="${cardClasses.join(" ")}"
          data-card-index="${index}"
          tabindex="0" role="button" aria-label="Open details"
        >
          ${arabicHtml}
          ${latinHtml}
          ${meaningHtml}
          ${extraHtml}
        </article>
      `;
    })
    .join("");
}

function updateModalCardText(card) {
  if (!card) {
    return;
  }

  const latinText = card.latin || "";
  const shouldBlurLatin = Boolean(showLatin) && !showLatin.checked && isNonEmpty(latinText);

  modalLatin.textContent = latinText;
  modalLatin.classList.toggle("modal-latin--blurred", shouldBlurLatin);
  modalLatin.tabIndex = shouldBlurLatin ? 0 : -1;

  const shouldShowMeaning = !showTranslation || showTranslation.checked;
  modalMeaning.textContent = shouldShowMeaning ? joinValues([card.meaning, card.extra], " · ") : "";
}

function shuffleArray(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function canSpeakArabic() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

function pickArabicVoice() {
  if (!canSpeakArabic()) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  if (!Array.isArray(voices) || voices.length === 0) {
    return null;
  }

  return (
    voices.find((voice) => String(voice.lang || "").toLowerCase().startsWith("ar")) ||
    voices.find((voice) => /arabic|العربية/i.test(String(voice.name || ""))) ||
    null
  );
}

function updateArabicVoice() {
  arabicVoice = pickArabicVoice();
}

function updateSpeakButtonState(text) {
  if (!modalSpeakBtn) {
    return;
  }

  const disabled = !isNonEmpty(text);
  modalSpeakBtn.disabled = disabled;
}

function stopArabicPlayback() {
  if (canSpeakArabic()) {
    window.speechSynthesis.cancel();
  }

  if (fallbackAudio) {
    fallbackAudio.pause();
    fallbackAudio.currentTime = 0;
  }
}

function speakWithWebSpeech(text) {
  if (!canSpeakArabic()) {
    return false;
  }

  const phrase = String(text || "").trim();
  if (!phrase) {
    return false;
  }

  const utterance = new SpeechSynthesisUtterance(phrase);
  const selectedVoice = arabicVoice || pickArabicVoice();

  utterance.lang = selectedVoice?.lang || "ar-SA";

  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  utterance.rate = 0.85;
  utterance.pitch = 1;
  utterance.volume = 1;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);

  return true;
}

async function speakWithFallbackAudio(text) {
  const phrase = String(text || "").trim();
  if (!phrase) {
    return false;
  }

  try {
    if (!fallbackAudio) {
      fallbackAudio = new Audio();
    }

    fallbackAudio.src = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ar&q=${encodeURIComponent(phrase)}`;
    fallbackAudio.currentTime = 0;
    await fallbackAudio.play();
    return true;
  } catch (error) {
    console.warn("Fallback Arabic TTS failed", error);
    console.error("Error details:", error.message);
    return false;
  }
}

async function speakArabic(text) {
  const phrase = String(text || "").trim();
  if (!phrase) {
    return;
  }

  stopArabicPlayback();

  const selectedVoice = arabicVoice || pickArabicVoice();
  if (selectedVoice && speakWithWebSpeech(phrase)) {
    return;
  }

  const fallbackPlayed = await speakWithFallbackAudio(phrase);
  if (fallbackPlayed) {
    return;
  }

  speakWithWebSpeech(phrase);
}

function updateSelectLabel(index) {
  const section = lessons[index];
  if (!section) {
    lessonSelectValue.textContent = "Select lesson";
    return;
  }

  lessonSelectValue.textContent = `${section.section_id}. ${section.title}`;
}

function populateLessons() {
  lessonSelectMenu.innerHTML = lessons
    .map(
      (lesson, index) => `
        <li role="option" aria-selected="${index === currentLesson}">
          <button class="select-option ${index === currentLesson ? "active" : ""}" type="button" data-lesson-index="${index}">
            ${lesson.section_id}. ${escapeHtml(lesson.title)}
          </button>
        </li>
      `
    )
    .join("");
}

function renderLesson(index, customWords = null) {
  const section = lessons[index];
  if (!section) {
    wordGrid.innerHTML = "";
    lessonSelectValue.textContent = "Select lesson";
    updateNotesTooltip(null);
    return;
  }

  const cards = customWords ?? collectSectionCards(section);

  if (lessonInfo) {
    lessonInfo.innerHTML = buildLessonMeta(section, bookData);
  }
  updateNotesTooltip(section);
  renderSectionCards(cards);
  updateSelectLabel(index);
}

function openWordModal(card) {
  activeModalCard = card;
  modalArabic.textContent = card.arabic || card.caption || "";
  updateModalCardText(card);
  updateSpeakButtonState(card.arabic || card.caption || "");
  wordModal.classList.add("show");
  wordModal.setAttribute("aria-hidden", "false");
}

function closeWordModal() {
  stopArabicPlayback();
  activeModalCard = null;
  wordModal.classList.remove("show");
  wordModal.setAttribute("aria-hidden", "true");
}

let bookData = { title: "Arabic Reading Lessons", source: "", description: "", note: "" };

async function loadBookData() {
  if (typeof window !== "undefined" && window.__BOOK_DATA__) {
    return window.__BOOK_DATA__;
  }

  try {
    const response = await fetch("data.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load data.json (${response.status})`);
    }

    return await response.json();
  } catch (error) {
    console.error(error);
    return null;
  }
}

function normalizeSections(data) {
  return Array.isArray(data?.sections) ? data.sections : [];
}

function setFallbackMessage(message) {
  if (lessonInfo) {
    lessonInfo.innerHTML = `<strong>${escapeHtml(message)}</strong>`;
  }
  wordGrid.innerHTML = "";
  lessonSelectValue.textContent = message;
  updateNotesTooltip(null);
}

async function init() {
  const data = await loadBookData();

  if (!data) {
    setFallbackMessage("Unable to load data.json");
    return;
  }

  bookData = {
    title: data.title || "Arabic Reading Lessons",
    source: data.source || "",
    description: data.description || "",
    note: data.note || "",
  };

  lessons = normalizeSections(data);

  if (lessons.length === 0) {
    setFallbackMessage("No sections were found in data.json");
    return;
  }

  document.title = bookData.title;
  
  const savedLesson = localStorage.getItem("currentLesson");
  if (savedLesson !== null) {
    const parsed = Number(savedLesson);
    if (!isNaN(parsed) && parsed >= 0 && parsed < lessons.length) {
      currentLesson = parsed;
    }
  }

  populateLessons();
  renderLesson(currentLesson);
}

function toggleSelect(open = null) {
  const next = open === null ? !lessonSelectCustom.classList.contains("open") : open;
  lessonSelectCustom.classList.toggle("open", next);
  lessonSelectBtn.setAttribute("aria-expanded", String(next));
}

initializeDisplayToggles();

init();

initializeArabicSizeSetting();

updateArabicVoice();

if (canSpeakArabic()) {
  window.speechSynthesis.addEventListener("voiceschanged", updateArabicVoice);
}

updateSpeakButtonState("");

lessonSelectBtn.addEventListener("click", () => {
  toggleSelect();
});

lessonSelectMenu.addEventListener("click", (e) => {
  const optionBtn = e.target.closest(".select-option");
  if (!optionBtn) {
    return;
  }

  if (lessons.length === 0) {
    return;
  }

  currentLesson = Number(optionBtn.dataset.lessonIndex);
  localStorage.setItem("currentLesson", currentLesson);
  populateLessons();
  renderLesson(currentLesson);
  toggleSelect(false);
});

document.addEventListener("click", (e) => {
  if (!lessonSelectCustom.contains(e.target)) {
    toggleSelect(false);
  }
});

prevBtn.addEventListener("click", () => {
  if (lessons.length === 0) {
    return;
  }

  currentLesson = (currentLesson - 1 + lessons.length) % lessons.length;
  localStorage.setItem("currentLesson", currentLesson);
  populateLessons();
  renderLesson(currentLesson);
});

nextBtn.addEventListener("click", () => {
  if (lessons.length === 0) {
    return;
  }

  currentLesson = (currentLesson + 1) % lessons.length;
  localStorage.setItem("currentLesson", currentLesson);
  populateLessons();
  renderLesson(currentLesson);
});

shuffleBtn.addEventListener("click", () => {
  if (lessons.length === 0) {
    return;
  }

  const currentSection = lessons[currentLesson];
  const cards = collectSectionCards(currentSection);
  renderLesson(currentLesson, shuffleArray(cards));
});

showLatin.addEventListener("change", () => {
  localStorage.setItem(SHOW_LATIN_STORAGE_KEY, String(showLatin.checked));
  renderLesson(currentLesson);
  updateModalCardText(activeModalCard);
});

if (showTranslation) {
  showTranslation.addEventListener("change", () => {
    localStorage.setItem(SHOW_TRANSLATION_STORAGE_KEY, String(showTranslation.checked));
    renderLesson(currentLesson);
    updateModalCardText(activeModalCard);
  });
}

if (arabicSize) {
  arabicSize.addEventListener("input", () => {
    const selectedSize = applyArabicSize(arabicSize.value);
    localStorage.setItem("arabicSizePx", String(selectedSize));
  });
}

wordGrid.addEventListener("click", (e) => {
  const card = e.target.closest(".word-card");
  if (!card) {
    return;
  }

  const cardIndex = Number(card.dataset.cardIndex);
  const item = displayedItems[cardIndex];
  if (item) {
    openWordModal(item);
  }
});

wordGrid.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") {
    return;
  }

  const card = e.target.closest(".word-card");
  if (!card) {
    return;
  }

  e.preventDefault();
  const cardIndex = Number(card.dataset.cardIndex);
  const item = displayedItems[cardIndex];
  if (item) {
    openWordModal(item);
  }
});

wordModal.addEventListener("click", (e) => {
  if (e.target.dataset.closeModal === "true") {
    closeWordModal();
  }
});

modalCloseBtn.addEventListener("click", closeWordModal);

if (modalSpeakBtn) {
  modalSpeakBtn.addEventListener("click", async () => {
    await speakArabic(modalArabic.textContent);
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeWordModal();
  }
});

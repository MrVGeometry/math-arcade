import { questionKinds } from "./congruence.js";
import { renderFigure } from "./figure.js";
import { fetchQuestions, isValidQuestion } from "./questions.js";
import { initPage } from "./ui.js";

// Every game shares one question file. Edits are kept as a draft in this
// browser until exported.
const questionSets = [
  {
    file: "questions.json",
    label: "All games: triangle congruence",
  },
];

const listEl = document.getElementById("question-list");
const countEl = document.getElementById("count");
const statusEl = document.getElementById("save-status");
const generateCount = document.getElementById("generate-count");

let questions = [];
let currentSet = questionSets[0];

// A new key for the congruence set, so an old equation draft can't load
// over it.
function draftKey() {
  return `mathArcadeTeacherDraft:congruence:${currentSet.file}`;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function readDraft() {
  try {
    const raw = localStorage.getItem(draftKey());
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDraft() {
  try {
    localStorage.setItem(draftKey(), JSON.stringify(questions));
    setStatus("Draft saved in this browser. Export to publish.");
  } catch {
    setStatus("Couldn't save a draft here. Export before leaving.");
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(draftKey());
  } catch {
    // Nothing to clear.
  }
}

function rowFor(question, index) {
  const row = document.createElement("li");
  row.className = "q-row";
  row.innerHTML = `
    <span class="q-num">${index + 1}</span>
    <label>Question <input class="q-prompt" type="text"></label>
    <label>Answer <input class="q-answer" type="text"></label>
    <button class="btn small danger" type="button">Delete</button>`;

  const promptInput = row.querySelector(".q-prompt");
  const answerInput = row.querySelector(".q-answer");
  promptInput.value = question.prompt;
  answerInput.value = question.answer;
  row.classList.toggle("invalid", !isValidQuestion(question));
  if (question.figure) row.append(renderFigure(question.figure));

  const onEdit = () => {
    // Keep the figure and id. A changed answer drops the old alternative
    // answers, so they can't be marked right by mistake.
    const old = questions[index];
    questions[index] = {
      ...old,
      accept: answerInput.value === old.answer ? old.accept : [],
      answer: answerInput.value,
      prompt: promptInput.value,
    };
    row.classList.toggle("invalid", !isValidQuestion(questions[index]));
    saveDraft();
  };
  promptInput.addEventListener("input", onEdit);
  answerInput.addEventListener("input", onEdit);
  row.querySelector("button").addEventListener("click", () => {
    questions.splice(index, 1);
    saveDraft();
    render();
  });
  return row;
}

function render() {
  listEl.replaceChildren(...questions.map(rowFor));
  countEl.textContent = `${questions.length} questions`;
}

function addBlank() {
  questions.push({ answer: "", prompt: "" });
  saveDraft();
  render();
  listEl.lastElementChild?.querySelector("input").focus();
}

function generate() {
  const count = Math.min(Math.max(Number(generateCount.value) || 0, 1), 50);
  const kind = questionKinds[document.getElementById("generate-kind").value];
  for (let i = 0; i < count; i += 1) {
    questions.push({ id: `g${Date.now().toString(36)}${i}`, ...kind.make() });
  }
  saveDraft();
  render();
}

function exportFile() {
  const clean = questions
    .map((q) => ({
      ...q,
      answer: String(q.answer).trim(),
      prompt: q.prompt.trim(),
    }))
    .filter(isValidQuestion);
  if (clean.length === 0) {
    setStatus("Add at least one complete question before exporting.");
    return;
  }
  const body = `${JSON.stringify({ questions: clean, version: 2 }, null, 1)}\n`;
  const url = URL.createObjectURL(
    new Blob([body], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = currentSet.file;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  const skipped = questions.length - clean.length;
  setStatus(
    skipped
      ? `Exported ${clean.length}. Skipped ${skipped} incomplete.`
      : `Exported ${clean.length} questions.`,
  );
}

async function loadPublished() {
  questions = (await fetchQuestions(currentSet.file)).map((q) => ({
    ...q,
    answer: String(q.answer),
  }));
  render();
}

async function resetToPublished() {
  const ok = confirm("Throw away your draft and reload the published set?");
  if (!ok) return;
  clearDraft();
  await loadPublished();
  setStatus("Reloaded the published questions.");
}

async function openSet(set) {
  currentSet = set;
  document.querySelectorAll("[data-file]").forEach((el) => {
    el.textContent = set.file;
  });
  const draft = readDraft();
  if (Array.isArray(draft)) {
    questions = draft;
    render();
    setStatus("Loaded your unsaved draft from this browser.");
    return;
  }
  try {
    await loadPublished();
    setStatus("Showing the published questions.");
  } catch (error) {
    questions = [];
    render();
    setStatus(`Error: ${error.message}`);
  }
}

function buildSetPicker() {
  const select = document.getElementById("set");
  questionSets.forEach((set, i) => {
    select.append(new Option(set.label, String(i)));
  });
  select.addEventListener("change", () => {
    openSet(questionSets[Number(select.value)]);
  });
}

async function start() {
  if (!initPage({ teacher: true })) return;
  buildSetPicker();
  document.getElementById("add").addEventListener("click", addBlank);
  document.getElementById("generate").addEventListener("click", generate);
  document.getElementById("export").addEventListener("click", exportFile);
  document.getElementById("reset").addEventListener("click", resetToPublished);
  await openSet(currentSet);
}

start();

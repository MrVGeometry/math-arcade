import { fetchQuestions, isValidQuestion } from "./questions.js";
import { initPage } from "./ui.js";

// Each game reads its own question file. Edits are kept as a draft per file
// in this browser until exported.
const questionSets = [
  {
    file: "questions.json",
    generate: makeOneStep,
    kind: "1-step",
    label: "Tic-Tac-Toe: 1-step equations",
  },
  {
    file: "questions-two-step.json",
    generate: makeTwoStep,
    kind: "2-step",
    label: "Deus Draconis: 2-step equations",
  },
];

const listEl = document.getElementById("question-list");
const countEl = document.getElementById("count");
const statusEl = document.getElementById("save-status");
const generateCount = document.getElementById("generate-count");

let questions = [];
let currentSet = questionSets[0];

// The first set keeps the original key so existing drafts still load.
function draftKey() {
  const base = "mathArcadeTeacherDraft";
  return currentSet === questionSets[0] ? base : `${base}:${currentSet.file}`;
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

  const onEdit = () => {
    questions[index] = {
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

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// One-step equations with whole-number answers from 0 to 15.
function makeOneStep() {
  const x = randomInt(0, 15);
  const a = randomInt(2, 12);
  const forms = [
    () => `x + ${a} = ${x + a}`,
    () => `${a} + x = ${x + a}`,
    () => `x - ${a} = ${x - a}`,
    () => `${a}x = ${a * x}`,
    () => `x ÷ ${a} = ${x}`,
  ];
  const form = randomInt(0, forms.length - 1);
  // Division needs x to be a multiple of a, so solve for a*x instead.
  const answer = form === 4 ? a * x : x;
  return { answer: String(answer), prompt: `Solve for x: ${forms[form]()}` };
}

// Two-step equations with whole-number answers from 0 to 12.
function makeTwoStep() {
  const x = randomInt(0, 12);
  const a = randomInt(2, 9);
  const b = randomInt(1, 15);
  const forms = [
    () => `${a}x + ${b} = ${a * x + b}`,
    () => `${a}x - ${b} = ${a * x - b}`,
    () => `${b} + ${a}x = ${a * x + b}`,
    () => `x ÷ ${a} + ${b} = ${x + b}`,
  ];
  const form = randomInt(0, forms.length - 1);
  // Division needs x to be a multiple of a, so solve for a*x instead.
  const answer = form === 3 ? a * x : x;
  return { answer: String(answer), prompt: `Solve for x: ${forms[form]()}` };
}

function generate() {
  const count = Math.min(Math.max(Number(generateCount.value) || 0, 1), 50);
  for (let i = 0; i < count; i += 1) questions.push(currentSet.generate());
  saveDraft();
  render();
}

function exportFile() {
  const clean = questions
    .map((q) => ({ answer: String(q.answer).trim(), prompt: q.prompt.trim() }))
    .filter(isValidQuestion);
  if (clean.length === 0) {
    setStatus("Add at least one complete question before exporting.");
    return;
  }
  const body = `${JSON.stringify({ questions: clean, version: 1 }, null, 2)}\n`;
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
    answer: String(q.answer),
    prompt: q.prompt,
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
  document.getElementById("generate-kind").textContent = set.kind;
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

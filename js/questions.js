// Loads the question bank and runs the "answer to move" modal. Any game can
// call askQuestion() and await a true/false result.
import { renderFigure, renderMathText } from "./figure.js";
import { recordAttempt } from "./firebase.js";
import { play } from "./sound.js";

// Question banks keyed by file, each with its own shuffled deck.
const banks = new Map();
let dialog = null;

export function isValidQuestion(q) {
  return Boolean(
    q &&
      typeof q.prompt === "string" &&
      q.prompt.trim() &&
      String(q.answer ?? "").trim(),
  );
}

export async function fetchQuestions(source = "questions.json") {
  const response = await fetch(source, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Couldn't load questions (${response.status})`);
  }
  const data = await response.json();
  return (data.questions ?? []).filter(isValidQuestion);
}

export async function loadQuestions(source = "questions.json") {
  if (!banks.has(source)) {
    banks.set(source, { deck: [], pool: await fetchQuestions(source) });
  }
  const { pool } = banks.get(source);
  if (pool.length === 0) throw new Error("No questions available");
  return pool;
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

// Deals through the whole bank before repeating any question.
function nextQuestion(source) {
  const bank = banks.get(source);
  if (bank.deck.length === 0) bank.deck = shuffle([...bank.pool]);
  return bank.deck.pop();
}

// Accepts "7", "x = 7", "x=7", "-3", "1/2" and "0.5". For geometry it
// ignores case, spaces, the words triangle/angle/segment, the symbols
// △ ∠ ≅ < and bars over segment names, and dots in "S.A.S.".
function normalise(text) {
  const plain = String(text)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/triangle|angle|segment/g, "")
    .replace(/[△∠≅<[\]‾¯\u0305]/g, "")
    .replace(/^[a-z]=/, "")
    .replace(/−/g, "-");
  return /\d/.test(plain) ? plain : plain.replace(/\./g, "");
}

function toNumber(text) {
  const fraction = text.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  return text === "" ? NaN : Number(text);
}

export function isCorrect(expected, given) {
  const a = normalise(expected);
  const b = normalise(given);
  const numA = toNumber(a);
  const numB = toNumber(b);
  if (Number.isFinite(numA) && Number.isFinite(numB)) {
    return Math.abs(numA - numB) < 1e-9;
  }
  return a === b;
}

// True while a question is on screen, so the dialog can't be got rid of.
let answering = false;

function buildDialog() {
  dialog = document.createElement("dialog");
  dialog.className = "question";
  dialog.setAttribute("aria-labelledby", "question-prompt");
  // Browsers that support it ignore Esc and outside clicks entirely.
  dialog.setAttribute("closedby", "none");
  dialog.innerHTML = `
    <form>
      <p class="question-label"></p>
      <div class="question-figure"></div>
      <p class="question-prompt" id="question-prompt"></p>
      <label class="sr-only" for="question-input">Your answer</label>
      <input id="question-input" autocomplete="off" required>
      <p class="feedback" role="status" aria-live="polite"></p>
      <button class="btn" type="submit">Submit</button>
    </form>`;
  // No escaping out of a question to fish for an easier one. Chrome lets a
  // second Esc through even when cancel is blocked, so block the key too,
  // and if the dialog closes anyway, put it straight back.
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") event.preventDefault();
  });
  dialog.addEventListener("close", () => {
    if (!answering) return;
    dialog.showModal();
    dialog.querySelector("input").focus();
  });
  document.body.append(dialog);
}

// Shows one question in the open dialog and resolves true or false once the
// feedback has been on screen long enough to read.
function askOnce(label, source) {
  const question = nextQuestion(source);
  const form = dialog.querySelector("form");
  const input = dialog.querySelector("input");
  const submit = dialog.querySelector("button");
  const feedback = dialog.querySelector(".feedback");

  dialog.querySelector(".question-label").textContent = label;
  dialog
    .querySelector(".question-prompt")
    .replaceChildren(renderMathText(question.prompt));
  const figureEl = dialog.querySelector(".question-figure");
  figureEl.replaceChildren(
    ...(question.figure ? [renderFigure(question.figure)] : []),
  );
  dialog.classList.toggle("has-figure", Boolean(question.figure));
  input.value = "";
  input.disabled = false;
  submit.disabled = false;
  feedback.textContent = "";
  feedback.className = "feedback";
  input.focus();

  return new Promise((resolve) => {
    form.onsubmit = (event) => {
      event.preventDefault();
      const answers = [question.answer, ...(question.accept ?? [])];
      const correct = answers.some((a) => isCorrect(a, input.value));
      input.disabled = true;
      submit.disabled = true;
      feedback.replaceChildren(
        correct
          ? "Correct!"
          : renderMathText(
            `Nope! The answer is ${question.answer}. Try another one.`,
          ),
      );
      feedback.classList.add(correct ? "good" : "bad");
      play(correct ? "correct" : "wrong");
      recordAttempt({
        answer: question.answer,
        correct,
        given: input.value,
        id: question.id,
        prompt: question.prompt,
      });
      setTimeout(() => resolve(correct), correct ? 900 : 2600);
    };
  });
}

// Keeps asking new questions until one is answered correctly, so it always
// resolves true. The bank must be loaded with loadQuestions(source) first.
export async function askQuestion({
  label = "Solve it!",
  source = "questions.json",
} = {}) {
  if (!dialog) buildDialog();
  answering = true;
  dialog.showModal();
  let correct = await askOnce(label, source);
  while (!correct) {
    correct = await askOnce("Not quite. Try this one!", source);
  }
  answering = false;
  dialog.close();
  return true;
}

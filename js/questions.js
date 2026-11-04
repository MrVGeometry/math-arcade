// Loads the question bank and runs the "answer to move" modal. Any game can
// call askQuestion() and await a true/false result.
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

// Accepts "7", "x = 7", "x=7", "-3", "1/2" and "0.5".
function normalise(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/^[a-z]=/, "")
    .replace(/−/g, "-");
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

function buildDialog() {
  dialog = document.createElement("dialog");
  dialog.className = "question";
  dialog.setAttribute("aria-labelledby", "question-prompt");
  dialog.innerHTML = `
    <form>
      <p class="question-label"></p>
      <p class="question-prompt" id="question-prompt"></p>
      <label class="sr-only" for="question-input">Your answer</label>
      <input id="question-input" autocomplete="off" required>
      <p class="feedback" role="status" aria-live="polite"></p>
      <button class="btn" type="submit">Submit</button>
    </form>`;
  // No escaping out of a question to fish for an easier one.
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
  });
  document.body.append(dialog);
}

// The bank must be loaded with loadQuestions(source) first.
export function askQuestion({
  label = "Solve it!",
  source = "questions.json",
} = {}) {
  if (!dialog) buildDialog();
  const question = nextQuestion(source);
  const form = dialog.querySelector("form");
  const input = dialog.querySelector("input");
  const submit = dialog.querySelector("button");
  const feedback = dialog.querySelector(".feedback");

  dialog.querySelector(".question-label").textContent = label;
  dialog.querySelector(".question-prompt").textContent = question.prompt;
  input.value = "";
  input.disabled = false;
  submit.disabled = false;
  feedback.textContent = "";
  feedback.className = "feedback";
  dialog.showModal();
  input.focus();

  return new Promise((resolve) => {
    form.onsubmit = (event) => {
      event.preventDefault();
      const correct = isCorrect(question.answer, input.value);
      input.disabled = true;
      submit.disabled = true;
      feedback.textContent = correct
        ? "Correct!"
        : `Nope! The answer is ${question.answer}`;
      feedback.classList.add(correct ? "good" : "bad");
      play(correct ? "correct" : "wrong");
      setTimeout(
        () => {
          dialog.close();
          resolve(correct);
        },
        correct ? 900 : 2200,
      );
    };
  });
}

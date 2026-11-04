import { config } from "./config.js";
import { askQuestion, loadQuestions } from "./questions.js";
import { play } from "./sound.js";
import { initPage } from "./ui.js";

const human = "X";
const cpu = "O";
const lines = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const againButton = document.getElementById("again");
const scoreEls = {
  cpu: document.getElementById("score-cpu"),
  draw: document.getElementById("score-draw"),
  you: document.getElementById("score-you"),
};

const score = { cpu: 0, draw: 0, you: 0 };
let board = [];
let busy = false;
let over = false;
let winLine = [];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function setStatus(text) {
  statusEl.textContent = text;
}

function emptyCells(cells) {
  return cells.flatMap((mark, i) => (mark ? [] : [i]));
}

function winnerOf(cells) {
  const line = lines.find(
    ([a, b, c]) => cells[a] && cells[a] === cells[b] && cells[a] === cells[c],
  );
  return line ? { line, mark: cells[line[0]] } : null;
}

// Scores a position for the computer: positive is a CPU win, negative a
// player win. Quicker wins score higher.
function minimax(cells, turn, depth) {
  const win = winnerOf(cells);
  if (win) return win.mark === cpu ? 10 - depth : depth - 10;
  const open = emptyCells(cells);
  if (open.length === 0) return 0;
  const scores = open.map((i) => {
    cells[i] = turn;
    const value = minimax(cells, turn === cpu ? human : cpu, depth + 1);
    cells[i] = null;
    return value;
  });
  return turn === cpu ? Math.max(...scores) : Math.min(...scores);
}

function bestMoves(cells) {
  const scratch = [...cells];
  const scored = emptyCells(scratch).map((i) => {
    scratch[i] = cpu;
    const value = minimax(scratch, human, 1);
    scratch[i] = null;
    return { i, value };
  });
  const top = Math.max(...scored.map((m) => m.value));
  return scored.filter((m) => m.value === top).map((m) => m.i);
}

function chooseCpuMove() {
  const options =
    Math.random() < config.aiOptimalMoveChance
      ? bestMoves(board)
      : emptyCells(board);
  return options[Math.floor(Math.random() * options.length)];
}

function render() {
  [...boardEl.children].forEach((cell, i) => {
    const mark = board[i];
    cell.textContent = mark ?? "";
    cell.className = "cell";
    if (mark) cell.classList.add(mark.toLowerCase());
    if (winLine.includes(i)) cell.classList.add("win");
    cell.disabled = Boolean(mark) || busy || over;
    const row = Math.floor(i / 3) + 1;
    const col = (i % 3) + 1;
    cell.setAttribute(
      "aria-label",
      `Row ${row}, column ${col}: ${mark ?? "empty"}`,
    );
  });
  Object.entries(scoreEls).forEach(([key, el]) => {
    el.textContent = score[key];
  });
}

function endRound(result, message, sound) {
  over = true;
  score[result] += 1;
  setStatus(message);
  play(sound);
  againButton.hidden = false;
  againButton.focus();
}

// Returns true when the round is finished.
function checkEnd() {
  const win = winnerOf(board);
  if (win) {
    winLine = win.line;
    if (win.mark === human) endRound("you", "You win!", "win");
    else endRound("cpu", "CPU wins! Try again", "lose");
    return true;
  }
  if (emptyCells(board).length === 0) {
    endRound("draw", "It's a draw!", "draw");
    return true;
  }
  return false;
}

async function cpuTurn(prefix) {
  setStatus(`${prefix}CPU is thinking...`);
  render();
  await wait(650);
  board[chooseCpuMove()] = cpu;
  play("cpu");
  if (!checkEnd()) setStatus("Your move: pick a square");
}

async function onCellClick(index) {
  if (busy || over || board[index]) return;
  busy = true;
  render();

  const correct = await askQuestion({ label: "Solve to place your X" });
  if (correct) {
    board[index] = human;
    play("place");
  }
  if (!checkEnd()) await cpuTurn(correct ? "" : "Missed! ");

  busy = false;
  render();
}

function newRound() {
  board = Array(9).fill(null);
  over = false;
  winLine = [];
  againButton.hidden = true;
  setStatus("Your move: pick a square");
  render();
}

function buildBoard() {
  for (let i = 0; i < 9; i += 1) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";
    cell.addEventListener("click", () => onCellClick(i));
    boardEl.append(cell);
  }
}

async function start() {
  if (!initPage()) return;
  buildBoard();
  againButton.addEventListener("click", newRound);
  try {
    await loadQuestions();
    newRound();
  } catch (error) {
    board = Array(9).fill(null);
    over = true;
    render();
    setStatus(`Error: ${error.message}`);
  }
}

start();

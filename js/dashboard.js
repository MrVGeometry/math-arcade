// Teacher dashboard: class results, the questions students miss most, and a
// close-up of one student. Reads everything the students have saved.
import {
  collection,
  collectionGroup,
  getDocs,
  limit,
  orderBy,
  query,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getSession } from "./auth.js";
import { renderMathText } from "./figure.js";
import { auth, db, isTeacherUid } from "./firebase.js";
import { initRoster } from "./roster.js";

const classSelect = document.getElementById("class-filter");
const statusEl = document.getElementById("results-status");
const resultsBody = document.getElementById("results-body");
const strugglesBody = document.getElementById("struggles-body");
const detailPanel = document.getElementById("student-detail");
const printCards = document.getElementById("print-cards");

// Each student: { uid, username, pin, classCode, summary }.
let students = [];

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function row(values) {
  const tr = el("tr");
  values.forEach((value) => {
    tr.append(value instanceof Node ? wrapCell(value) : el("td", value));
  });
  return tr;
}

function wrapCell(node) {
  const td = el("td");
  td.append(node);
  return td;
}

function percent(right, total) {
  return total ? `${Math.round((100 * right) / total)}%` : "-";
}

function when(timestamp) {
  return timestamp
    ? timestamp.toDate().toLocaleString([], {
      dateStyle: "short",
      timeStyle: "short",
    })
    : "Never";
}

function inClass() {
  const code = classSelect.value;
  return code ? students.filter((s) => s.classCode === code) : students;
}

// Wins-draws-losses for tic-tac-toe, best score for the others.
function gameSummary(games = {}) {
  const ttt = games.tictactoe;
  return [
    ttt ? `${ttt.wins ?? 0}-${ttt.draws ?? 0}-${ttt.losses ?? 0}` : "-",
    games.draconis?.best ?? "-",
    games.astro?.best ?? "-",
  ];
}

function renderResults() {
  const rows = inClass().map((student) => {
    const { right = 0, wrong = 0, games, lastPlayed } = student.summary;
    const name = el("button", student.username, "link-btn");
    name.type = "button";
    name.addEventListener("click", () => showStudent(student));
    return row([
      name,
      student.pin,
      student.classCode,
      right + wrong,
      percent(right, right + wrong),
      ...gameSummary(games),
      when(lastPlayed),
    ]);
  });
  resultsBody.replaceChildren(...rows);
  statusEl.textContent = rows.length
    ? `${rows.length} students`
    : "No students yet. Make a login below.";
}

// Adds up every student's per-question totals and ranks by misses.
function renderStruggles() {
  const totals = new Map();
  inClass().forEach((student) => {
    Object.entries(student.summary.questions ?? {}).forEach(([key, q]) => {
      const t = totals.get(key) ?? { ...q, missedBy: 0, right: 0, wrong: 0 };
      t.right += q.right ?? 0;
      t.wrong += q.wrong ?? 0;
      if (q.wrong) t.missedBy += 1;
      totals.set(key, t);
    });
  });
  const worst = [...totals.values()]
    .filter((t) => t.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong || a.right - b.right)
    .slice(0, 15);
  strugglesBody.replaceChildren(
    ...worst.map((t) => {
      return row([
        renderMathText(t.prompt),
        renderMathText(t.answer),
        t.wrong,
        percent(t.right, t.right + t.wrong),
        t.missedBy,
      ]);
    }),
  );
  if (worst.length === 0) {
    strugglesBody.append(row(["No missed questions yet.", "", "", "", ""]));
  }
}

async function showStudent(student) {
  detailPanel.hidden = false;
  document.getElementById("detail-name").textContent = student.username;
  const missed = Object.values(student.summary.questions ?? {})
    .filter((q) => q.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong)
    .slice(0, 10);
  document.getElementById("detail-missed").replaceChildren(
    ...missed.map((q) => {
      return row([
        renderMathText(q.prompt),
        renderMathText(q.answer),
        q.lastWrong ?? "",
        q.wrong,
        q.right ?? 0,
      ]);
    }),
  );
  const recentBody = document.getElementById("detail-recent");
  recentBody.replaceChildren(row(["Loading...", "", "", "", ""]));
  detailPanel.scrollIntoView({ behavior: "smooth" });
  const snap = await getDocs(
    query(
      collection(db, "students", student.uid, "attempts"),
      orderBy("at", "desc"),
      limit(25),
    ),
  );
  recentBody.replaceChildren(
    ...snap.docs.map((d) => {
      const a = d.data();
      const mark = el("span", a.correct ? "Right" : "Wrong");
      mark.className = a.correct ? "good" : "bad";
      return row([when(a.at), a.game, renderMathText(a.prompt), a.given, mark]);
    }),
  );
}

function renderClassOptions() {
  const current = classSelect.value;
  const codes = [...new Set(students.map((s) => s.classCode))].sort();
  classSelect.replaceChildren(
    new Option("All periods", ""),
    ...codes.map((code) => new Option(code, code)),
  );
  classSelect.value = codes.includes(current) ? current : "";
}

function render() {
  renderResults();
  renderStruggles();
}

// Two reads in total: every student record, then every summary.
async function load() {
  statusEl.textContent = "Loading...";
  const [studentSnap, summarySnap] = await Promise.all([
    getDocs(collection(db, "students")),
    getDocs(collectionGroup(db, "summary")),
  ]);
  const summaries = new Map(
    summarySnap.docs.map((d) => [d.ref.parent.parent.id, d.data()]),
  );
  students = studentSnap.docs
    .map((d) => ({ ...d.data(), summary: summaries.get(d.id) ?? {}, uid: d.id }))
    .sort((a, b) => a.username.localeCompare(b.username));
  renderClassOptions();
  render();
}

function downloadCsv() {
  const lines = [
    "username,pin,period",
    ...inClass().map((s) => `${s.username},${s.pin},"${s.classCode}"`),
  ];
  const url = URL.createObjectURL(
    new Blob([`${lines.join("\n")}\n`], { type: "text/csv" }),
  );
  const link = el("a");
  link.href = url;
  link.download = `logins-${classSelect.value || "all"}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Cut-out cards with each student's login, one per student.
function printLogins() {
  printCards.replaceChildren(
    ...inClass().map((s) => {
      const card = el("div", undefined, "login-card");
      card.append(
        el("p", "MATH ARCADE"),
        el("p", `Username: ${s.username}`),
        el("p", `PIN: ${s.pin}`),
      );
      return card;
    }),
  );
  window.print();
}

function friendlyError(error) {
  return error.code === "permission-denied"
    ? "Permission denied. Check teacherUid in js/config.js and the Firestore rules."
    : `Couldn't load results: ${error.message}`;
}

async function start() {
  if (!getSession()?.teacher) return;
  await auth.authStateReady();
  if (!isTeacherUid(auth.currentUser?.uid)) return;
  classSelect.addEventListener("change", render);
  document.getElementById("results-refresh").addEventListener("click", () => {
    load().catch((error) => {
      statusEl.textContent = friendlyError(error);
    });
  });
  document.getElementById("roster-csv").addEventListener("click", downloadCsv);
  document.getElementById("roster-print").addEventListener("click", printLogins);
  initRoster({
    getTaken: () => new Set(students.map((s) => s.username)),
    onCreated: async (classCode) => {
      await load().catch(() => {});
      classSelect.value = classCode;
      render();
    },
  });
  try {
    await load();
  } catch (error) {
    statusEl.textContent = friendlyError(error);
  }
}

start();

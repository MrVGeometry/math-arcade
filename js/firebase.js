// Firebase setup shared by every page, plus the helpers that log students in
// and save their answers and scores.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  browserSessionPersistence,
  initializeAuth,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getFirestore,
  increment,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { config } from "./config.js";

export const app = initializeApp(config.firebase);
// Session persistence: closing the tab signs the student out, so the next
// student on a shared Chromebook can't play as them.
export const auth = initializeAuth(app, {
  persistence: browserSessionPersistence,
});
export const db = getFirestore(app);

// Firebase has no username + PIN login, so each username becomes an address
// on a reserved domain that never receives mail. The prefix lifts a 4-digit
// PIN over Firebase's 6-character minimum.
const studentDomain = "students.example.com";

export function studentEmail(username) {
  return `${username.trim().toLowerCase()}@${studentDomain}`;
}

export function pinPassword(pin) {
  return `pin-${String(pin).trim()}`;
}

export function isTeacherUid(uid) {
  return Boolean(uid) && uid === config.teacherUid;
}

// Anything with an @ is the teacher's email. Everything else is a student
// username. Resolves { teacher, username }, or throws with a friendly message.
export async function logIn(name, secret) {
  const isEmail = name.includes("@");
  const email = isEmail ? name.trim() : studentEmail(name);
  const password = isEmail ? secret : pinPassword(secret);
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    if (isEmail && !isTeacherUid(user.uid)) {
      await signOut(auth);
      throw Object.assign(new Error(), { code: "not-teacher" });
    }
    return {
      teacher: isEmail,
      username: isEmail ? "teacher" : name.trim().toLowerCase(),
    };
  } catch (error) {
    if (error.code === "not-teacher") {
      throw new Error(
        "That account isn't the teacher account. Check teacherUid in js/config.js.",
      );
    }
    const wrong = [
      "auth/invalid-credential",
      "auth/invalid-email",
      "auth/user-not-found",
      "auth/wrong-password",
    ];
    if (wrong.includes(error.code)) {
      throw new Error(
        isEmail ? "Wrong email or password." : "Wrong username or PIN.",
      );
    }
    if (error.code === "auth/too-many-requests") {
      throw new Error("Too many tries. Wait a minute and try again.");
    }
    throw new Error("Couldn't sign in. Check your connection.");
  }
}

export function logOut() {
  return signOut(auth);
}

// The game is named after its page, e.g. "tictactoe" or "astro". A game in
// its own folder (spireclash/index.html) is named after the folder.
function currentGame() {
  const parts = location.pathname.split("/");
  const page = parts.pop() || "index.html";
  if (page === "index.html" && parts.at(-1) === "spireclash") {
    return "spireclash";
  }
  return page.replace(/\.html$/, "") || "arcade";
}

// A short stable key for a question, so it can be a map key in the summary.
function questionKey(prompt) {
  let hash = 2166136261;
  for (const char of prompt) {
    hash = Math.imul(hash ^ char.codePointAt(0), 16777619) >>> 0;
  }
  return `q${hash.toString(36)}`;
}

// Only students save results. The teacher playing to test a game doesn't.
function studentUid() {
  const user = auth.currentUser;
  return user && !isTeacherUid(user.uid) ? user.uid : null;
}

function summaryRef(uid) {
  return doc(db, "students", uid, "summary", "all");
}

// Saves one answered question: a log entry with exactly what was typed, and
// running totals in the student's summary for the dashboard. Never throws,
// so a dropped connection can't break a game.
export async function recordAttempt({ answer, correct, given, id, prompt }) {
  const uid = studentUid();
  if (!uid) return;
  const game = currentGame();
  const right = increment(correct ? 1 : 0);
  const wrong = increment(correct ? 0 : 1);
  const question = { answer: String(answer), prompt, right, wrong };
  if (!correct) question.lastWrong = String(given).slice(0, 40);
  try {
    await Promise.all([
      addDoc(collection(db, "students", uid, "attempts"), {
        answer: String(answer),
        at: serverTimestamp(),
        correct,
        game,
        given: String(given).slice(0, 40),
        prompt,
      }),
      setDoc(
        summaryRef(uid),
        {
          games: { [game]: { right, wrong } },
          lastPlayed: serverTimestamp(),
          questions: { [id ? `id_${id}` : questionKey(prompt)]: question },
          right,
          wrong,
        },
        { merge: true },
      ),
    ]);
  } catch {
    // Offline or blocked: the game carries on without saving.
  }
}

// Saves the end of a game: one more play, a best score if it beat the old
// one, and a win/draw/loss count for games that have those.
export async function recordGameEnd({ result, score } = {}) {
  const uid = studentUid();
  if (!uid) return;
  const game = currentGame();
  try {
    const entry = { plays: increment(1) };
    if (result) entry[result] = increment(1);
    if (Number.isFinite(score)) {
      const snap = await getDoc(summaryRef(uid));
      const best = snap.data()?.games?.[game]?.best ?? -Infinity;
      if (score > best) entry.best = score;
    }
    await setDoc(
      summaryRef(uid),
      { games: { [game]: entry }, lastPlayed: serverTimestamp() },
      { merge: true },
    );
  } catch {
    // Offline or blocked: the game carries on without saving.
  }
}

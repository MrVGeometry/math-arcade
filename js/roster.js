// Makes student logins from the teacher page: adjective (starting with the
// class letter) + animal + number, with a random 4-digit PIN.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  inMemoryPersistence,
  initializeAuth,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  doc,
  serverTimestamp,
  setDoc,
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { config } from "./config.js";
import { db, pinPassword, studentEmail } from "./firebase.js";
import { adjectives, nouns } from "./words.js";

// Creating an account signs into it, so a second Firebase app does that
// work. The teacher stays signed in on the main one the whole time.
const rosterApp = initializeApp(config.firebase, "roster");
const rosterAuth = initializeAuth(rosterApp, {
  persistence: inMemoryPersistence,
});

function randomIndex(size) {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] % size;
}

function pick(list) {
  return list[randomIndex(list.length)];
}

function makePin() {
  return String(1000 + randomIndex(9000));
}

// Tries a few word pairs in case a name is already in use.
async function createOne({ classCode, letter, number, taken }) {
  for (let tries = 0; tries < 10; tries += 1) {
    const username = `${pick(adjectives[letter])}${pick(nouns)}${number}`;
    if (taken.has(username)) continue;
    taken.add(username);
    const pin = makePin();
    try {
      const { user } = await createUserWithEmailAndPassword(
        rosterAuth,
        studentEmail(username),
        pinPassword(pin),
      );
      await signOut(rosterAuth);
      // Written as the teacher. The rules only let the teacher do this, and
      // a student can't save anything until this record exists.
      await setDoc(doc(db, "students", user.uid), {
        classCode,
        createdAt: serverTimestamp(),
        pin,
        username,
      });
      return { classCode, pin, username };
    } catch (error) {
      if (error.code !== "auth/email-already-in-use") throw error;
    }
  }
  throw new Error(`No free username left for number ${number}.`);
}

// One at a time, because Firebase limits how fast accounts can be made.
async function createStudents({ count, onProgress, ...batch }) {
  const made = [];
  for (let i = 0; i < count; i += 1) {
    made.push(await createOne({ ...batch, number: batch.start + i }));
    onProgress(made.length);
  }
  return made;
}

function friendlyError(error) {
  if (error.code === "permission-denied") {
    return "Permission denied. Check teacherUid in js/config.js and the Firestore rules.";
  }
  if (error.code === "auth/too-many-requests") {
    return "Firebase paused account creation. Wait an hour, then make the rest.";
  }
  return error.message;
}

// Wires up the "Create student logins" panel. getTaken() returns the
// usernames already in use. onCreated() runs after each batch.
export function initRoster({ getTaken, onCreated }) {
  const letterEl = document.getElementById("roster-letter");
  const startEl = document.getElementById("roster-start");
  const countEl = document.getElementById("roster-count");
  const classEl = document.getElementById("roster-class");
  const button = document.getElementById("roster-create");
  const statusEl = document.getElementById("roster-status");

  button.addEventListener("click", async () => {
    const letter = letterEl.value.trim().toLowerCase();
    const start = Math.floor(Number(startEl.value));
    const count = Math.floor(Number(countEl.value));
    if (!adjectives[letter]) {
      statusEl.textContent = "Pick a letter from A to Z.";
      return;
    }
    if (!(start >= 0 && count >= 1 && count <= 60)) {
      statusEl.textContent = "Use a starting number of 0 or more and 1 to 60 students.";
      return;
    }
    const classCode = classEl.value.trim() || `${letter.toUpperCase()}${start}`;
    button.disabled = true;
    try {
      const made = await createStudents({
        classCode,
        count,
        letter,
        onProgress: (done) => {
          statusEl.textContent = `Making logins... ${done} of ${count}`;
        },
        start,
        taken: getTaken(),
      });
      statusEl.textContent = `Made ${made.length} logins for ${classCode}.`;
    } catch (error) {
      statusEl.textContent = friendlyError(error);
    } finally {
      button.disabled = false;
      await onCreated(classCode);
    }
  });
}

// Makes student logins from the teacher page, one at a time: an adjective
// starting with the chosen letter, an animal, and a two-digit number whose
// first digit is the class period (e.g. period 3 gives luckyotter37). Each
// student gets a random 4-digit PIN.
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

// Tries different word pairs and second digits until the name is free.
async function createStudent({ letter, period, taken }) {
  const classCode = `Period ${period}`;
  for (let tries = 0; tries < 20; tries += 1) {
    const number = `${period}${randomIndex(10)}`;
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
  throw new Error("Couldn't find a free username. Try a different letter.");
}

function friendlyError(error) {
  if (error.code === "permission-denied") {
    return "Permission denied. Check teacherUid in js/config.js and the Firestore rules.";
  }
  if (error.code === "auth/too-many-requests") {
    return "Firebase paused account creation. Wait a while, then try again.";
  }
  return error.message;
}

// Wires up the "Create a student login" panel. getTaken() returns the
// usernames already in use. onCreated() runs after each new student.
export function initRoster({ getTaken, onCreated }) {
  const letterEl = document.getElementById("roster-letter");
  const periodEl = document.getElementById("roster-period");
  const button = document.getElementById("roster-create");
  const statusEl = document.getElementById("roster-status");

  button.addEventListener("click", async () => {
    const letter = letterEl.value.trim().toLowerCase();
    const period = Number(periodEl.value);
    if (!adjectives[letter]) {
      statusEl.textContent = "Pick a letter from A to Z.";
      return;
    }
    if (!(Number.isInteger(period) && period >= 1 && period <= 8)) {
      statusEl.textContent = "Pick a period from 1 to 8.";
      return;
    }
    button.disabled = true;
    statusEl.textContent = "Making a login...";
    try {
      const student = await createStudent({ letter, period, taken: getTaken() });
      statusEl.textContent = `Made ${student.username} (PIN ${student.pin}) in ${student.classCode}.`;
      await onCreated(student.classCode);
    } catch (error) {
      statusEl.textContent = friendlyError(error);
    } finally {
      button.disabled = false;
    }
  });
}

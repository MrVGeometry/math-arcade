// One login box for everyone: students type a username and PIN, the teacher
// types their email and password.
import { getSession, startSession } from "./auth.js";
import { config } from "./config.js";
import { logIn } from "./firebase.js";

const form = document.getElementById("login");
const nameInput = document.getElementById("login-name");
const secretInput = document.getElementById("login-secret");
const secretLabel = document.getElementById("login-secret-label");
const submit = form.querySelector("button[type=submit]");
const guestButton = document.getElementById("guest-start");
const noteEl = document.getElementById("signin-note");

function enterArcade() {
  location.replace("arcade.html");
}

// An @ means the teacher, so the second box asks for a password instead of
// a PIN.
function matchSecretToName() {
  const isEmail = nameInput.value.includes("@");
  secretLabel.textContent = isEmail ? "Password" : "PIN";
  secretInput.inputMode = isEmail ? "text" : "numeric";
}

async function onSubmit(event) {
  event.preventDefault();
  submit.disabled = true;
  noteEl.textContent = "Signing in...";
  try {
    startSession(await logIn(nameInput.value, secretInput.value));
    enterArcade();
  } catch (error) {
    noteEl.textContent = error.message;
    secretInput.value = "";
    secretInput.focus();
    submit.disabled = false;
  }
}

if (getSession()) {
  enterArcade();
} else {
  nameInput.addEventListener("input", matchSecretToName);
  form.addEventListener("submit", onSubmit);
  // Guests never sign in to Firebase, so there's nowhere to save results.
  guestButton.hidden = !config.allowGuests;
  guestButton.addEventListener("click", () => {
    startSession({ guest: true, teacher: false, username: "guest" });
    enterArcade();
  });
}

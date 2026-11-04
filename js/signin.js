import { config } from "./config.js";
import { getSession, isLocalMachine, startSession } from "./auth.js";

const buttonEl = document.getElementById("google-button");
const devButton = document.getElementById("dev-start");
const noteEl = document.getElementById("signin-note");

function enterArcade() {
  location.replace("arcade.html");
}

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Reads the email out of Google's ID token in memory only, so it can be
// compared against the teacher hashes. It is never stored or sent anywhere.
function verifiedEmail(credential) {
  const part = credential.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  const json = new TextDecoder().decode(
    Uint8Array.from(atob(part), (c) => c.charCodeAt(0)),
  );
  const payload = JSON.parse(json);
  return payload.email_verified ? payload.email : null;
}

// Only accounts whose email is on the teacher list are teachers. While the
// list is empty, nobody is.
async function isTeacher(credential) {
  if (config.teacherEmailHashes.length === 0) return false;
  const email = verifiedEmail(credential);
  if (!email) return false;
  const hash = await sha256Hex(email.trim().toLowerCase());
  return config.teacherEmailHashes.includes(hash);
}

async function handleCredential(response) {
  try {
    startSession(await isTeacher(response.credential));
    enterArcade();
  } catch {
    noteEl.textContent = "Sign-in failed. Please try again.";
  }
}

function startGoogleSignIn() {
  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.onload = () => {
    google.accounts.id.initialize({
      callback: handleCredential,
      client_id: config.googleClientId,
    });
    google.accounts.id.renderButton(buttonEl, {
      shape: "rectangular",
      size: "large",
      text: "signin_with",
      theme: "filled_black",
    });
  };
  script.onerror = () => {
    noteEl.textContent = "Couldn't reach Google. Check your connection.";
  };
  document.head.append(script);
}

function startDevMode() {
  buttonEl.hidden = true;
  devButton.hidden = false;
  // Teacher access in dev mode only on this computer, for setting up. On
  // the live site, dev mode signs everyone in as a student.
  const local = isLocalMachine();
  noteEl.textContent = local
    ? "Dev mode: no Google client ID set in js/config.js yet. Teacher tools are on because this is your own computer."
    : "Dev mode: no Google client ID set in js/config.js yet.";
  devButton.addEventListener("click", () => {
    startSession(local);
    enterArcade();
  });
}

if (getSession()) {
  enterArcade();
} else if (config.googleClientId.startsWith("YOUR_")) {
  startDevMode();
} else {
  startGoogleSignIn();
}

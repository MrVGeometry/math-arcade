// The only thing kept after sign-in is this flag in sessionStorage. No name,
// email, picture or token from the Google account is stored. Closing the tab
// ends the session.
const sessionKey = "mathArcadeSession";

export function startSession(isTeacher) {
  sessionStorage.setItem(
    sessionKey,
    JSON.stringify({ teacher: Boolean(isTeacher) }),
  );
}

export function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(sessionKey));
  } catch {
    return null;
  }
}

export function requireSession({ teacher = false } = {}) {
  const session = getSession();
  if (!session) {
    location.replace("index.html");
    return null;
  }
  if (teacher && !session.teacher) {
    location.replace("arcade.html");
    return null;
  }
  return session;
}

// True when the site is running on this computer (a local server or an
// opened file), never on the live website.
export function isLocalMachine() {
  return (
    location.protocol === "file:" ||
    ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)
  );
}

export function endSession() {
  sessionStorage.removeItem(sessionKey);
  location.replace("index.html");
}

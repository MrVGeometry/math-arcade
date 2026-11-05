// The page guard reads this flag in sessionStorage. Firebase keeps its own
// sign-in in sessionStorage too, so closing the tab ends both.
import { config } from "./config.js";
import { auth, isTeacherUid, logOut } from "./firebase.js";

const sessionKey = "mathArcadeSession";

export function startSession({ guest = false, teacher, username }) {
  sessionStorage.setItem(
    sessionKey,
    JSON.stringify({ guest, teacher: Boolean(teacher), username }),
  );
}

export function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(sessionKey));
  } catch {
    return null;
  }
}

export async function endSession() {
  sessionStorage.removeItem(sessionKey);
  try {
    await logOut();
  } finally {
    location.replace("index.html");
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
  // Guests have no Firebase sign-in. Once guest play is switched off, any
  // guest still in a tab is sent back to the sign-in page.
  if (session.guest) {
    if (!config.allowGuests) endSession();
    return session;
  }
  // If the Firebase sign-in has gone (or the flag was hand-edited), start
  // over, so scores are never silently lost.
  auth.authStateReady().then(() => {
    const user = auth.currentUser;
    if (!user || (session.teacher && !isTeacherUid(user.uid))) endSession();
  });
  return session;
}

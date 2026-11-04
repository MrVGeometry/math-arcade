// Shared setup for every signed-in page: session guard and top bar buttons.
import { endSession, requireSession } from "./auth.js";
import { isMuted, toggleMute } from "./sound.js";

export function initPage(options) {
  const session = requireSession(options);
  if (!session) return null;

  document
    .querySelector("[data-signout]")
    ?.addEventListener("click", endSession);

  const teacherLink = document.querySelector("[data-teacher-link]");
  if (teacherLink) teacherLink.hidden = !session.teacher;

  const mute = document.querySelector("[data-mute]");
  if (mute) {
    const render = () => {
      mute.textContent = isMuted() ? "Sound: off" : "Sound: on";
    };
    render();
    mute.addEventListener("click", () => {
      toggleMute();
      render();
    });
  }

  return session;
}

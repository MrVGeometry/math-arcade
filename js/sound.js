// Tiny 8-bit sound effects generated with the Web Audio API.
const muteKey = "mathArcadeMuted";
let audio = null;

const tunes = {
  bounce: [[600, 0, 0.06, "triangle"]],
  correct: [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.18]],
  cpu: [[330, 0, 0.08]],
  draw: [[440, 0, 0.15], [440, 0.2, 0.15]],
  fire: [[620, 0, 0.05, "sawtooth"], [380, 0.05, 0.08, "sawtooth"]],
  hit: [[140, 0, 0.15, "sawtooth"], [90, 0.15, 0.4, "sawtooth"]],
  jump: [[300, 0, 0.06], [520, 0.05, 0.08]],
  kill: [[320, 0, 0.06], [160, 0.06, 0.12]],
  launch: [
    [200, 0, 0.2, "sawtooth"],
    [300, 0.2, 0.2, "sawtooth"],
    [450, 0.4, 0.4, "sawtooth"],
  ],
  lose: [[392, 0, 0.15], [311, 0.16, 0.15], [233, 0.32, 0.3]],
  place: [[880, 0, 0.08]],
  slam: [[120, 0, 0.1, "sawtooth"], [70, 0.08, 0.2, "sawtooth"]],
  slime: [[200, 0, 0.1, "triangle"], [270, 0.1, 0.12, "triangle"]],
  win: [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.1], [1047, 0.3, 0.3]],
  wrong: [[180, 0, 0.35, "sawtooth"]],
};

export function isMuted() {
  try {
    return localStorage.getItem(muteKey) === "1";
  } catch {
    return false;
  }
}

export function toggleMute() {
  const muted = !isMuted();
  try {
    localStorage.setItem(muteKey, muted ? "1" : "0");
  } catch {
    // Storage blocked: the toggle just won't be remembered.
  }
  return muted;
}

function tone(freq, start, duration, type = "square") {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  const at = audio.currentTime + start;
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.07, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start(at);
  osc.stop(at + duration);
}

export function play(name) {
  if (isMuted() || !tunes[name]) return;
  try {
    audio ??= new AudioContext();
    tunes[name].forEach(([freq, start, duration, type]) => {
      tone(freq, start, duration, type);
    });
  } catch {
    // No audio support: stay silent.
  }
}

// Deus Draconis: survive 90 seconds of monsters and slime. A two-step
// equation pops up every 30 seconds; answering it (right or wrong) gives a
// short shield, and a right answer also earns bonus points and full fire.
import { askQuestion, loadQuestions } from "../questions.js";
import { play } from "../sound.js";
import { recordGameEnd } from "../firebase.js";
import { initPage } from "../ui.js";
import {
  createFireball,
  createMonster,
  createSky,
  dragonBounds,
  dragonSpeed,
  dragonStart,
  height,
  overlaps,
  radius,
  roundSeconds,
  spawns,
  updateFireball,
  updateMonster,
  updateSky,
  updateSlime,
  width,
} from "./entities.js";
import { draw } from "./render.js";
import { buildSprites } from "./sprites.js";

const questionSource = "questions-two-step.json";
const questionEvery = 30;
const shieldSeconds = 2.5;
const bonusPoints = 10;
const maxAmmo = 3;
const ammoRefillSeconds = 2;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const sprites = buildSprites();
const keys = new Set();

const game = {
  clock: 0,
  deaths: 0,
  phase: "title",
  phaseTime: 0,
  round: null,
  score: 0,
  sky: createSky(),
  toast: null,
};

function newRound() {
  game.round = {
    ammo: maxAmmo,
    ammoClock: 0,
    dragon: { ...dragonStart },
    fireballs: [],
    invincibleFor: 0,
    monsters: [],
    nextQuestion: questionEvery,
    slimes: [],
    spawnIndex: 0,
    time: 0,
  };
  game.sky = createSky();
}

function setPhase(phase) {
  game.phase = phase;
  game.phaseTime = 0;
}

function showToast(text, colour) {
  game.toast = { colour, text, until: game.clock + 2.5 };
}

function startGame() {
  game.score = 0;
  game.deaths = 0;
  newRound();
  setPhase("playing");
}

function fire() {
  const { round } = game;
  if (round.ammo <= 0) return;
  round.ammo -= 1;
  round.fireballs.push(createFireball(round.dragon));
  play("fire");
}

// Input is "fire" (space), "enter" or "tap". Space never restarts from an
// end screen, so mashing fire can't skip past the final score.
function onAction(input) {
  if (game.phase === "playing" && input !== "enter") fire();
  if (game.phase === "title") startGame();
  const ended = game.phase === "over" || game.phase === "won";
  if (ended && input !== "fire" && game.phaseTime > 1.5) startGame();
}

function moveDragon(dx, dy) {
  const { dragon } = game.round;
  dragon.x = Math.min(Math.max(dragon.x + dx, dragonBounds.minX), dragonBounds.maxX);
  dragon.y = Math.min(Math.max(dragon.y + dy, dragonBounds.minY), dragonBounds.maxY);
}

function held(...names) {
  return names.some((name) => keys.has(name));
}

async function runQuestion() {
  setPhase("question");
  keys.clear();
  const correct = await askQuestion({
    label: "Answer to power up!",
    source: questionSource,
  });
  const { round } = game;
  round.nextQuestion += questionEvery;
  round.invincibleFor = shieldSeconds;
  if (correct) {
    game.score += bonusPoints;
    round.ammo = maxAmmo;
    showToast(`CORRECT! +${bonusPoints} & FULL FIRE`, "#39ff14");
  } else {
    showToast("SHIELD UP! NO BONUS", "#00e5ff");
  }
  setPhase("playing");
}

function loseLife() {
  play("hit");
  setPhase("dying");
}

function updateRound(dt) {
  const { round } = game;
  round.time += dt;
  round.invincibleFor = Math.max(0, round.invincibleFor - dt);

  const step = dragonSpeed * dt;
  const dx = (held("arrowright", "d") ? step : 0) - (held("arrowleft", "a") ? step : 0);
  const dy = (held("arrowdown", "s") ? step : 0) - (held("arrowup", "w") ? step : 0);
  moveDragon(dx, dy);

  round.ammoClock = round.ammo < maxAmmo ? round.ammoClock + dt : 0;
  if (round.ammoClock >= ammoRefillSeconds) {
    round.ammo += 1;
    round.ammoClock = 0;
  }

  while (spawns[round.spawnIndex]?.at <= round.time) {
    round.monsters.push(createMonster(spawns[round.spawnIndex].fromLeft));
    round.spawnIndex += 1;
  }

  round.monsters = round.monsters.filter((m) => updateMonster(m, dt, round));
  round.slimes = round.slimes.filter((s) => {
    const result = updateSlime(s, dt, round);
    if (result === "launch") play("slime");
    return Boolean(result);
  });
  round.fireballs = round.fireballs.filter((f) => {
    const target = round.monsters.find(
      (m) => m.alive && overlaps(m, radius.monster, f, radius.fireball),
    );
    if (!target) return updateFireball(f, dt);
    target.alive = false;
    game.score += 5;
    play("kill");
    return false;
  });
}

function checkHits() {
  const { dragon, invincibleFor, monsters, slimes } = game.round;
  if (invincibleFor > 0) return false;
  const byMonster = monsters.some(
    (m) => m.alive && overlaps(m, radius.monster, dragon, radius.dragon),
  );
  const bySlime = slimes.some(
    (s) => s.step && overlaps(s, radius.slime, dragon, radius.dragon),
  );
  return byMonster || bySlime;
}

function updatePlaying(dt) {
  updateRound(dt);
  if (checkHits()) {
    loseLife();
    return;
  }
  if (game.round.time >= roundSeconds) {
    setPhase("won");
    play("win");
    recordGameEnd({ result: "wins", score: game.score });
    return;
  }
  if (game.round.time >= game.round.nextQuestion) runQuestion();
}

function update(dt) {
  game.clock += dt;
  game.phaseTime += dt;
  if (game.phase !== "question") updateSky(game.sky, dt);
  if (game.phase === "playing") updatePlaying(dt);
  if (game.phase === "dying" && game.phaseTime > 1.2) {
    game.deaths += 1;
    if (game.deaths >= 3) {
      setPhase("over");
      play("lose");
      recordGameEnd({ result: "losses", score: game.score });
    } else {
      setPhase("ready");
    }
  }
  if (game.phase === "ready" && game.phaseTime > 2) {
    newRound();
    setPhase("playing");
  }
}

let last = performance.now();
function frame(now) {
  // Cap the step so a background tab doesn't teleport everything.
  update(Math.min((now - last) / 1000, 0.05));
  last = now;
  draw(ctx, sprites, game);
  requestAnimationFrame(frame);
}

const gameKeys = [
  "arrowup", "arrowdown", "arrowleft", "arrowright",
  "w", "a", "s", "d", " ", "enter",
];

function bindKeys() {
  window.addEventListener("keydown", (event) => {
    if (document.querySelector("dialog[open]")) return;
    const key = event.key.toLowerCase();
    if (!gameKeys.includes(key)) return;
    event.preventDefault();
    if (key === " " && !event.repeat) onAction("fire");
    if (key === "enter" && !event.repeat) onAction("enter");
    keys.add(key);
  });
  window.addEventListener("keyup", (event) => {
    keys.delete(event.key.toLowerCase());
  });
  window.addEventListener("blur", () => keys.clear());
}

// Drag anywhere to fly; a quick tap breathes fire (or starts the game).
function bindPointer() {
  let drag = null;
  const scale = () => width / canvas.getBoundingClientRect().width;
  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    drag = { moved: 0, x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const dx = (event.clientX - drag.x) * scale();
    const dy = (event.clientY - drag.y) * scale();
    drag.moved += Math.abs(dx) + Math.abs(dy);
    drag.x = event.clientX;
    drag.y = event.clientY;
    if (game.phase === "playing") moveDragon(dx, dy);
  });
  const end = () => {
    if (drag && drag.moved < 8) onAction("tap");
    drag = null;
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", () => {
    drag = null;
  });
}

async function start() {
  if (!initPage()) return;
  canvas.width = width;
  canvas.height = height;
  ctx.imageSmoothingEnabled = false;
  newRound();
  try {
    await Promise.all([
      loadQuestions(questionSource),
      document.fonts.load('10px "Press Start 2P"'),
    ]);
  } catch (error) {
    document.getElementById("load-error").textContent = `Error: ${error.message}`;
    return;
  }
  bindKeys();
  bindPointer();
  requestAnimationFrame(frame);
}

start();

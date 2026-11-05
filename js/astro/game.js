// Astro Stomp: a three-planet platformer. Jump, then press down to smash
// aliens. Running out of oxygen asks a 1-step equation: get it right to refill
// and carry on, or the stage restarts. The rocket at the end of each planet
// asks one more for a launch bonus.
import { askQuestion, loadQuestions } from "../questions.js";
import { play } from "../sound.js";
import { recordGameEnd } from "../firebase.js";
import { initPage } from "../ui.js";
import { loadArt, mirrorSheet } from "./art.js";
import { createEnemy, isStunned, updateEnemy } from "./enemies.js";
import { createInput } from "./input.js";
import { buildLevel, stages, tile } from "./levels.js";
import { overlaps, touchesLava } from "./physics.js";
import {
  bouncePlayer,
  createPlayer,
  hurtPlayer,
  maxHearts,
  placePlayer,
  updatePlayer,
} from "./player.js";
import { draw, viewHeight, viewWidth } from "./render.js";

const questionSource = "questions.json";
const launchBonus = 500;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const input = createInput(canvas, viewWidth);

const game = {
  clock: 0,
  hinted: false,
  input,
  phase: "title",
  phaseTime: 0,
  round: null,
  score: 0,
  stageIndex: 0,
  stageScore: 0,
  toast: null,
};

function newRound(index) {
  const stage = stages[index];
  const level = buildLevel(stage);
  game.stageIndex = index;
  game.stageScore = game.score;
  game.toast = null;
  game.round = {
    camera: 0,
    dust: [],
    enemies: stage.enemies.map(createEnemy),
    hearts: maxHearts,
    level,
    player: createPlayer(stage.start),
    rocket: { lift: 0, x: stage.rocket * tile + tile / 2, y: 10 * tile },
    shake: 0,
    stage,
  };
}

function setPhase(phase) {
  game.phase = phase;
  game.phaseTime = 0;
}

function showToast(text, colour = "#39ff14") {
  game.toast = { colour, text, until: game.clock + 2.5 };
}

function puff(x, y, colour, count = 10) {
  for (let i = 0; i < count; i += 1) {
    const max = 0.4 + Math.random() * 0.4;
    game.round.dust.push({
      colour,
      life: max,
      max,
      size: 4 + Math.floor(Math.random() * 3) * 2,
      vx: (Math.random() - 0.5) * 360,
      vy: -Math.random() * 260,
      x,
      y,
    });
  }
}

async function ask(label) {
  setPhase("question");
  input.clear();
  const correct = await askQuestion({ label, source: questionSource });
  input.clear();
  return correct;
}

async function outOfOxygen() {
  const correct = await ask("Out of oxygen! Solve it to refill");
  if (!correct) {
    game.score = game.stageScore;
    newRound(game.stageIndex);
    showToast("MISSION RESTART", "#ff2e88");
    setPhase("intro");
    return;
  }
  game.round.hearts = maxHearts;
  game.round.player.hurtFor = 2;
  showToast("OXYGEN REFILLED!");
  setPhase("playing");
}

async function launch() {
  const correct = await ask("Solve it to launch the rocket!");
  if (correct) {
    game.score += launchBonus;
    showToast(`PERFECT LAUNCH! +${launchBonus}`);
  } else {
    showToast("LAUNCHING ANYWAY!", "#00e5ff");
  }
  game.round.player.hidden = true;
  play("launch");
  setPhase("clear");
}

// Fell in a pit or lava (respawn on safe ground) or got hit by an alien.
function hurt(fromX, fell) {
  const { round } = game;
  const { player } = round;
  round.hearts -= 1;
  round.shake = 0.3;
  play("hit");
  if (fell) {
    placePlayer(player, player.safe);
    player.hurtFor = 1.4;
  } else {
    hurtPlayer(player, fromX);
  }
  if (round.hearts <= 0) outOfOxygen();
}

function hitEnemy(enemy) {
  const { player } = game.round;
  enemy.hp -= 1;
  bouncePlayer(player, true);
  game.round.shake = 0.2;
  if (enemy.hp > 0) {
    enemy.flash = 0.35;
    play("slam");
    showToast("ONE MORE SMASH!", "#ffd400");
    return;
  }
  enemy.dying = 0;
  game.score += enemy.def.points;
  puff(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, "#b6ff7a", 16);
  play("kill");
}

function touchEnemy(enemy) {
  const { player } = game.round;
  const feet = player.y + player.h;
  const onTop = player.vy > 0 && feet - enemy.y < Math.min(40, enemy.h / 2);
  if (player.smash || (isStunned(enemy) && onTop)) {
    hitEnemy(enemy);
    return;
  }
  if (onTop) {
    bouncePlayer(player, false);
    play("bounce");
    if (!game.hinted) showToast("PRESS DOWN IN THE AIR TO SMASH!", "#ffd400");
    game.hinted = true;
    return;
  }
  if (isStunned(enemy) || player.hurtFor > 0) return;
  hurt(enemy.x + enemy.w / 2, false);
}

function updateWorld(dt) {
  const { round } = game;
  const { level, player } = round;
  const events = updatePlayer(player, input, dt, level);
  if (events.includes("jump")) play("jump");
  if (events.includes("slam")) {
    round.shake = 0.25;
    puff(player.x + player.w / 2, player.y + player.h, "#d8c8b0", 12);
    play("slam");
  }
  round.enemies.forEach((enemy) => {
    if (updateEnemy(enemy, dt, level, player) !== "crash") return;
    round.shake = 0.3;
    puff(enemy.x + enemy.w / 2, enemy.y + enemy.h, "#d8c8b0", 14);
    play("slam");
  });
  round.enemies = round.enemies.filter((e) => {
    return !e.gone && !(e.dying > 0.45);
  });
  const target = round.enemies.find((e) => {
    return e.dying === undefined && overlaps(player, e);
  });
  if (target) touchEnemy(target);
  round.dust = round.dust.filter((d) => {
    d.life -= dt;
    d.vy += 900 * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    return d.life > 0;
  });
  round.shake = Math.max(0, round.shake - dt);
  const ideal = player.x + player.w / 2 - viewWidth * 0.4;
  const camera = Math.min(Math.max(ideal, 0), level.width - viewWidth);
  round.camera += (camera - round.camera) * Math.min(1, dt * 8);
}

function updatePlaying(dt) {
  updateWorld(dt);
  const { player, rocket, level } = game.round;
  if (game.phase !== "playing") return;
  const fell = player.y > level.height + 40 || touchesLava(player, level);
  if (fell) {
    hurt(player.x, true);
    return;
  }
  const atRocket = Math.abs(player.x + player.w / 2 - rocket.x) < 36;
  if (atRocket && player.onGround) launch();
}

function update(dt) {
  game.clock += dt;
  game.phaseTime += dt;
  const start = input.pressed("start");
  if (game.phase === "title" && start) setPhase("intro");
  if (game.phase === "intro" && game.phaseTime > 2) {
    setPhase("playing");
    if (game.stageIndex === 0 && !game.hinted) {
      showToast("JUMP, THEN PRESS DOWN TO SMASH!", "#ffd400");
    }
  }
  if (game.phase === "playing") updatePlaying(dt);
  if (game.phase === "clear") {
    game.round.rocket.lift += (120 + game.phaseTime * 500) * dt;
    game.round.shake = 0.1;
  }
  if (game.phase === "clear" && game.phaseTime > 2.6) {
    const next = game.stageIndex + 1;
    if (next < stages.length) {
      newRound(next);
      setPhase("intro");
    } else {
      play("win");
      setPhase("won");
      recordGameEnd({ result: "wins", score: game.score });
    }
  }
  if (game.phase === "won" && start && game.phaseTime > 1.5) {
    game.score = 0;
    newRound(0);
    setPhase("intro");
  }
}

function startLoop(art) {
  let last = performance.now();
  const frame = (now) => {
    // Cap the step so a background tab doesn't teleport everything.
    update(Math.min((now - last) / 1000, 0.05));
    input.endFrame();
    last = now;
    draw(ctx, art, game);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

async function start() {
  if (!initPage()) return;
  canvas.width = viewWidth;
  canvas.height = viewHeight;
  ctx.imageSmoothingEnabled = false;
  newRound(0);
  try {
    const [art] = await Promise.all([
      loadArt(stages.map((s) => s.palette)),
      loadQuestions(questionSource),
      document.fonts.load('16px "Press Start 2P"'),
    ]);
    art.mirrored = mirrorSheet(art.images.astronaut);
    startLoop(art);
  } catch (error) {
    document.getElementById("load-error").textContent = `Error: ${error.message}`;
  }
}

start();

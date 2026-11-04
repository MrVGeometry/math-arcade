// Drawing for Deus Draconis. Pure output: reads game state, never changes it.
import { cloudPosition, height, roundSeconds, width } from "./entities.js";

const font = '"Press Start 2P", monospace';
const skyBands = [
  "#3d7fd6", "#4a8be0", "#5797e6", "#64a3eb",
  "#72afef", "#80bbf2", "#8ec6f5", "#9dd1f8",
];

function drawCentred(ctx, sprite, x, y) {
  ctx.drawImage(sprite, Math.round(x - sprite.width / 2), Math.round(y - sprite.height / 2));
}

function text(ctx, value, x, y, { align = "left", colour = "#ffffff", size = 10 } = {}) {
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.fillStyle = "#000000";
  ctx.fillText(value, x + 2, y + 2);
  ctx.fillStyle = colour;
  ctx.fillText(value, x, y);
}

function drawSky(ctx, sprites, sky) {
  const band = height / skyBands.length;
  skyBands.forEach((colour, i) => {
    ctx.fillStyle = colour;
    ctx.fillRect(0, i * band, width, band + 1);
  });
  sky.clouds.forEach((cloud) => {
    const { x, y } = cloudPosition(cloud);
    drawCentred(ctx, sprites.cloud[cloud.lane.size], x, y);
  });
}

function drawDragon(ctx, sprites, game) {
  const { dragon, invincibleFor } = game.round;
  if (game.phase === "dying") {
    ctx.globalAlpha = Math.max(0, 1 - game.phaseTime / 1.2);
    drawCentred(ctx, sprites.dragonHit, dragon.x, dragon.y);
    ctx.globalAlpha = 1;
    return;
  }
  if (invincibleFor > 0) {
    ctx.strokeStyle = "#00e5ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(dragon.x - 28, dragon.y - 25, 56, 50);
  }
  // Blink while the post-question shield is up.
  if (invincibleFor > 0 && Math.floor(invincibleFor * 10) % 2 === 0) return;
  drawCentred(ctx, sprites.dragon, dragon.x, dragon.y);
}

function drawHud(ctx, sprites, game) {
  const { ammo, nextQuestion, time } = game.round;
  text(ctx, `TIME ${Math.floor(time)}/${roundSeconds}`, 10, 10);
  text(ctx, `SCORE ${game.score}`, 10, 26, { colour: "#ffd400" });
  if (nextQuestion < roundSeconds) {
    const wait = Math.max(0, Math.ceil(nextQuestion - time));
    text(ctx, `MATH IN ${wait}`, width - 10, 10, { align: "right", colour: "#ff2e88" });
  }
  for (let i = 0; i < 3 - game.deaths; i += 1) {
    ctx.drawImage(sprites.life, 8 + i * 36, height - 36);
  }
  for (let i = 0; i < ammo; i += 1) {
    ctx.drawImage(sprites.fireballIcon, width - 28 - i * 24, height - 28);
  }
}

function drawOverlay(ctx, game) {
  const screens = {
    over: ["GAME OVER", `FINAL SCORE ${game.score}`, "ENTER OR TAP TO RETRY"],
    ready: [
      "OUCH!",
      `${3 - game.deaths} ${3 - game.deaths === 1 ? "LIFE" : "LIVES"} LEFT`,
      "GET READY...",
    ],
    title: ["DEUS DRACONIS", "SURVIVE 90 SECONDS", "SPACE OR TAP TO START"],
    won: ["YOU SURVIVED!", `SCORE ${game.score}`, "ENTER OR TAP: PLAY AGAIN"],
  };
  const lines = screens[game.phase];
  if (!lines) return;
  ctx.fillStyle = "rgba(10, 10, 31, 0.72)";
  ctx.fillRect(0, 0, width, height);
  text(ctx, lines[0], width / 2, 120, { align: "center", colour: "#ff2e88", size: 20 });
  text(ctx, lines[1], width / 2, 170, { align: "center", colour: "#ffd400", size: 12 });
  if (game.phase === "ready" || Math.floor(game.clock * 2) % 2 === 0) {
    text(ctx, lines[2], width / 2, 220, { align: "center", size: 10 });
  }
}

export function draw(ctx, sprites, game) {
  const { fireballs, monsters, slimes } = game.round;
  drawSky(ctx, sprites, game.sky);
  slimes.filter((s) => s.step).forEach((s) => drawCentred(ctx, sprites.slime, s.x, s.y));
  fireballs.forEach((f) => drawCentred(ctx, sprites.fireball, f.x, f.y));
  monsters.forEach((m) => {
    ctx.globalAlpha = m.alive ? 1 : Math.max(0, 1 - m.fade);
    drawCentred(ctx, m.alive ? sprites.monster : sprites.monsterDead, m.x, m.y);
  });
  ctx.globalAlpha = 1;
  drawDragon(ctx, sprites, game);
  drawHud(ctx, sprites, game);
  if (game.toast && game.toast.until > game.clock) {
    text(ctx, game.toast.text, width / 2, 60, {
      align: "center",
      colour: game.toast.colour,
      size: 10,
    });
  }
  drawOverlay(ctx, game);
}

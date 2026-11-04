// Draws the world: background, tiles, rocket, aliens, astronaut and dust.
// Pure output: reads game state, never changes it.
import { astronautCell } from "./art.js";
import { isStunned } from "./enemies.js";
import { drawHud } from "./hud.js";
import { rows, tile } from "./levels.js";
import { playerFrame } from "./player.js";

export const viewWidth = 960;
export const viewHeight = 540;

function drawBackground(ctx, image, round) {
  const scale = viewHeight / image.height;
  const bgWidth = image.width * scale;
  const travel = Math.max(1, round.level.width - viewWidth);
  const x = -(round.camera / travel) * (bgWidth - viewWidth);
  ctx.drawImage(image, Math.round(x), 0, bgWidth, viewHeight);
}

function drawLava(ctx, x, y, clock) {
  const wave = Math.sin(clock * 3 + x / 40) * 3;
  ctx.fillStyle = "#b3200c";
  ctx.fillRect(x, y + 6 + wave, tile, tile);
  ctx.fillStyle = "#ff6a00";
  ctx.fillRect(x, y + 6 + wave, tile, 8);
  ctx.fillStyle = "#ffd23f";
  ctx.fillRect(x + ((clock * 30 + x) % tile), y + 8 + wave, 6, 3);
}

function drawTiles(ctx, art, round, clock) {
  const { grid } = round.level;
  const tiles = art.tiles[round.stage.palette];
  const first = Math.floor(round.camera / tile);
  const last = first + Math.ceil(viewWidth / tile) + 1;
  for (let row = 0; row < rows; row += 1) {
    for (let col = first; col <= last; col += 1) {
      const ch = grid[row][col];
      const x = col * tile - round.camera;
      const y = row * tile;
      if (ch === "#") {
        const open = row === 0 || grid[row - 1][col] !== "#";
        ctx.drawImage(open ? tiles.surface : tiles.solid, x, y);
      }
      if (ch === "=") ctx.drawImage(tiles.ledge, x, y);
      if (ch === "L") drawLava(ctx, x, y, clock);
    }
  }
}

function drawRocket(ctx, round, clock) {
  const { rocket } = round;
  const x = rocket.x - round.camera;
  const y = rocket.y - rocket.lift;
  if (rocket.lift > 0) {
    const flicker = 30 + Math.sin(clock * 40) * 10;
    ctx.fillStyle = "#ffd23f";
    ctx.fillRect(x - 10, y, 20, flicker + 20);
    ctx.fillStyle = "#ff6a00";
    ctx.fillRect(x - 6, y, 12, flicker + 34);
  }
  ctx.fillStyle = "#c0322b";
  ctx.fillRect(x - 34, y - 30, 16, 30);
  ctx.fillRect(x + 18, y - 30, 16, 30);
  ctx.fillStyle = "#e8e8f0";
  ctx.fillRect(x - 20, y - 110, 40, 104);
  ctx.fillStyle = "#c0322b";
  ctx.fillRect(x - 14, y - 128, 28, 18);
  ctx.fillRect(x - 6, y - 140, 12, 12);
  ctx.fillStyle = "#2a5db0";
  ctx.fillRect(x - 10, y - 90, 20, 20);
  ctx.fillStyle = "#9cd2ff";
  ctx.fillRect(x - 6, y - 86, 8, 8);
  ctx.fillStyle = "#8a8aa0";
  ctx.fillRect(x - 20, y - 10, 40, 6);
}

function drawStars(ctx, clock) {
  ctx.fillStyle = "#ffd23f";
  for (let i = 0; i < 3; i += 1) {
    const angle = clock * 5 + (i * Math.PI * 2) / 3;
    ctx.fillRect(Math.cos(angle) * 30 - 4, -44 + Math.sin(angle) * 8, 8, 8);
  }
}

function drawEnemy(ctx, art, enemy, round, clock) {
  const image = art.images[enemy.kind];
  const { def } = enemy;
  ctx.save();
  const anchorY = def.flies ? enemy.y + enemy.h / 2 : enemy.y + enemy.h;
  ctx.translate(Math.round(enemy.x + enemy.w / 2 - round.camera), anchorY);
  if (enemy.dying !== undefined) {
    ctx.globalAlpha = Math.max(0, 1 - enemy.dying / 0.45);
    ctx.scale(1 + enemy.dying, Math.max(0.1, 1 - enemy.dying * 2));
  }
  if (enemy.state === "windup") ctx.translate(Math.sin(clock * 60) * 4, 0);
  if (!def.flies) ctx.translate(0, -Math.abs(Math.sin(enemy.age * 7)) * 3);
  if (enemy.kind === "brain") {
    const glow = ctx.createRadialGradient(0, 0, 8, 0, 0, 60);
    glow.addColorStop(0, "rgba(120, 255, 170, 0.45)");
    glow.addColorStop(1, "rgba(120, 255, 170, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(-60, -60, 120, 120);
  }
  if (isStunned(enemy)) {
    drawStars(ctx, clock);
    ctx.rotate(Math.PI);
  }
  const flip = def.faces !== 0 && enemy.dir !== def.faces;
  const flap = enemy.kind === "fly" && !isStunned(enemy);
  ctx.scale(flip ? -1 : 1, flap ? 0.92 + Math.abs(Math.sin(clock * 18)) * 0.08 : 1);
  const top = def.flies ? -image.height / 2 : -image.height;
  ctx.drawImage(image, -image.width / 2, top);
  if (enemy.flash > 0) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.7;
    ctx.drawImage(image, -image.width / 2, top);
  }
  ctx.restore();
}

function drawPlayer(ctx, art, round, clock) {
  const { player } = round;
  if (round.player.hidden) return;
  const blink = player.hurtFor > 0 && Math.floor(clock * 12) % 2 === 0;
  if (blink) return;
  const { h, w } = astronautCell;
  const sheet = player.facing > 0 ? art.images.astronaut : art.mirrored;
  const frame = playerFrame(player);
  const sx = frame * w;
  const x = Math.round(player.x + player.w / 2 - w / 2 - round.camera);
  const y = Math.round(player.y + player.h - h);
  if (player.smash && player.smash.hang <= 0) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fillRect(x + 8, y - 40, 4, 34);
    ctx.fillRect(x + w - 12, y - 30, 4, 26);
  }
  ctx.drawImage(sheet, sx, 0, w, h, x, y, w, h);
}

function drawDust(ctx, round) {
  round.dust.forEach((d) => {
    ctx.globalAlpha = Math.max(0, d.life / d.max);
    ctx.fillStyle = d.colour;
    ctx.fillRect(Math.round(d.x - round.camera), Math.round(d.y), d.size, d.size);
  });
  ctx.globalAlpha = 1;
}

export function draw(ctx, art, game) {
  const { round } = game;
  ctx.save();
  if (round.shake > 0) {
    const s = round.shake * 30;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  drawBackground(ctx, art.images[round.stage.background], round);
  drawTiles(ctx, art, round, game.clock);
  drawRocket(ctx, round, game.clock);
  round.enemies.forEach((e) => drawEnemy(ctx, art, e, round, game.clock));
  drawPlayer(ctx, art, round, game.clock);
  drawDust(ctx, round);
  ctx.restore();
  drawHud(ctx, art, game);
}

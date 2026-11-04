// Tile collision for Astro Stomp. Bodies are axis-aligned boxes: x and y are
// the top-left corner, w and h the size, vx and vy the velocity in px/s.
import { tile, tileAt } from "./levels.js";

export const gravity = 2200;
const maxStep = 18;

const isSolid = (ch) => ch === "#";
const isFloor = (ch) => ch === "#" || ch === "=";

function moveX(body, dx, level) {
  body.x += dx;
  if (dx === 0) return;
  const edge = dx > 0 ? body.x + body.w - 0.01 : body.x;
  const col = Math.floor(edge / tile);
  const top = Math.floor(body.y / tile);
  const bottom = Math.floor((body.y + body.h - 0.01) / tile);
  for (let row = top; row <= bottom; row += 1) {
    if (isSolid(tileAt(level, col, row))) {
      body.x = dx > 0 ? col * tile - body.w : (col + 1) * tile;
      body.hitWall = Math.sign(dx);
      body.vx = 0;
      return;
    }
  }
}

function moveY(body, dy, level) {
  const oldBottom = body.y + body.h;
  body.y += dy;
  const left = Math.floor(body.x / tile);
  const right = Math.floor((body.x + body.w - 0.01) / tile);
  if (dy > 0) {
    const row = Math.floor((body.y + body.h) / tile);
    for (let col = left; col <= right; col += 1) {
      const ch = tileAt(level, col, row);
      // One-way platforms only catch bodies that were above them.
      const catches = isSolid(ch) || (ch === "=" && oldBottom <= row * tile + 0.5);
      if (catches) {
        body.y = row * tile - body.h;
        body.vy = 0;
        body.onGround = true;
        return;
      }
    }
  }
  if (dy < 0) {
    const row = Math.floor(body.y / tile);
    for (let col = left; col <= right; col += 1) {
      if (isSolid(tileAt(level, col, row))) {
        body.y = (row + 1) * tile;
        body.vy = 0;
        return;
      }
    }
  }
}

// Moves a body through the level in small steps so fast falls can't tunnel.
export function moveBody(body, dt, level, fall = gravity) {
  body.vy += fall * dt;
  body.hitWall = 0;
  body.onGround = false;
  const distance = Math.max(Math.abs(body.vx), Math.abs(body.vy)) * dt;
  const steps = Math.max(1, Math.ceil(distance / maxStep));
  for (let i = 0; i < steps; i += 1) {
    moveX(body, (body.vx * dt) / steps, level);
    moveY(body, (body.vy * dt) / steps, level);
    if (body.onGround) {
      moveX(body, (body.vx * dt * (steps - i - 1)) / steps, level);
      break;
    }
  }
}

// True when there is floor just ahead of a walker's leading foot.
export function floorAhead(body, dir, level) {
  const x = dir > 0 ? body.x + body.w + 2 : body.x - 2;
  const row = Math.floor((body.y + body.h + 2) / tile);
  return isFloor(tileAt(level, Math.floor(x / tile), row));
}

// True when both feet are on solid ground (a safe place to respawn).
export function standingSafely(body, level) {
  const row = Math.floor((body.y + body.h + 2) / tile);
  const left = tileAt(level, Math.floor((body.x - tile) / tile), row);
  const right = tileAt(level, Math.floor((body.x + body.w + tile) / tile), row);
  return body.onGround && isFloor(left) && isFloor(right);
}

export function touchesLava(body, level) {
  const row = Math.floor((body.y + body.h - 4) / tile);
  const left = Math.floor(body.x / tile);
  const right = Math.floor((body.x + body.w) / tile);
  for (let col = left; col <= right; col += 1) {
    if (tileAt(level, col, row) === "L") return true;
  }
  return false;
}

export function overlaps(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

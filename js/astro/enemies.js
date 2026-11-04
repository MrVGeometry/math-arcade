// The aliens of Astro Stomp and how each one moves.
import { tile } from "./levels.js";
import { floorAhead, moveBody } from "./physics.js";

// Faces is the way the artwork looks (1 right, -1 left, 0 straight on).
export const kinds = {
  blade: { faces: -1, h: 90, hp: 1, move: walk, points: 150, speed: 115, w: 44 },
  brain: { faces: 0, flies: true, h: 54, hp: 1, move: hover, points: 200, w: 52 },
  brute: { faces: 1, h: 96, hp: 2, move: walk, points: 300, speed: 45, w: 70 },
  fly: { faces: 0, flies: true, h: 58, hp: 1, move: dive, points: 200, w: 58 },
  ravager: { faces: -1, h: 82, hp: 1, move: charge, points: 200, speed: 60, w: 70 },
  stalker: { faces: 1, h: 90, hp: 1, move: walk, points: 100, speed: 70, w: 48 },
};

const hoverLeash = 450;
const hoverSpeed = { x: 85, y: 120 };
const stunSeconds = 3.2;

export function createEnemy([kind, col, row = 9]) {
  const def = kinds[kind];
  const x = col * tile + tile / 2 - def.w / 2;
  const y = (row + 1) * tile - def.h;
  return {
    age: Math.random() * 10,
    def,
    dir: -1,
    flash: 0,
    h: def.h,
    home: { x, y },
    hp: def.hp,
    kind,
    state: "patrol",
    timer: 0,
    vx: 0,
    vy: 0,
    w: def.w,
    x,
    y,
  };
}

const centreX = (body) => body.x + body.w / 2;

// Back and forth, turning at walls and ledges.
function walk(enemy, dt, level) {
  enemy.vx = enemy.dir * enemy.def.speed;
  moveBody(enemy, dt, level);
  const ledge = enemy.onGround && !floorAhead(enemy, enemy.dir, level);
  if (enemy.hitWall || ledge) enemy.dir = -enemy.dir;
}

// Walks, but rushes at the player after a short wind-up when they're close.
function charge(enemy, dt, level, player) {
  enemy.timer -= dt;
  const dx = centreX(player) - centreX(enemy);
  const sameFloor = Math.abs(player.y + player.h - (enemy.y + enemy.h)) < 60;
  if (enemy.state === "patrol") {
    walk(enemy, dt, level);
    if (enemy.timer <= 0 && sameFloor && Math.abs(dx) < 330) {
      enemy.dir = Math.sign(dx) || 1;
      enemy.state = "windup";
      enemy.timer = 0.45;
    }
    return;
  }
  if (enemy.state === "windup") {
    enemy.vx = 0;
    moveBody(enemy, dt, level);
    if (enemy.timer <= 0) {
      enemy.state = "rush";
      enemy.timer = 1.1;
    }
    return;
  }
  enemy.vx = enemy.dir * 340;
  moveBody(enemy, dt, level);
  const blocked = enemy.hitWall || !floorAhead(enemy, enemy.dir, level);
  if (blocked || enemy.timer <= 0) {
    enemy.state = "patrol";
    enemy.timer = 1.6;
  }
}

// Drifts towards the player at helmet height, slow enough to jump over.
function hover(enemy, dt, level, player) {
  const homeX = enemy.home.x + enemy.w / 2;
  const awake = Math.abs(centreX(player) - homeX) < hoverLeash + 300;
  const target = awake
    ? {
        x: Math.min(
          Math.max(centreX(player), homeX - hoverLeash),
          homeX + hoverLeash,
        ),
        y: player.y + 4 + Math.sin(enemy.age * 2.4) * 14,
      }
    : { x: homeX, y: enemy.home.y };
  // Never sink to the floor, even if the player drops into a pit.
  const lowest = 10 * tile - enemy.h - 14;
  const dx = target.x - centreX(enemy);
  const dy = Math.min(target.y, lowest) - enemy.y;
  enemy.x += Math.sign(dx) * Math.min(Math.abs(dx), hoverSpeed.x * dt);
  enemy.y += Math.sign(dy) * Math.min(Math.abs(dy), hoverSpeed.y * dt);
  if (Math.abs(dx) > 4) enemy.dir = Math.sign(dx);
}

// Cruises high up, then dives when the player passes underneath. It crashes
// into the ground and lies stunned for a few seconds before flying back up.
function dive(enemy, dt, level, player) {
  enemy.timer -= dt;
  const below = player.y > enemy.y;
  const lined = Math.abs(centreX(player) - centreX(enemy)) < 40;
  if (enemy.state === "patrol") {
    enemy.x = enemy.home.x + Math.sin(enemy.age * 0.9) * 110;
    enemy.y = enemy.home.y + Math.sin(enemy.age * 3) * 8;
    if (lined && below && enemy.timer <= 0) {
      enemy.state = "windup";
      enemy.timer = 0.5;
    }
    return null;
  }
  if (enemy.state === "windup") {
    if (enemy.timer <= 0) {
      enemy.state = "diving";
      enemy.vx = 0;
      enemy.vy = 300;
    }
    return null;
  }
  if (enemy.state === "diving") {
    moveBody(enemy, dt, level, 3200);
    if (enemy.y > level.height) enemy.gone = true;
    if (!enemy.onGround) return null;
    enemy.state = "stunned";
    enemy.timer = stunSeconds;
    return "crash";
  }
  if (enemy.state === "stunned") {
    if (enemy.timer <= 0) enemy.state = "rising";
    return null;
  }
  enemy.y -= 170 * dt;
  if (enemy.y <= enemy.home.y) {
    enemy.y = enemy.home.y;
    enemy.home.x = enemy.x - Math.sin(enemy.age * 0.9) * 110;
    enemy.state = "patrol";
    enemy.timer = 1.2;
  }
  return null;
}

// Returns "crash" when a diver hits the ground, otherwise nothing.
export function updateEnemy(enemy, dt, level, player) {
  enemy.age += dt;
  enemy.flash = Math.max(0, enemy.flash - dt);
  if (enemy.dying !== undefined) {
    enemy.dying += dt;
    return null;
  }
  const result = enemy.def.move(enemy, dt, level, player);
  if (enemy.y > level.height + 200) enemy.gone = true;
  return result ?? null;
}

// A stunned diver can't hurt anyone and can be stomped without a smash.
export const isStunned = (enemy) => enemy.state === "stunned";

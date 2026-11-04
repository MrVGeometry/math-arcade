// The astronaut: running, jumping and the ground smash.
import { tile } from "./levels.js";
import { moveBody, standingSafely } from "./physics.js";

export const maxHearts = 3;
const runSpeed = 300;
const runAccel = 2600;
// Low gravity: a slow, floaty arc with a gentle top speed when falling.
const playerGravity = 1150;
const maxFallSpeed = 620;
const jumpSpeed = 760;
const coyoteSeconds = 0.1;
const bufferSeconds = 0.12;
const smashHang = 0.08;
const smashSpeed = 1900;
const hurtSeconds = 1.4;
const knockSeconds = 0.3;

export function createPlayer(startCol) {
  const player = {
    buffer: 0,
    coyote: 0,
    facing: 1,
    h: 76,
    hurtFor: 0,
    knockFor: 0,
    onGround: false,
    safe: null,
    smash: null,
    stride: 0,
    vx: 0,
    vy: 0,
    w: 28,
    x: 0,
    y: 0,
  };
  placePlayer(player, { x: startCol * tile + tile / 2, y: 10 * tile });
  return player;
}

// Puts the player's feet at a point and remembers it as safe ground.
export function placePlayer(player, feet) {
  player.x = feet.x - player.w / 2;
  player.y = feet.y - player.h;
  player.vx = 0;
  player.vy = 0;
  player.smash = null;
  player.safe = { ...feet };
}

export function hurtPlayer(player, fromX) {
  const away = player.x + player.w / 2 < fromX ? -1 : 1;
  player.hurtFor = hurtSeconds;
  player.knockFor = knockSeconds;
  player.smash = null;
  player.vx = away * 320;
  player.vy = -330;
}

// Bounce off an enemy's head. A smash that lands a hit bounces higher.
export function bouncePlayer(player, high) {
  player.smash = null;
  player.vy = high ? -540 : -400;
}

function approach(value, target, step) {
  if (value < target) return Math.min(value + step, target);
  return Math.max(value - step, target);
}

function steer(player, input, dt) {
  if (player.knockFor > 0) return;
  const dir = (input.held("right") ? 1 : 0) - (input.held("left") ? 1 : 0);
  if (dir !== 0) player.facing = dir;
  const accel = player.onGround ? runAccel : runAccel * 0.6;
  player.vx = approach(player.vx, dir * runSpeed, accel * dt);
}

function tryJump(player, input) {
  if (input.pressed("jump")) player.buffer = bufferSeconds;
  if (player.buffer > 0 && player.coyote > 0) {
    player.vy = -jumpSpeed;
    player.buffer = 0;
    player.coyote = 0;
    return true;
  }
  // Letting go early makes a shorter hop.
  if (!input.held("jump") && player.vy < -260) player.vy = -260;
  return false;
}

// Returns a list of events ("jump", "smash", "slam") for sound and effects.
export function updatePlayer(player, input, dt, level) {
  const events = [];
  player.hurtFor = Math.max(0, player.hurtFor - dt);
  player.knockFor = Math.max(0, player.knockFor - dt);
  player.buffer = Math.max(0, player.buffer - dt);
  player.coyote = player.onGround ? coyoteSeconds : player.coyote - dt;

  if (player.smash) {
    player.smash.hang -= dt;
    player.vx = 0;
    const falling = player.smash.hang <= 0;
    player.vy = falling ? smashSpeed : 0;
    moveBody(player, dt, level, 0);
    if (player.onGround) {
      player.smash = null;
      events.push("slam");
    }
    return events;
  }

  steer(player, input, dt);
  if (tryJump(player, input)) events.push("jump");
  if (input.pressed("down") && !player.onGround && player.knockFor <= 0) {
    player.smash = { hang: smashHang };
    events.push("smash");
    return events;
  }
  moveBody(player, dt, level, playerGravity);
  player.vy = Math.min(player.vy, maxFallSpeed);
  player.stride = player.onGround
    ? player.stride + Math.abs(player.vx) * dt
    : player.stride;
  if (standingSafely(player, level)) {
    player.safe = { x: player.x + player.w / 2, y: player.y + player.h };
  }
  return events;
}

// Picks the walk-cycle frame: 0 stands still, 1 to 7 stride.
export function playerFrame(player) {
  if (player.smash) return 0;
  if (!player.onGround) return 2;
  if (Math.abs(player.vx) < 20) return 0;
  return 1 + (Math.floor(player.stride / 22) % 7);
}

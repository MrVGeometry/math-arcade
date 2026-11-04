// Game objects for Deus Draconis. Timings, speeds and flight paths follow the
// original Scratch project (480x360 stage, 30 frames per second).
export const width = 480;
export const height = 360;
export const roundSeconds = 90;

// Scratch stage coordinates (centre origin, y up) to canvas coordinates.
const sx = (x) => width / 2 + x;
const sy = (y) => height / 2 - y;

export const dragonBounds = { maxX: 464, maxY: sy(-100), minX: 16, minY: sy(-5) };
export const dragonSpeed = 150;
export const dragonStart = { x: sx(-86), y: sy(-54) };
const fireballSpeed = 90;
const slimeSeconds = 3;

export const radius = { dragon: 14, fireball: 6, monster: 17, slime: 6 };

const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

export function overlaps(a, ra, b, rb) {
  return Math.hypot(a.x - b.x, a.y - b.y) < ra + rb;
}

// Spawn schedule: 5 monsters 5s apart, 7 more 4s apart, then 10 more 3s apart.
// The original only counts the first 12, so the last 10 all start right.
export const spawns = (() => {
  const list = [];
  let at = 0;
  [[5, 5], [7, 4], [10, 3]].forEach(([count, gap]) => {
    for (let i = 0; i < count; i += 1) {
      at += gap;
      const counted = Math.min(list.length + 1, 12);
      list.push({ at, fromLeft: counted % 2 === 1 });
    }
  });
  return list;
})();

// Sweep across the top, sweep back dropping slime, then dive at the dragon.
function flightPlan(fromLeft) {
  const [startX, farX, backX] = fromLeft ? [-201, 194, -220] : [210, -220, 194];
  return [
    { type: "goto", x: sx(startX), y: sy(145) },
    ...(fromLeft ? [{ type: "slime" }] : []),
    { secs: 7, type: "glide", x: sx(farX), y: sy(120) },
    ...(fromLeft ? [] : [{ type: "slime" }]),
    { secs: 7, type: "glide", x: sx(backX), y: sy(100) },
    { type: "slime" },
    { secs: 5, target: "dragon", type: "glide" },
    { secs: 0.1, type: "glide" },
    { secs: 1, target: "dragon", type: "glide" },
  ];
}

export function createMonster(fromLeft) {
  return { alive: true, fade: 0, pc: 0, plan: flightPlan(fromLeft), step: null, x: 0, y: 0 };
}

function startStep(monster, world) {
  const action = monster.plan[monster.pc];
  monster.pc = (monster.pc + 1) % monster.plan.length;
  if (action.type === "goto") {
    monster.x = action.x;
    monster.y = action.y;
    return null;
  }
  if (action.type === "slime") {
    world.slimes.push(createSlime());
    return null;
  }
  const to = action.target === "dragon" ? world.dragon : action;
  return {
    elapsed: 0,
    fromX: monster.x,
    fromY: monster.y,
    secs: action.secs,
    toX: to.x ?? monster.x,
    toY: to.y ?? monster.y,
  };
}

function glide(thing, step, dt) {
  const used = Math.min(dt, step.secs - step.elapsed);
  step.elapsed += used;
  const t = step.elapsed / step.secs;
  thing.x = step.fromX + (step.toX - step.fromX) * t;
  thing.y = step.fromY + (step.toY - step.fromY) * t;
  return used;
}

// Returns false once the monster should be removed.
export function updateMonster(monster, dt, world) {
  if (!monster.alive) {
    monster.fade += dt;
    return monster.fade < 1;
  }
  let left = dt;
  for (let guard = 0; left > 0 && guard < 12; guard += 1) {
    monster.step ??= startStep(monster, world);
    if (monster.step) {
      left -= glide(monster, monster.step, left);
      if (monster.step.elapsed >= monster.step.secs) monster.step = null;
    }
  }
  return true;
}

// A slime waits unseen near the top until a monster flies over it, then
// lobs itself at where the dragon is at that moment.
export function createSlime() {
  return { step: null, x: sx(10 * randomInt(1, 20)), y: sy(140) };
}

// Returns "launch" when a slime is fired, false once it should be removed.
export function updateSlime(slime, dt, world) {
  if (slime.step) {
    glide(slime, slime.step, dt);
    return slime.step.elapsed < slime.step.secs;
  }
  const flyover = world.monsters.some(
    (m) => m.alive && overlaps(m, radius.monster, slime, radius.slime),
  );
  if (!flyover) return true;
  slime.step = {
    elapsed: 0,
    fromX: slime.x,
    fromY: slime.y,
    secs: slimeSeconds,
    toX: world.dragon.x,
    toY: world.dragon.y,
  };
  return "launch";
}

export function createFireball(dragon) {
  return { x: dragon.x, y: dragon.y - 20 };
}

export function updateFireball(fireball, dt) {
  fireball.y -= fireballSpeed * dt;
  return fireball.y > -10;
}

// Six background cloud lanes drifting down the sky (period, fall time, size).
const cloudLanes = [
  [-192, 11, 22, 1],
  [-130, 22, 45, 3],
  [-31, 17, 35, 2],
  [40, 25, 50, 4],
  [106, 7, 15, 0],
  [194, 10, 30, 3],
].map(([x, period, secs, size]) => ({ period, secs, size, x: sx(x) }));

export function createSky() {
  // Start with a few clouds already on screen so the sky isn't empty.
  const clouds = cloudLanes.map((lane) => ({
    lane,
    progress: Math.random(),
  }));
  const timers = cloudLanes.map((lane) => lane.period - 1);
  return { clouds, timers };
}

export function updateSky(sky, dt) {
  sky.timers.forEach((timer, i) => {
    sky.timers[i] = timer - dt;
    if (sky.timers[i] > 0) return;
    sky.timers[i] += cloudLanes[i].period;
    sky.clouds.push({ lane: cloudLanes[i], progress: 0 });
  });
  sky.clouds.forEach((cloud) => {
    cloud.progress += dt / cloud.lane.secs;
  });
  sky.clouds = sky.clouds.filter((cloud) => cloud.progress < 1);
}

export function cloudPosition(cloud) {
  return { x: cloud.lane.x, y: -40 + (height + 80) * cloud.progress };
}

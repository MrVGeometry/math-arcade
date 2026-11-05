/**
 * Spireclash game loop: input, third-person camera, the player's shooting and
 * building, the HUD, and the best-of-five round flow. Also offers a spectator
 * mode where two Archmage brains duel, which doubles as an AI test bench.
 */
(function () {
  'use strict';
  const G = window.G;
  const C = G.CELL;
  const H = G.LEVEL_H;
  const $ = (id) => document.getElementById(id);
  const WIN_SCORE = 3;
  // Seconds each round lasts once the fight starts.
  const ROUND_TIME = 60;
  // Phase wand reach (from the eye) and recharge between uses.
  const WAND_RANGE = 11;
  // A short gap between wand actions, so a held click cannot phase a row
  // of pieces by accident. There is no limit on how many uses.
  const WAND_CD = 0.2;
  // How long the player's wand keeps a piece phased.
  const WAND_PHASE = 2;
  // Seconds before box in can be used again.
  const BOX_CD = 10;
  const KB = G.keybinds;
  const TOUCH = G.touch;
  const V1 = new THREE.Vector3();
  const V2 = new THREE.Vector3();
  const V3 = new THREE.Vector3();
  const EYE = new THREE.Vector3();
  const CAM_DIR = new THREE.Vector3();
  const AIM_DIR = new THREE.Vector3();
  const camRay = new THREE.Raycaster();

  /* Settings -------------------------------------------------------------- */

  const settings = { sens: 1, instant: true, volume: 0.7, difficulty: 'knight', controls: 'auto' };
  try {
    Object.assign(settings, JSON.parse(localStorage.getItem('spireclash-settings') || '{}'));
  } catch (e) {
    // Storage can be unavailable (private windows); defaults are fine.
  }
  function saveSettings() {
    try {
      localStorage.setItem('spireclash-settings', JSON.stringify(settings));
    } catch (e) {
      // Ignore: settings simply will not persist.
    }
  }
  if (!G.DIFFICULTIES[settings.difficulty]) settings.difficulty = 'knight';
  KB.load(settings.keys);
  TOUCH.setMode(settings.controls);

  /* Scene ----------------------------------------------------------------- */

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  $('game').appendChild(renderer.domElement);
  const canvas = renderer.domElement;

  G.makeTextures();
  const world = G.createWorld();
  world.useRenderer(renderer);
  const scene = world.scene;
  G.builds.init(scene);
  G.fx.init(scene);
  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 2000);
  G.listener = camera.position;

  const player = new G.Character(scene, { name: 'You', palette: G.PALETTES.player });
  const foe = new G.Character(scene, { name: 'Rival', palette: G.PALETTES.knight, isAI: true });
  G.combat.setChars([player, foe]);
  const brain = new G.AIBrain(foe, player, settings.difficulty);
  let autoPilot = null;
  player.reset(0, 22, 0);
  foe.reset(0, -22, Math.PI);
  G.builds.prewarm(renderer, camera);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* State ----------------------------------------------------------------- */

  const ctrl = { yaw: 0, pitch: -0.05, mode: 'weapon', buildType: 'wall', buildCd: 0, ads: false, wandCd: 0 };
  // A short message shown under the crosshair (wand feedback and the like).
  const note = { text: '', t: 0 };
  const keys = {};
  let mouseL = false;
  let mouseR = false;
  let locked = false;
  let state = 'menu';
  let prevState = 'playing';
  let spectating = false;
  let countdownT = 0;
  let lastCount = 0;
  let roundEndT = 0;
  let roundT = ROUND_TIME;
  // Damage each duellist has dealt to the other this round (for timeouts).
  const roundDealt = { you: 0, foe: 0 };
  let round = 1;
  let bannerT = 0;
  let attractA = 0;
  const score = { you: 0, foe: 0 };
  const stats = { shots: 0, hits: 0, dealt: 0, builds: 0, heads: 0 };

  /* Input ----------------------------------------------------------------- */

  function requestLock() {
    if (spectating) return;
    // Touch play has no pointer lock: the on-screen controls are the input.
    if (TOUCH.enabled) {
      locked = true;
      TOUCH.enterFullscreen();
      return;
    }
    try {
      const r = canvas.requestPointerLock();
      if (r && r.catch) r.catch(() => showPause());
    } catch (e) {
      showPause();
    }
  }

  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (!locked) {
      mouseL = false;
      mouseR = false;
      if (state === 'playing' || state === 'countdown' || state === 'roundEnd') showPause();
    }
  });
  document.addEventListener('pointerlockerror', () => {
    if (state !== 'menu' && state !== 'matchEnd') showPause();
  });

  window.addEventListener('keydown', (e) => {
    // The question box needs the keyboard to itself.
    if (state === 'question') return;
    // Stop bound keys (Tab, slash and the like) doing browser things mid-duel.
    if (e.code === 'Space' || e.code.startsWith('Arrow') || (locked && KB.actionFor(e.code))) e.preventDefault();
    keys[e.code] = true;
    if (e.repeat) return;
    if (spectating && e.code === 'Escape' && state !== 'paused' && state !== 'menu') {
      showPause();
      return;
    }
    if (!locked || spectating) return;
    onKey(e.code);
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
    mouseL = false;
    mouseR = false;
  });

  canvas.addEventListener('mousedown', (e) => {
    if (!locked) {
      if (state === 'playing' || state === 'countdown' || state === 'roundEnd') requestLock();
      return;
    }
    if (e.button === 0) mouseL = true;
    if (e.button === 2) mouseR = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouseL = false;
    if (e.button === 2) mouseR = false;
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('mousemove', (e) => {
    if (!locked) return;
    const s = 0.0022 * settings.sens * (ctrl.ads ? 0.6 : 1);
    ctrl.yaw -= e.movementX * s;
    ctrl.pitch = G.clamp(ctrl.pitch - e.movementY * s, -1.45, 1.45);
  });
  window.addEventListener(
    'wheel',
    (e) => {
      if (!locked) return;
      if (e.deltaY !== 0) selectWeapon((player.weaponIdx + 1) % 2);
    },
    { passive: true }
  );

  function onKey(code) {
    doAction(KB.actionFor(code));
  }

  function doAction(action) {
    switch (action) {
      case 'bow':
        selectWeapon(0);
        break;
      case 'staff':
        selectWeapon(1);
        break;
      case 'draught':
        if (G.combat.startDrink(player)) ctrl.mode = 'weapon';
        break;
      case 'reload':
        G.combat.startReload(player);
        break;
      case 'wand':
        selectWand();
        break;
      case 'wall':
      case 'ramp':
      case 'floor':
      case 'roof':
        selectBuild(action);
        break;
      case 'box':
        boxIn();
        break;
      default:
        break;
    }
  }

  function showNote(text) {
    note.text = text;
    note.t = 1.6;
  }

  // Phase wand: the wand key takes it out in place of a weapon (it does
  // not fight). The piece of yours under the crosshair glows blue; left
  // click phases it for a moment, right click makes it solid again.
  function selectWand() {
    G.combat.cancelDrink(player);
    ctrl.mode = 'wand';
    ctrl.wandCd = Math.max(ctrl.wandCd, 0.15);
  }

  // How far the player's feet are from a piece's box (0 when inside it).
  function feetDistance(p) {
    const b = p.aabb;
    const f = player.pos;
    const dx = Math.max(b.min.x - f.x, 0, f.x - b.max.x);
    const dy = Math.max(b.min.y - f.y, 0, f.y - b.max.y);
    const dz = Math.max(b.min.z - f.z, 0, f.z - b.max.z);
    return Math.hypot(dx, dz, dy);
  }

  // Why the wand cannot act on a piece it is aimed at, or null if it can.
  function wandRefusal(p, distance) {
    V1.copy(camera.position).addScaledVector(CAM_DIR, distance);
    if (V1.distanceTo(EYE) > WAND_RANGE) return 'Too far for the wand';
    if (p.fixed) return 'The bulwark resists the wand';
    if (p.owner !== 'player') return 'The wand only works on your own pieces';
    return null;
  }

  // The piece the wand would act on, or a reason it cannot. Of all your
  // pieces under the crosshair, the one nearest you wins (the one you are
  // standing on above all), so a stair underfoot is picked over the floor
  // it overlaps, whichever the ray happens to meet first.
  function wandTarget() {
    camera.getWorldDirection(CAM_DIR);
    const hits = G.builds.pickAll(camera.position, CAM_DIR, 80);
    if (!hits.length) return { why: 'Aim the wand at one of your pieces' };
    player.eye(EYE);
    let best = null;
    let bestScore = Infinity;
    for (const h of hits) {
      if (wandRefusal(h.piece, h.distance)) continue;
      const score = h.piece === player.groundPiece ? -1 : feetDistance(h.piece);
      // Ties go to the piece the ray meets first.
      if (score < bestScore - 0.05) {
        best = h.piece;
        bestScore = score;
      }
    }
    if (best) return { piece: best };
    return { why: wandRefusal(hits[0].piece, hits[0].distance) };
  }

  function handleWand() {
    const t = wandTarget();
    G.builds.highlight(t.piece || null);
    const phaseIt = mouseL || TOUCH.fire;
    const solidify = mouseR || TOUCH.ads;
    if (!phaseIt && !solidify) return;
    if (ctrl.wandCd > 0 || !player.alive) return;
    if (!t.piece) {
      showNote(t.why);
      ctrl.wandCd = WAND_CD;
      return;
    }
    if (phaseIt && !(t.piece.phaseT > 0) && G.builds.phase(t.piece, WAND_PHASE)) ctrl.wandCd = WAND_CD;
    else if (solidify && t.piece.phaseT > 0) {
      G.builds.unphase(t.piece);
      ctrl.wandCd = WAND_CD;
    }
  }

  function selectWeapon(i) {
    ctrl.mode = 'weapon';
    G.combat.switchWeapon(player, i, 0.15);
  }

  function selectBuild(type) {
    G.combat.cancelDrink(player);
    ctrl.mode = 'build';
    ctrl.buildType = type;
    ctrl.drag = null;
    if (settings.instant) ctrl.buildCd = 0;
  }

  /* Building -------------------------------------------------------------- */

  // How far a fallback spot may stray: this close to the player sideways,
  // and its top no further than this below their feet.
  const NEAR_REACH = 1.5;
  const NEAR_DROP = 0.75;

  // The furthest any piece may be built from the player, measured flat to
  // its nearest point: a stair and a half.
  const BUILD_REACH = 1.5 * C;

  // Flat distance from the player to the nearest point of a spot.
  function flatDistance(spec) {
    const b = G.builds.aabbOf(spec);
    const p = player.pos;
    const dx = Math.max(b.min.x - p.x, 0, p.x - b.max.x);
    const dz = Math.max(b.min.z - p.z, 0, p.z - b.max.z);
    return Math.hypot(dx, dz);
  }

  // Whether a spot sits right at the player, not off below or out ahead.
  function nearPlayer(spec) {
    return flatDistance(spec) <= NEAR_REACH && G.builds.aabbOf(spec).max.y >= player.pos.y - NEAR_DROP;
  }

  // Prefer a spot that joins onto existing builds: the aimed-at spot if it
  // does; otherwise the same piece one level down or (for floors and
  // stairs) in the cell back towards the player, if either connects and
  // stays right at the player; only then the aimed-at spot on its own.
  // Never steps a level up or further out.
  function connectedSpec(spec, dv) {
    if (!spec || G.builds.get(spec) || G.builds.joins(spec)) return spec;
    const alts = [Object.assign({}, spec, { k: spec.k - 1 })];
    if (spec.type === 'floor' || spec.type === 'ramp') {
      alts.push(Object.assign({}, spec, { i: spec.i - dv.x, j: spec.j - dv.z }));
    }
    for (const s of alts) {
      if (!G.builds.get(s) && G.builds.canPlace(s) && G.builds.joins(s) && nearPlayer(s)) return s;
    }
    return spec;
  }

  // The level the player is building from. Mid-jump, the level last stood
  // on, so a hop does not lift pieces a level and leave them unconnected.
  function buildLevel() {
    const ch = player;
    if (ch.onGround) ctrl.groundY = ch.pos.y;
    const feet = ch.onGround || ctrl.groundY === undefined ? ch.pos.y : Math.min(ch.pos.y, ctrl.groundY + 0.5);
    return Math.max(0, Math.round(feet / H));
  }

  // One press: walls on every open side of the player's cell. Once all four
  // stand, the next press caps the box with a floor overhead.
  function boxIn() {
    // Its own cooldown, so it works the same from either mode.
    if (!player.alive) return;
    const wait = boxWait();
    if (wait > 0) {
      showNote(`Box in recharging: ${Math.ceil(wait)}s`);
      return;
    }
    const ci = Math.floor(player.pos.x / C);
    const cj = Math.floor(player.pos.z / C);
    const k = buildLevel();
    const walls = [0, 1, 2, 3].map((d) => G.builds.wallSpec(ci, cj, d, k));
    let placed = 0;
    for (const s of walls) {
      if (!G.builds.get(s) && G.builds.canPlace(s) && G.builds.place(s, 'player')) placed += 1;
    }
    if (placed === 0 && walls.every((s) => G.builds.get(s))) {
      const lid = { type: 'floor', i: ci, j: cj, k: k + 1 };
      if (!G.builds.get(lid) && G.builds.canPlace(lid) && G.builds.place(lid, 'player')) placed += 1;
    }
    if (placed === 0) {
      showNote('Already boxed in');
      return;
    }
    ctrl.boxAt = G.now;
    stats.builds += placed;
  }

  // Seconds until box in is ready again (0 once it is).
  function boxWait() {
    if (ctrl.boxAt === undefined) return 0;
    return Math.max(0, BOX_CD - (G.now - ctrl.boxAt));
  }

  // The stair the player is climbing: the one underfoot, or the one just
  // left on a hop up it.
  function currentStair() {
    const g = player.groundPiece;
    if (player.onGround && g && g.alive && g.type === 'ramp') {
      ctrl.stair = g;
      ctrl.stairAt = G.now;
      return g;
    }
    const s = ctrl.stair;
    if (!player.onGround && s && s.alive && G.now - ctrl.stairAt < 0.45) return s;
    return null;
  }

  // The first wall still to build from a wish list of cell edges: every
  // edge at the base level first, then the same edges stacked one on top.
  // Never higher than one level above the player, so walls reach at most
  // two high from where they stand. With nothing left to build, the first
  // wish, which shows no preview since it already stands.
  function pickWall(i, j, dirs, level) {
    const top = Math.min(level + 1, buildLevel() + 1);
    for (let lv = level; lv <= top; lv += 1) {
      for (const d of dirs) {
        const s = G.builds.wallSpec(i, j, d, lv);
        if (!G.builds.get(s) && G.builds.canPlace(s)) return s;
      }
    }
    return G.builds.wallSpec(i, j, dirs[0], level);
  }

  // Walls wrap a stair being climbed. Aimed along it: its front. Aimed
  // diagonally: its front and that side, the front first. Turned well to a
  // side: that side. Turned right round: its back. Always at the stair's
  // own level, joined to it, stacking upward once those stand.
  function stairWall(stair, f) {
    const fwd = G.DIRS[stair.dir];
    const along = f.x * fwd.x + f.z * fwd.z;
    const across = f.x * fwd.z - f.z * fwd.x;
    const turn = Math.abs(Math.atan2(across, along));
    const sideVec = G.DIRS[(stair.dir + 1) % 4];
    const side = f.x * sideVec.x + f.z * sideVec.z > 0 ? (stair.dir + 1) % 4 : (stair.dir + 3) % 4;
    let dirs = [stair.dir];
    if (turn > 2.1) dirs = [(stair.dir + 2) % 4];
    else if (turn > 1.22) dirs = [side];
    else if (turn > 0.35) dirs = [stair.dir, side];
    return pickWall(stair.i, stair.j, dirs, stair.k);
  }

  // A stair out in front of the player rising away from them: the next one
  // on from the stair underfoot, or one in the cell faced, at the player's
  // level or one either side.
  function stairAhead(ci, cj, dv, k, f) {
    const tries = [];
    const cur = currentStair();
    if (cur) {
      const v = G.DIRS[cur.dir];
      tries.push([cur.i + v.x, cur.j + v.z, cur.k + 1], [cur.i + v.x, cur.j + v.z, cur.k]);
    }
    for (const lv of [k, k + 1, k - 1]) tries.push([ci + dv.x, cj + dv.z, lv]);
    for (const [i, j, lv] of tries) {
      if (lv < 0) continue;
      const p = G.builds.get({ type: 'ramp', i, j, k: lv });
      if (!p || p.type !== 'ramp' || !p.alive || p === cur) continue;
      const v = G.DIRS[p.dir];
      if (f.x * v.x + f.z * v.z > 0.2) return p;
    }
    return null;
  }

  // On flat ground: the cell edge faced, plus the neighbouring edge when
  // aiming towards a corner, the more nearly faced first.
  function cellWall(i, j, f, d, level) {
    const off = d % 2 === 0 ? Math.abs(Math.atan2(f.z, Math.abs(f.x))) : Math.abs(Math.atan2(f.x, Math.abs(f.z)));
    const second = d % 2 === 0 ? (f.z > 0 ? 1 : 3) : f.x > 0 ? 0 : 2;
    return pickWall(i, j, off > 0.35 ? [d, second] : [d], level);
  }

  // Choose where a piece goes from the player's cell, facing and pitch.
  function targetSpec(type) {
    const f = G.forwardFromYaw(ctrl.yaw);
    return connectedSpec(aimedSpec(type), G.DIRS[G.cardinal(f.x, f.z)]);
  }

  function aimedSpec(type) {
    const ch = player;
    const pitch = ctrl.pitch;
    const f = G.forwardFromYaw(ctrl.yaw);
    const d = G.cardinal(f.x, f.z);
    const dv = G.DIRS[d];
    const ci = Math.floor(ch.pos.x / C);
    const cj = Math.floor(ch.pos.z / C);
    const gpRaw = ch.groundPiece;
    const gp = gpRaw && gpRaw.alive && gpRaw.type === 'ramp' && gpRaw.dir === d ? gpRaw : null;
    const k = buildLevel();
    const ai = ci + dv.x;
    const aj = cj + dv.z;
    switch (type) {
      case 'wall': {
        // The stair out in front takes the wall first, so a stair can always
        // be walled; then the stair underfoot; then the player's own cell.
        // Each is tried in turn until one still has a wall to build, so a
        // stair already walled two high never blocks the wall in front.
        const tries = [];
        const front = stairAhead(ci, cj, dv, k, f);
        const stair = currentStair();
        // Looking down at it: across its base, right at its foot between
        // the player and the stair. Otherwise across its top; once that
        // stands, the player's own square below puts it across the base.
        if (front && pitch < -0.6) tries.push(pickWall(front.i, front.j, [(front.dir + 2) % 4], front.k));
        else if (front) tries.push(stairWall(front, f));
        if (stair) tries.push(stairWall(stair, f));
        // From the player's level up: the bottom wall first, then the one on top.
        tries.push(cellWall(ci, cj, f, d, k));
        return tries.find((s) => !G.builds.get(s)) || tries[0];
      }
      case 'ramp': {
        if (gp) return { type: 'ramp', i: gp.i + dv.x, j: gp.j + dv.z, k: gp.k + 1, dir: d };
        if (pitch < -0.85) return { type: 'ramp', i: ci, j: cj, k, dir: d };
        if (G.builds.get(G.builds.wallSpec(ci, cj, d, k))) return { type: 'ramp', i: ci, j: cj, k, dir: d };
        return { type: 'ramp', i: ai, j: aj, k, dir: d };
      }
      case 'floor': {
        if (pitch < -0.7) return { type: 'floor', i: ci, j: cj, k };
        if (pitch > 0.6) return { type: 'floor', i: ci, j: cj, k: k + 1 };
        if (gp) return { type: 'floor', i: gp.i + dv.x, j: gp.j + dv.z, k: gp.k + 1 };
        return { type: 'floor', i: ai, j: aj, k };
      }
      default: {
        // Looking up: a cap over the player's head.
        if (pitch > 0.6) return { type: 'roof', i: ci, j: cj, k: k + 1 };
        // Otherwise the floor nearest the player: their own square, right
        // underfoot, then the square faced. A held build fans out from
        // there as the aim turns (see dragRoof).
        const own = { type: 'roof', i: ci, j: cj, k };
        if (!G.builds.get(own) && G.builds.canPlace(own)) return own;
        return { type: 'roof', i: ai, j: aj, k };
      }
    }
  }

  // How far the aim must turn (radians) while a wall build is held before
  // the next wall goes in: up or down to stack, left or right to turn the
  // corner onto that side of the player's square.
  const DRAG_PITCH = 0.16;
  const DRAG_YAW = 0.3;

  // The edge of the player's square a quarter turn round from a wall (turn
  // 1: to the right, 3: to the left), at that wall's level. A wall that is
  // not an edge of the square counts as the edge on its side of the player.
  function sideWall(s, turn) {
    const ci = Math.floor(player.pos.x / C);
    const cj = Math.floor(player.pos.z / C);
    const key = G.builds.keyOf(s);
    let d = [0, 1, 2, 3].find((e) => G.builds.keyOf(G.builds.wallSpec(ci, cj, e, s.k)) === key);
    if (d === undefined) {
      const b = G.builds.aabbOf(s);
      d = G.cardinal((b.min.x + b.max.x) / 2 - player.pos.x, (b.min.z + b.max.z) / 2 - player.pos.z);
    }
    return G.builds.wallSpec(ci, cj, (d + turn) % 4, s.k);
  }

  // Where a held wall build goes next: stacked on or under the last wall
  // when the aim turns up or down, or round the corner of the player's
  // square when it turns left or right; null until the aim has turned far
  // enough. Never below the ground or more than one level above the
  // player, like a single wall.
  function dragWall(drag) {
    const s = drag.spec;
    const dp = ctrl.pitch - drag.pitch;
    // Turning right lowers the yaw.
    const dy = drag.yaw - ctrl.yaw;
    let next = null;
    const own = sideWall(s, 0);
    const onSquare = G.builds.keyOf(own) === G.builds.keyOf(s);
    if (Math.abs(dp) >= DRAG_PITCH && Math.abs(dp) >= Math.abs(dy)) {
      // Down from a wall out beyond the square (across a stair's top):
      // back to the square's own edge, across the stair's base.
      if (dp < 0 && !onSquare) next = own;
      else next = Object.assign({}, s, { k: s.k + (dp > 0 ? 1 : -1) });
    } else if (Math.abs(dy) >= DRAG_YAW) {
      next = sideWall(s, dy > 0 ? 1 : 3);
    }
    if (!next || next.k < 0 || next.k > buildLevel() + 1) return null;
    return next;
  }

  // Where a held spire build goes next: the square beside the last spire
  // on the side the aim turns to, or the square beyond it when the aim
  // lifts (back towards the player when it drops); null until the aim
  // has turned far enough. Stays on the last spire's level.
  function dragRoof(drag) {
    const s = drag.spec;
    const dp = ctrl.pitch - drag.pitch;
    // Turning right lowers the yaw.
    const dy = drag.yaw - ctrl.yaw;
    const f = G.forwardFromYaw(ctrl.yaw);
    const d = G.cardinal(f.x, f.z);
    let step = null;
    if (Math.abs(dp) >= DRAG_PITCH && Math.abs(dp) >= Math.abs(dy)) {
      step = G.DIRS[dp > 0 ? d : (d + 2) % 4];
    } else if (Math.abs(dy) >= DRAG_YAW) {
      step = G.DIRS[(d + (dy > 0 ? 1 : 3)) % 4];
    }
    if (!step) return null;
    return { type: 'roof', i: s.i + step.x, j: s.j + step.z, k: s.k };
  }

  // Builds that carry on from the last piece while held.
  const DRAGS = { roof: dragRoof, wall: dragWall };

  function handleBuild(dt) {
    ctrl.buildCd -= dt;
    const held = mouseL || TOUCH.fire || (settings.instant && keys[KB.get(ctrl.buildType)]);
    const drags = DRAGS[ctrl.buildType];
    if (!held || !drags) ctrl.drag = null;
    // A held wall or spire build steps on only when the aim turns;
    // otherwise the piece goes where the crosshair naturally points.
    const spec = ctrl.drag ? drags(ctrl.drag) : targetSpec(ctrl.buildType);
    if (!spec) {
      G.builds.showGhost(null);
      return;
    }
    if (G.builds.get(spec)) {
      // A piece already standing there: carry the drag on through it.
      if (ctrl.drag) ctrl.drag = { pitch: ctrl.pitch, spec, yaw: ctrl.yaw };
      G.builds.showGhost(null);
      return;
    }
    // Out of reach shows red and cannot be built.
    const valid = flatDistance(spec) <= BUILD_REACH && G.builds.canPlace(spec);
    G.builds.showGhost(spec, valid);
    // Holding the button places the next piece as soon as the aim reaches a
    // new spot: barely a pause between pieces.
    if (held && valid && ctrl.buildCd <= 0 && G.builds.place(spec, 'player')) {
      ctrl.buildCd = 0.025;
      stats.builds += 1;
      if (drags) ctrl.drag = { pitch: ctrl.pitch, spec, yaw: ctrl.yaw };
    }
  }

  /* Shooting -------------------------------------------------------------- */

  // Aim where the crosshair points, but fire from the duellist's right
  // shoulder (the eye, if the shoulder is pressed into cover).
  function computeAim() {
    camera.getWorldDirection(CAM_DIR);
    player.shotOrigin(EYE);
    const t0 = Math.max(0, V1.copy(EYE).sub(camera.position).dot(CAM_DIR));
    const o = V2.copy(camera.position).addScaledVector(CAM_DIR, t0);
    const hit = G.combat.raycast(o, CAM_DIR, 400, player);
    const target = hit ? hit.point : V3.copy(o).addScaledVector(CAM_DIR, 400);
    AIM_DIR.copy(target).sub(EYE);
    if (AIM_DIR.lengthSq() < 0.25 || AIM_DIR.dot(CAM_DIR) <= 0) AIM_DIR.copy(CAM_DIR);
    else AIM_DIR.normalize();
    return hit;
  }

  function handleShoot() {
    if (!mouseL && !TOUCH.fire) return;
    computeAim();
    player.muzzle(V3);
    if (G.combat.tryFire(player, EYE, AIM_DIR, V3, { spreadMul: ctrl.ads ? 0.45 : 1 })) {
      stats.shots += 1;
    }
  }

  function fallDamage(ch, impact) {
    if (impact > 17) G.combat.damageChar(ch, (impact - 17) * 5, null, false);
    if (impact > 9) G.sound.play('land', ch.pos);
  }

  function updatePlayer(dt, canAct) {
    if (autoPilot) {
      if (canAct) autoPilot.update(dt);
      else autoPilot.wish.set(0, 0, 0);
      ctrl.yaw = G.lerp(ctrl.yaw, ctrl.yaw + G.angleDiff(ctrl.yaw, player.yaw), Math.min(1, dt * 6));
      ctrl.pitch = G.lerp(ctrl.pitch, G.clamp(player.pitch, -0.6, 0.6), Math.min(1, dt * 4));
      fallDamage(player, player.physics(dt, autoPilot.wish, canAct && autoPilot.jump));
      autoPilot.jump = false;
      return;
    }
    player.yaw = ctrl.yaw;
    player.pitch = ctrl.pitch;
    ctrl.wandCd = Math.max(0, ctrl.wandCd - dt);
    if (!player.alive) return;
    const wish = V1.set(0, 0, 0);
    if (canAct) {
      const f = G.forwardFromYaw(ctrl.yaw);
      const rx = Math.cos(ctrl.yaw);
      const rz = -Math.sin(ctrl.yaw);
      if (keys[KB.get('forward')]) wish.set(wish.x + f.x, 0, wish.z + f.z);
      if (keys[KB.get('back')]) wish.set(wish.x - f.x, 0, wish.z - f.z);
      if (keys[KB.get('right')]) wish.set(wish.x + rx, 0, wish.z + rz);
      if (keys[KB.get('left')]) wish.set(wish.x - rx, 0, wish.z - rz);
      // The touch stick is analogue: a light push walks slowly.
      wish.x += f.x * -TOUCH.moveY + rx * TOUCH.moveX;
      wish.z += f.z * -TOUCH.moveY + rz * TOUCH.moveX;
      if (wish.lengthSq() > 1) wish.normalize();
    }
    ctrl.ads = canAct && (mouseR || TOUCH.ads) && ctrl.mode === 'weapon';
    const mul = (player.drinkT > 0 ? 0.45 : 1) * (ctrl.ads ? 0.75 : 1);
    fallDamage(player, player.physics(dt, wish, canAct && (keys[KB.get('jump')] || TOUCH.jump), mul));
    player.building = ctrl.mode === 'build';
    player.wandOut = ctrl.mode === 'wand';
    if (!canAct) {
      G.builds.showGhost(null);
      G.builds.highlight(null);
      return;
    }
    if (ctrl.mode === 'wand') {
      G.builds.showGhost(null);
      handleWand();
      return;
    }
    G.builds.highlight(null);
    if (ctrl.mode === 'build') {
      handleBuild(dt);
    } else {
      G.builds.showGhost(null);
      handleShoot();
    }
  }

  /* Camera ---------------------------------------------------------------- */

  function updateCamera(dt) {
    if (state === 'menu' || state === 'matchEnd') {
      attractA += dt * 0.05;
      camera.position.set(Math.cos(attractA) * 58, 24, Math.sin(attractA) * 58);
      camera.lookAt(0, 6, 0);
      return;
    }
    const fov = ctrl.ads ? 50 : 72;
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov = G.lerp(camera.fov, fov, Math.min(1, dt * 14));
      camera.updateProjectionMatrix();
    }
    const yaw = ctrl.yaw;
    const pitch = ctrl.pitch;
    const pivot = V1.set(player.pos.x, player.pos.y + 1.62, player.pos.z);
    const cp = Math.cos(pitch);
    const fx = -Math.sin(yaw) * cp;
    const fy = Math.sin(pitch);
    const fz = -Math.cos(yaw) * cp;
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    const back = ctrl.ads ? 2 : 3.4;
    const side = ctrl.ads ? 0.65 : 0.8;
    const want = V2.set(pivot.x - fx * back + rx * side, pivot.y - fy * back + 0.3, pivot.z - fz * back + rz * side);
    const dir = V3.copy(want).sub(pivot);
    const len = dir.length();
    dir.divideScalar(len);
    camRay.set(pivot, dir);
    camRay.far = len;
    const hits = camRay.intersectObjects(G.builds.meshes, false);
    let camDist = len;
    if (hits.length) {
      camDist = Math.max(0.3, hits[0].distance - 0.25);
      want.copy(pivot).addScaledVector(dir, camDist);
    }
    // Hide our own armour when a wall squeezes the camera into it.
    player.model.visible = camDist > 1.2;
    want.y = Math.max(0.3, want.y);
    camera.position.copy(want);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
  }

  /* HUD ------------------------------------------------------------------- */

  const hud = {
    hpFill: $('hp-fill'),
    hpText: $('hp-text'),
    wardFill: $('ward-fill'),
    wardText: $('ward-text'),
    ammo0: $('ammo-0'),
    ammo1: $('ammo-1'),
    pot: $('pot-count'),
    wand: $('wand-sub'),
    slots: {
      w0: $('slot-w0'),
      w1: $('slot-w1'),
      pot: $('slot-pot'),
      wall: $('slot-wall'),
      ramp: $('slot-ramp'),
      floor: $('slot-floor'),
      roof: $('slot-roof'),
      wand: $('slot-wand'),
      box: $('slot-box'),
    },
    boxName: $('box-name'),
    crosshair: $('crosshair'),
    hit: $('hitmarker'),
    vignette: $('vignette'),
    dir: $('damage-dir'),
    piece: $('piece-info'),
    status: $('status-line'),
    banner: $('banner'),
    timer: $('round-timer'),
    layer: $('dmg-layer'),
  };
  const cache = {};
  function setText(el, key, v) {
    if (cache[key] === v) return;
    cache[key] = v;
    el.textContent = v;
  }
  function setStyle(el, key, prop, v) {
    if (cache[key] === v) return;
    cache[key] = v;
    el.style[prop] = v;
  }
  function setClass(el, key, cls, on) {
    if (cache[key] === on) return;
    cache[key] = on;
    el.classList.toggle(cls, on);
  }

  const numbers = [];
  function damageNumber(pos, amount, kind) {
    const el = document.createElement('div');
    el.className = `dmg-num ${kind}`;
    el.textContent = Math.round(amount);
    hud.layer.appendChild(el);
    numbers.push({ el, pos: pos.clone().add(new THREE.Vector3(G.rand(-0.3, 0.3), 0, G.rand(-0.3, 0.3))), t: 0 });
  }
  function clearNumbers() {
    for (const n of numbers) n.el.remove();
    numbers.length = 0;
  }

  let hitT = 0;
  let hurtT = 0;
  let dirT = 0;

  function showBanner(html, secs) {
    hud.banner.innerHTML = html;
    hud.banner.classList.add('show');
    bannerT = secs;
  }

  function updateHud(dt) {
    TOUCH.sync({
      mode: ctrl.mode,
      canAds: player.drinkT <= 0,
      hidden: spectating || !(state === 'playing' || state === 'countdown' || state === 'roundEnd'),
    });
    const W = G.WEAPONS;
    setStyle(hud.hpFill, 'hp', 'width', `${player.hp}%`);
    setText(hud.hpText, 'hpt', `Health ${Math.ceil(player.hp)}`);
    setStyle(hud.wardFill, 'wd', 'width', `${player.ward}%`);
    setText(hud.wardText, 'wdt', `Ward ${Math.ceil(player.ward)}`);
    setText(hud.ammo0, 'a0', `${player.ammo[0]} / ${W[0].mag}`);
    setText(hud.ammo1, 'a1', `${player.ammo[1]} / ${W[1].mag}`);
    setText(hud.pot, 'pot', `x${player.potions}`);
    setText(hud.wand, 'wand', ctrl.mode === 'wand' ? 'In hand' : 'Ready');
    setClass(hud.slots.wand, 'swand', 'active', ctrl.mode === 'wand');
    const boxLeft = boxWait();
    setText(hud.boxName, 'box', boxLeft > 0 ? `${Math.ceil(boxLeft)}s` : 'Box');
    setClass(hud.slots.box, 'sbox', 'empty', boxLeft > 0);
    const weapon = ctrl.mode === 'weapon';
    setClass(hud.slots.w0, 's0', 'active', weapon && player.weaponIdx === 0 && player.drinkT <= 0);
    setClass(hud.slots.w1, 's1', 'active', weapon && player.weaponIdx === 1 && player.drinkT <= 0);
    setClass(hud.slots.pot, 'sp', 'active', player.drinkT > 0);
    setClass(hud.slots.pot, 'spe', 'empty', player.potions === 0);
    for (const t of ['wall', 'ramp', 'floor', 'roof']) {
      setClass(hud.slots[t], `b${t}`, 'active', ctrl.mode === 'build' && ctrl.buildType === t);
    }
    setClass(hud.crosshair, 'chb', 'build', !weapon);

    const w = W[player.weaponIdx];
    const moving = Math.hypot(player.vel.x, player.vel.z) > 1;
    const spread = (w.spread + (moving ? w.moveSpread : 0) + (player.onGround ? 0 : w.airSpread)) * (ctrl.ads ? 0.45 : 1);
    const gap = `${Math.round(5 + spread * 420)}px`;
    if (cache.gap !== gap) {
      cache.gap = gap;
      hud.crosshair.style.setProperty('--gap', gap);
    }

    let status = '';
    if (player.reloadT > 0) status = w.reloadText || `Reloading ${w.name}`;
    else if (player.drinkT > 0) status = `Drinking draught ${player.drinkT.toFixed(1)}s`;
    else if (weapon && player.ammo[player.weaponIdx] === 0) {
      status = TOUCH.enabled ? 'Tap reload' : `Press ${KB.label(KB.get('reload'))} to reload`;
    }
    note.t = Math.max(0, note.t - dt);
    if (note.t > 0) status = note.text;
    setText(hud.status, 'st', status);

    // What is under the crosshair?
    let info = '';
    if (state === 'playing' || state === 'countdown') {
      const hit = computeAim();
      if (hit && hit.piece && hit.distance < 60) {
        const p = hit.piece;
        const who = p.owner === 'player' ? 'Your' : 'Rival';
        info = p.fixed ? 'Arena bulwark (unbreakable)' : `${who} ${p.name}  ${Math.max(0, Math.ceil(p.hp))} / ${p.maxHp}`;
        if (p.owner === 'player' && hit.distance < WAND_RANGE + 4) {
          if (ctrl.mode === 'wand') info += TOUCH.enabled ? '  ·  Fire: phase  ·  Aim: solid' : '  ·  Left click: phase  ·  Right click: solid';
          else info += TOUCH.enabled ? '  ·  Wand to phase' : `  ·  ${KB.label(KB.get('wand'))} for the wand`;
        }
      }
    }
    setText(hud.piece, 'pi', info);

    hitT = Math.max(0, hitT - dt);
    setClass(hud.hit, 'hm', 'show', hitT > 0);
    hurtT = Math.max(0, hurtT - dt);
    setStyle(hud.vignette, 'vg', 'opacity', hurtT > 0 ? '0.55' : '0');
    dirT = Math.max(0, dirT - dt);
    setStyle(hud.dir, 'dd', 'opacity', dirT > 0 ? '1' : '0');

    const clock = formatClock(roundT);
    setText(hud.timer, 'timer', clock);
    setClass(hud.timer, 'tlow', 'low', state === 'playing' && roundT <= 10);

    if (bannerT > 0) {
      bannerT -= dt;
      if (bannerT <= 0) hud.banner.classList.remove('show');
    }

    const wpx = window.innerWidth;
    const hpx = window.innerHeight;
    for (let i = numbers.length - 1; i >= 0; i--) {
      const n = numbers[i];
      n.t += dt;
      n.pos.y += dt * 1.1;
      V1.copy(n.pos).project(camera);
      if (n.t > 0.9 || V1.z > 1) {
        n.el.remove();
        numbers.splice(i, 1);
        continue;
      }
      const x = (V1.x * 0.5 + 0.5) * wpx;
      const y = (-V1.y * 0.5 + 0.5) * hpx;
      const s = n.t < 0.1 ? 1.4 - n.t * 4 : 1;
      n.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})`;
      n.el.style.opacity = String(Math.min(1, (0.9 - n.t) * 3));
    }
  }

  /* Game events ----------------------------------------------------------- */

  G.events = {
    // A floor or stair placed through a duellist lifts them on top of it.
    onPlace(piece) {
      player.liftOnto(piece);
      foe.liftOnto(piece);
    },
    // A phased piece turned solid again: same treatment as a new one.
    onSolid(piece) {
      player.liftOnto(piece);
      foe.liftOnto(piece);
    },
    onDamage(target, amount, attacker, head, wardOnly) {
      if (state === 'playing' && attacker && attacker !== target) {
        if (attacker === player) roundDealt.you += amount;
        if (attacker === foe) roundDealt.foe += amount;
      }
      if (attacker === player && target !== player) {
        damageNumber(V1.set(target.pos.x, target.pos.y + 2.1, target.pos.z), amount, head ? 'head' : wardOnly ? 'ward' : 'body');
        hitT = 0.14;
        hud.hit.classList.toggle('head', head);
        stats.hits += 1;
        stats.dealt += amount;
        if (head) stats.heads += 1;
        G.sound.play(head ? 'head' : wardOnly ? 'ward' : 'hit');
      }
      if (target === player && !spectating) {
        hurtT = 0.25;
        G.sound.play('hurt');
        if (attacker) {
          const ya = G.yawFromDir(attacker.pos.x - player.pos.x, attacker.pos.z - player.pos.z);
          const rel = G.angleDiff(ctrl.yaw, ya);
          hud.dir.style.transform = `rotate(${-rel}rad)`;
          dirT = 0.6;
        }
      }
    },
    onBuildDamage(piece, amount, attacker) {
      if (attacker === player && !spectating) damageNumber(G.builds.centre(piece), amount, 'build');
    },
    onDeath(target) {
      if (state !== 'playing') return;
      endRound(target === foe ? 'you' : 'foe', '');
    },
  };

  // Close the round. winner is 'you', 'foe' or null for a draw; reason is
  // an optional line shown above the score (used when time runs out).
  function endRound(winner, reason) {
    if (winner === 'you') score.you += 1;
    if (winner === 'foe') score.foe += 1;
    $('score-you').textContent = score.you;
    $('score-foe').textContent = score.foe;
    state = 'roundEnd';
    roundEndT = 3.2;
    const over = score.you >= WIN_SCORE || score.foe >= WIN_SCORE;
    const tally = over ? 'The duel is decided' : `${score.you} to ${score.foe}`;
    const sub = reason ? `${reason}<br>${tally}` : tally;
    if (!winner) {
      showBanner(`Round drawn<small>${sub}</small>`, 3);
      G.sound.play('beep');
      return;
    }
    const youWon = winner === 'you';
    if (spectating) {
      showBanner(`${youWon ? 'Blue' : 'Red'} takes the round<small>${sub}</small>`, 3);
    } else {
      showBanner(`${youWon ? 'Round won' : 'Round lost'}<small>${sub}</small>`, 3);
    }
    G.sound.play(youWon || spectating ? 'win' : 'lose');
  }

  // Time ran out with both standing: most damage dealt this round wins.
  // A dead heat falls back to whoever has more health and ward left.
  function timeUp() {
    const you = Math.round(roundDealt.you);
    const foeDealt = Math.round(roundDealt.foe);
    const reason = `Time! Damage ${you} to ${foeDealt}`;
    if (you !== foeDealt) {
      endRound(you > foeDealt ? 'you' : 'foe', reason);
      return;
    }
    const youLeft = player.hp + player.ward;
    const foeLeft = foe.hp + foe.ward;
    if (youLeft === foeLeft) {
      endRound(null, reason);
      return;
    }
    endRound(youLeft > foeLeft ? 'you' : 'foe', `${reason}, decided on health`);
  }

  function formatClock(secs) {
    const t = Math.max(0, Math.ceil(secs));
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  }

  /* Rounds ---------------------------------------------------------------- */

  function applyRival(key, char) {
    const d = G.DIFFICULTIES[key];
    char.setPalette(G.PALETTES[d.palette]);
    G.builds.setTint(char === player ? 'player' : 'ai', G.PALETTES[d.palette].glow);
  }

  function startMatch(spectate) {
    G.sound.init();
    spectating = !!spectate;
    const key = spectate ? 'archmage' : settings.difficulty;
    const d = G.DIFFICULTIES[key];
    applyRival(key, foe);
    brain.setDifficulty(key);
    if (spectating) {
      player.setPalette(G.PALETTES.player);
      G.builds.setTint('player', G.PALETTES.player.glow);
      autoPilot = new G.AIBrain(player, foe, 'archmage');
    } else {
      player.setPalette(G.PALETTES.player);
      G.builds.setTint('player', G.PALETTES.player.glow);
      autoPilot = null;
    }
    $('foe-name').textContent = d.title;
    $('hint').textContent = spectating ? 'Spectating: Esc to leave' : 'Esc to pause';
    score.you = 0;
    score.foe = 0;
    $('score-you').textContent = '0';
    $('score-foe').textContent = '0';
    Object.assign(stats, { shots: 0, hits: 0, dealt: 0, builds: 0, heads: 0 });
    round = 1;
    $('menu').classList.add('hidden');
    $('end').classList.add('hidden');
    $('pause').classList.add('hidden');
    $('hud').classList.remove('hidden');
    startRound();
    requestLock();
  }

  function startRound() {
    G.builds.clear();
    G.builds.placeBulwark();
    G.fx.clear();
    G.builds.showGhost(null);
    clearNumbers();
    // Both spawn on the bulwark's centre line, so it blocks their view.
    const mid = (G.builds.bulwark.x0 + G.builds.bulwark.x1) / 2;
    player.reset(mid, 22, 0);
    foe.reset(mid, -22, Math.PI);
    brain.reset();
    if (autoPilot) autoPilot.reset();
    ctrl.yaw = 0;
    ctrl.pitch = -0.05;
    ctrl.mode = 'weapon';
    ctrl.ads = false;
    ctrl.wandCd = 0;
    ctrl.boxAt = undefined;
    state = 'countdown';
    countdownT = 3;
    lastCount = 0;
    roundT = ROUND_TIME;
    roundDealt.you = 0;
    roundDealt.foe = 0;
    $('round-label').textContent = `Round ${round}`;
  }

  // Math questions between rounds (from quiz.js), then the next round or
  // the results. Spectators skip them.
  function afterRound() {
    if (spectating || !G.askRoundQuestions) {
      nextRound();
      return;
    }
    state = 'question';
    for (const k of Object.keys(keys)) keys[k] = false;
    mouseL = false;
    mouseR = false;
    if (document.pointerLockElement) document.exitPointerLock();
    G.askRoundQuestions(ROUND_TIME - roundT).then(() => {
      if (state !== 'question') return;
      nextRound();
      if (state === 'countdown') requestLock();
    });
  }

  function nextRound() {
    if (score.you >= WIN_SCORE || score.foe >= WIN_SCORE) {
      endMatch();
      return;
    }
    round += 1;
    startRound();
  }

  function endMatch() {
    state = 'matchEnd';
    if (document.pointerLockElement) document.exitPointerLock();
    $('hud').classList.add('hidden');
    const won = score.you > score.foe;
    const d = G.DIFFICULTIES[spectating ? 'archmage' : settings.difficulty];
    $('end-title').textContent = spectating ? `${won ? 'Blue' : 'Red'} Archmage wins` : won ? 'Victory' : 'Defeat';
    $('end-sub').textContent = spectating
      ? `Final score ${score.you} to ${score.foe}`
      : `${won ? 'You bested' : 'You fell to'} ${d.title}, ${score.you} to ${score.foe}.`;
    const acc = stats.shots ? Math.round((stats.hits / stats.shots) * 100) : 0;
    $('end-stats').innerHTML = spectating
      ? ''
      : `<div><b>${Math.round(stats.dealt)}</b>Damage dealt</div><div><b>${acc}%</b>Accuracy</div>` +
        `<div><b>${stats.heads}</b>Headshots</div><div><b>${stats.builds}</b>Pieces conjured</div>`;
    $('end').classList.remove('hidden');
  }

  function showPause() {
    if (state === 'paused' || state === 'menu' || state === 'matchEnd') return;
    prevState = state;
    state = 'paused';
    $('pause').classList.remove('hidden');
  }

  function resume() {
    $('pause').classList.add('hidden');
    state = prevState;
    requestLock();
  }

  function toMenu() {
    state = 'menu';
    spectating = false;
    autoPilot = null;
    if (document.pointerLockElement) document.exitPointerLock();
    G.builds.clear();
    G.builds.placeBulwark();
    G.builds.showGhost(null);
    clearNumbers();
    $('pause').classList.add('hidden');
    $('end').classList.add('hidden');
    $('hud').classList.add('hidden');
    $('menu').classList.remove('hidden');
  }

  /* Menu wiring ----------------------------------------------------------- */

  function refreshMenu() {
    document.querySelectorAll('.diff').forEach((b) => {
      b.classList.toggle('selected', b.dataset.diff === settings.difficulty);
    });
    $('sens').value = settings.sens;
    $('sens-out').textContent = Number(settings.sens).toFixed(1);
    $('vol').value = settings.volume;
    $('vol-out').textContent = Math.round(settings.volume * 100);
    $('instant').checked = !!settings.instant;
    G.sound.setVolume(settings.volume);
  }
  document.querySelectorAll('.diff').forEach((b) => {
    b.addEventListener('click', () => {
      settings.difficulty = b.dataset.diff;
      saveSettings();
      refreshMenu();
    });
  });
  $('sens').addEventListener('input', (e) => {
    settings.sens = Number(e.target.value);
    saveSettings();
    refreshMenu();
  });
  $('vol').addEventListener('input', (e) => {
    settings.volume = Number(e.target.value);
    saveSettings();
    refreshMenu();
  });
  // Key bindings: the editor lives in the menu's Controls panel.
  function refreshKeyLabels() {
    document.querySelectorAll('kbd[data-bind]').forEach((k) => {
      k.textContent = KB.short(KB.get(k.dataset.bind));
    });
  }
  KB.buildEditor($('bind-list'), $('bind-note'));
  KB.onChange(() => {
    settings.keys = Object.assign({}, KB.binds);
    saveSettings();
    refreshKeyLabels();
  });
  $('bind-reset').addEventListener('click', () => {
    KB.reset();
    KB.refreshEditor($('bind-list'));
    $('bind-note').textContent = 'Keys reset to the defaults.';
    settings.keys = Object.assign({}, KB.binds);
    saveSettings();
    refreshKeyLabels();
  });
  refreshKeyLabels();
  $('controls-mode').addEventListener('change', (e) => {
    settings.controls = e.target.value;
    TOUCH.setMode(settings.controls);
    saveSettings();
  });
  $('controls-mode').value = settings.controls;

  // Touch controls call back into the same actions the keyboard uses.
  TOUCH.init({
    look(dx, dy) {
      if (!locked || spectating) return;
      const s = 0.0062 * settings.sens * (ctrl.ads ? 0.55 : 1);
      ctrl.yaw -= dx * s;
      ctrl.pitch = G.clamp(ctrl.pitch - dy * s, -1.45, 1.45);
    },
    action(id) {
      if (id === 'pause') {
        showPause();
        return;
      }
      if (!locked || spectating) return;
      if (id === 'toggleBuild') {
        if (ctrl.mode === 'build') selectWeapon(player.weaponIdx);
        else selectBuild(ctrl.buildType);
        return;
      }
      doAction(id);
    },
  });
  $('instant').addEventListener('change', (e) => {
    settings.instant = e.target.checked;
    saveSettings();
  });
  $('start').addEventListener('click', () => startMatch(false));
  $('spectate').addEventListener('click', () => startMatch(true));
  $('resume').addEventListener('click', resume);
  $('quit').addEventListener('click', toMenu);
  $('again').addEventListener('click', () => startMatch(spectating));
  $('to-menu').addEventListener('click', toMenu);
  refreshMenu();
  G.builds.placeBulwark();

  /* Main loop ------------------------------------------------------------- */

  function simulate(dt) {
    G.now += dt;
    if (state === 'countdown') {
      countdownT -= dt;
      const n = Math.ceil(countdownT);
      if (n !== lastCount && n > 0) {
        lastCount = n;
        showBanner(`${n}<small>Round ${round}</small>`, 1.1);
        G.sound.play('beep');
      }
      if (countdownT <= 0) {
        state = 'playing';
        showBanner('Fight!', 0.8);
        G.sound.play('go');
      }
    }
    if (state === 'playing') {
      const before = Math.ceil(roundT);
      roundT -= dt;
      const after = Math.ceil(roundT);
      if (after !== before && after > 0 && after <= 5) G.sound.play('beep');
      if (roundT <= 0) {
        roundT = 0;
        timeUp();
      }
    }
    const canAct = state === 'playing';
    updatePlayer(dt, canAct);
    if (canAct) brain.update(dt);
    else brain.wish.set(0, 0, 0);
    fallDamage(foe, foe.physics(dt, brain.wish, canAct && brain.jump));
    brain.jump = false;
    G.combat.tick(player, dt);
    G.combat.tick(foe, dt);
    G.builds.update(dt);
    G.fx.update(dt);
    player.animate(dt);
    foe.animate(dt);
    if (state === 'roundEnd') {
      roundEndT -= dt;
      if (roundEndT <= 0) afterRound();
    }
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state !== 'paused' && state !== 'menu' && state !== 'matchEnd') simulate(dt);
    world.update(dt, now / 1000);
    updateCamera(dt);
    if (state !== 'menu' && state !== 'matchEnd') updateHud(dt);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  // Small hook for automated checks and curious tinkerers.
  window.SPIRECLASH = {
    get state() {
      return state;
    },
    player,
    foe,
    brain,
    scene,
    camera,
    renderer,
    score,
    get autoPilot() {
      return autoPilot;
    },
    startMatch,
    simulate(dt) {
      simulate(dt);
      updateCamera(dt);
    },
    G,
    // Drive the real input handlers without a pointer lock (used by tests).
    input: {
      ctrl,
      play() {
        $('pause').classList.add('hidden');
        if (state === 'paused') state = prevState;
        locked = true;
      },
      key(code) {
        keys[code] = true;
        onKey(code);
      },
      release(code) {
        keys[code] = false;
      },
      mouse(left, right) {
        mouseL = !!left;
        mouseR = !!right;
      },
    },
  };
})();

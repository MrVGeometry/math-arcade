/**
 * Spireclash AI. A brain drives a Character through the same movement,
 * weapons and building rules as the player. Three difficulty profiles tune
 * reaction time, aim, build speed and which building techniques it knows:
 *
 *  - Squire: walks at you, shoots loosely, sometimes throws up a wall.
 *  - Knight: walls when struck, ramp-rushes for height, boxes up to heal,
 *    shoots out the stairs you stand on.
 *  - Archmage: champion-level piece control. Instant walls, spiralling
 *    "nineties" to claim and retake high ground, side walls on every stair,
 *    cones over its head, box repairs, predictive tracking and headshots.
 *
 * Knights and Archmages also carry the phase wand: they phase their own wall
 * to peek and shoot through it, and phase a wall that traps them to walk out.
 */
(function () {
  'use strict';
  const G = window.G;
  const C = G.CELL;
  const H = G.LEVEL_H;
  const E = new THREE.Vector3();
  const D = new THREE.Vector3();
  const TIP = new THREE.Vector3();
  const SEEN = new THREE.Vector3();

  G.DIFFICULTIES = {
    squire: {
      key: 'squire',
      name: 'Squire',
      title: 'Bramble the Squire',
      palette: 'squire',
      reaction: 0.55,
      aimErr: 0.06,
      track: 3.5,
      fireTol: 0.12,
      fireMul: 1.7,
      buildInterval: 0.6,
      wallOnHit: 0.3,
      // Chance per check (every couple of seconds in a fight) to raise its own cover.
      cover: 0.25,
      rampRush: false,
      nineties: false,
      box: false,
      sideWalls: false,
      cone: false,
      healBelow: 70,
      strafe: 0.35,
      shootBuilds: 0.25,
      shootSupport: 0,
      jumpChance: 0.1,
      range: [9, 20],
      headBias: 0,
      predictive: false,
      rushSteps: 2,
      think: 0.15,
      switchDelay: 0.5,
      scatterRange: 7,
      wand: 0,
    },
    knight: {
      key: 'knight',
      name: 'Knight',
      title: 'Ser Varrick',
      palette: 'knight',
      reaction: 0.3,
      aimErr: 0.028,
      track: 7,
      fireTol: 0.07,
      fireMul: 1.2,
      buildInterval: 0.22,
      wallOnHit: 0.75,
      cover: 0.6,
      rampRush: true,
      nineties: false,
      box: true,
      sideWalls: false,
      cone: false,
      healBelow: 100,
      strafe: 0.7,
      shootBuilds: 0.7,
      shootSupport: 0.5,
      jumpChance: 0.25,
      range: [7, 16],
      headBias: 0.15,
      predictive: false,
      rushSteps: 3,
      think: 0.1,
      switchDelay: 0.3,
      scatterRange: 8,
      wand: 0.35,
    },
    archmage: {
      key: 'archmage',
      name: 'Archmage',
      title: 'Morvane the Archmage',
      palette: 'archmage',
      reaction: 0.14,
      aimErr: 0.011,
      track: 16,
      fireTol: 0.035,
      fireMul: 1,
      buildInterval: 0.07,
      wallOnHit: 1,
      cover: 0.9,
      rampRush: true,
      nineties: true,
      box: true,
      sideWalls: true,
      cone: true,
      healBelow: 130,
      strafe: 1,
      shootBuilds: 1,
      shootSupport: 1,
      jumpChance: 0.5,
      range: [5, 13],
      headBias: 0.45,
      predictive: true,
      rushSteps: 6,
      think: 0.05,
      switchDelay: 0.12,
      scatterRange: 9,
      wand: 0.85,
    },
  };

  function inGrid(i, j) {
    return i >= G.GRID_MIN && i <= G.GRID_MAX && j >= G.GRID_MIN && j <= G.GRID_MAX;
  }

  class AIBrain {
    constructor(ch, target, key) {
      this.ch = ch;
      this.target = target;
      this.owner = ch.isAI ? 'ai' : 'player';
      this.wish = new THREE.Vector3();
      this.queue = [];
      this.history = [];
      this.dmgLog = [];
      this.lastModeEnd = {};
      this.setDifficulty(key);
      this.reset();
    }

    setDifficulty(key) {
      this.p = G.DIFFICULTIES[key];
    }

    reset() {
      const ch = this.ch;
      this.mode = 'engage';
      this.modeT = 0;
      this.queue.length = 0;
      this.history.length = 0;
      this.dmgLog.length = 0;
      this.lastModeEnd = {};
      this.buildCd = 0;
      this.thinkT = 0;
      this.aimYaw = ch.yaw;
      this.aimPitch = 0;
      this.seed = Math.random() * 100;
      this.strafeDir = Math.random() < 0.5 ? 1 : -1;
      this.strafeSwitch = 0;
      this.hurtHandled = ch.lastHurt;
      this.lowHandled = ch.lastLowHit === undefined ? -99 : ch.lastLowHit;
      this.lastWallT = -99;
      this.lastCoverT = 0;
      this.holdUntil = 0;
      this.stuckT = 0;
      this.focusPiece = null;
      this.focusUntil = 0;
      this.wandReadyAt = 0;
      this.los = false;
      this.lastSeen = -99;
      this.acquireAt = 0;
      this.blockPiece = null;
      this.jump = false;
      this.aimHead = false;
      this.nextSwitch = 0;
      this.hd = 99;
      this.dy = 0;
      this.boxSpecs = null;
      this.boxCell = null;
      this.bestY = 0;
      this.progressT = 0;
      this.modeStartY = 0;
      this.climbDir = 0;
      this.turn = 1;
      this.climbGoal = 0;
      this.climbStartLevel = 0;
      this.blockedTries = 0;
      this.descDir = null;
      this.bigDrop = false;
      this.lastEhp = ch.hp + ch.ward;
      this.wish.set(0, 0, 0);
    }

    /* State helpers -------------------------------------------------------- */

    setMode(m) {
      if (this.mode === m) return;
      this.lastModeEnd[this.mode] = G.now;
      this.mode = m;
      this.modeT = 0;
      this.queue.length = 0;
      this.modeStartY = this.ch.pos.y;
      this.bestY = this.ch.pos.y;
      this.progressT = 0;
      this.boxSpecs = null;
      if (m === 'nineties' || m === 'rampRush') this.initClimb();
    }

    initClimb() {
      const ch = this.ch;
      const t = this.target;
      this.climbDir = G.cardinal(t.pos.x - ch.pos.x, t.pos.z - ch.pos.z);
      this.turn = Math.random() < 0.5 ? 1 : -1;
      this.climbStartLevel = Math.round(ch.pos.y / H);
      this.climbGoal = Math.max(t.pos.y + H * 1.3, ch.pos.y + H * 2);
      this.blockedTries = 0;
    }

    standInfo() {
      const ch = this.ch;
      const gp = ch.groundPiece;
      if (gp && gp.alive && gp.type === 'ramp' && ch.onGround) {
        return { ramp: gp, progress: G.builds.rampProgress(gp, ch.pos.x, ch.pos.z), level: gp.k };
      }
      return { ramp: null, progress: 0, level: Math.max(0, Math.round(ch.pos.y / H)) };
    }

    want(spec) {
      if (!G.builds.inBounds(spec) || G.builds.get(spec)) return;
      const key = G.builds.keyOf(spec);
      if (this.queue.some((q) => G.builds.keyOf(q) === key)) return;
      if (this.queue.length < 12) this.queue.push(spec);
    }

    recentDamage(windowS) {
      let sum = 0;
      for (const e of this.dmgLog) if (G.now - e.t <= windowS) sum += e.a;
      return sum;
    }

    wantsHeal() {
      const ch = this.ch;
      return ch.potions > 0 && ch.hp < 100 && ch.hp + ch.ward < this.p.healBelow;
    }

    recordHistory() {
      const t = this.target;
      const h = this.history;
      h.push({
        t: G.now,
        x: t.pos.x,
        y: t.pos.y,
        z: t.pos.z,
        vx: t.vel.x,
        vy: t.vel.y,
        vz: t.vel.z,
        grounded: t.onGround,
      });
      while (h.length > 1 && h[1].t <= G.now - this.p.reaction) h.shift();
    }

    // Where the AI believes its target is: a snapshot one reaction time old,
    // extrapolated forward if the profile is predictive.
    perceived() {
      const s = this.history[0];
      if (!s) return SEEN.copy(this.target.pos);
      const lead = this.p.predictive ? Math.min(0.3, G.now - s.t) * 0.9 : 0;
      return SEEN.set(s.x + s.vx * lead, s.y + (s.grounded ? 0 : s.vy * lead * 0.5), s.z + s.vz * lead);
    }

    checkLos() {
      const ch = this.ch;
      const t = this.target;
      ch.eye(E);
      this.blockPiece = null;
      for (const hgt of [1.1, 1.66]) {
        D.set(t.pos.x, t.pos.y + hgt, t.pos.z).sub(E);
        const dist = D.length();
        D.divideScalar(dist);
        const hit = G.combat.raycast(E, D, dist + 0.5, ch);
        if (hit && hit.char === t) return true;
        if (hit && hit.piece && !this.blockPiece) this.blockPiece = hit.piece;
      }
      return false;
    }

    visible(piece) {
      this.ch.eye(E);
      G.builds.centre(piece, D).sub(E);
      const dist = D.length();
      D.divideScalar(dist);
      const hit = G.combat.raycast(E, D, dist + 0.5, this.ch);
      return !!(hit && hit.piece === piece);
    }

    // Remove one of our own pieces (the stand-in for an edit).
    dispel(piece) {
      if (piece && piece.alive && piece.owner === this.owner) G.builds.destroy(piece, true);
    }

    // Is there a solid piece at body height around (x, z)?
    blockedAt(x, z, near) {
      const ch = this.ch;
      const r = ch.radius;
      for (const p of near) {
        if (!p.solid) continue;
        const b = p.aabb;
        if (x + r <= b.min.x || x - r >= b.max.x || z + r <= b.min.z || z - r >= b.max.z) continue;
        if (b.max.y > ch.pos.y + G.STEP && b.min.y < ch.pos.y + ch.height) return true;
      }
      return false;
    }

    focus(piece, secs) {
      this.focusPiece = piece;
      this.focusUntil = G.now + secs;
    }

    pieceAhead() {
      const ch = this.ch;
      if (this.wish.lengthSq() < 0.01) return null;
      E.set(ch.pos.x, ch.pos.y + 1, ch.pos.z);
      D.copy(this.wish).setY(0).normalize();
      const hit = G.combat.raycast(E, D, 1.6, ch);
      return hit && hit.piece ? hit.piece : null;
    }

    // Wall on the edge of our cell that faces the target.
    wallTowardTarget() {
      const ch = this.ch;
      const t = this.target;
      const info = this.standInfo();
      const d = G.cardinal(t.pos.x - ch.pos.x, t.pos.z - ch.pos.z);
      let ci = Math.floor(ch.pos.x / C);
      let cj = Math.floor(ch.pos.z / C);
      let L = info.level;
      if (info.ramp) {
        const r = info.ramp;
        ci = r.i;
        cj = r.j;
        L = r.k + (info.progress > 0.5 ? 1 : 0);
        // Never wall across the path the climb is about to take.
        const next = this.mode === 'nineties' ? (r.dir + this.turn + 4) % 4 : r.dir;
        if ((this.mode === 'nineties' || this.mode === 'rampRush') && d === next) L = r.k;
      }
      this.want(G.builds.wallSpec(ci, cj, d, L));
    }

    /* Main loop ------------------------------------------------------------ */

    update(dt) {
      const ch = this.ch;
      const t = this.target;
      if (!ch.alive || !t.alive) {
        this.wish.set(0, 0, 0);
        return;
      }
      this.recordHistory();
      this.modeT += dt;
      this.thinkT -= dt;
      if (this.thinkT <= 0) {
        this.thinkT = this.p.think;
        this.think();
      }
      this.processQueue(dt);
      this.aimAndShoot(dt);
    }

    think() {
      const ch = this.ch;
      const t = this.target;
      this.hd = Math.hypot(t.pos.x - ch.pos.x, t.pos.z - ch.pos.z);
      this.dy = t.pos.y - ch.pos.y;
      const wasLos = this.los;
      this.los = this.checkLos();
      if (this.los) {
        if (!wasLos) this.acquireAt = G.now + this.p.reaction * 0.8;
        this.lastSeen = G.now;
      }
      const ehp = ch.hp + ch.ward;
      if (ehp < this.lastEhp) this.dmgLog.push({ t: G.now, a: this.lastEhp - ehp });
      this.lastEhp = ehp;
      while (this.dmgLog.length && G.now - this.dmgLog[0].t > 3) this.dmgLog.shift();

      const climbing = this.mode === 'nineties' || this.mode === 'rampRush' || this.mode === 'highground';
      if (climbing && ch.onGround && ch.pos.y < this.bestY - 2.5) {
        // Our structure was shot out from under us.
        this.setMode('engage');
      }
      if (ch.lastHurt > this.hurtHandled && G.now - ch.lastHurt >= this.p.reaction) {
        this.hurtHandled = ch.lastHurt;
        this.onHurt();
      }
      if (ch.lastLowHit > this.lowHandled && G.now - ch.lastLowHit >= this.p.reaction * 0.7) {
        this.lowHandled = ch.lastLowHit === undefined ? -99 : ch.lastLowHit;
        this.onLowHit();
      }

      switch (this.mode) {
        case 'rampRush':
          this.thinkClimb(false);
          break;
        case 'nineties':
          this.thinkClimb(true);
          break;
        case 'highground':
          this.thinkHigh();
          break;
        case 'box':
          this.thinkBox();
          break;
        case 'heal':
          this.thinkHeal();
          break;
        case 'descend':
          this.thinkDescend();
          break;
        default:
          this.thinkEngage();
          break;
      }
      this.wandPeek();
      this.updateFocus();
      this.edgeSafety();
    }

    // Phase one of our own pieces (the stand-in for an edit). Returns success.
    usePhase(piece) {
      if (!piece || piece.owner !== this.owner || G.now < this.wandReadyAt) return false;
      if (!G.builds.phase(piece)) return false;
      this.wandReadyAt = G.now + 1.2;
      return true;
    }

    // Our own wall hides a target we saw a moment ago: phase it and shoot through.
    wandPeek() {
      const p = this.p;
      const piece = this.blockPiece;
      if (!p.wand || this.los || !piece || piece.type !== 'wall') return;
      if (this.mode === 'box' || this.mode === 'heal' || G.now - this.lastSeen > 4) return;
      this.ch.eye(E);
      if (G.builds.centre(piece, D).distanceTo(E) > 7) return;
      if (Math.random() < p.wand * p.think * 6) this.usePhase(piece);
    }

    onHurt() {
      const p = this.p;
      if (this.mode === 'box' || this.mode === 'heal') return;
      if (this.mode === 'engage') {
        if (p.nineties && this.hd < 30) this.setMode('nineties');
        else if (p.rampRush && this.hd < 28 && Math.random() < 0.55) this.setMode('rampRush');
      } else if (this.mode === 'highground' && p.nineties && this.recentDamage(2) > 45) {
        this.setMode('nineties');
      }
      if (Math.random() < p.wallOnHit && G.now - this.lastWallT > 0.5) {
        this.wallTowardTarget();
        this.lastWallT = G.now;
        // Take cover behind it for a moment rather than walking straight out.
        this.holdUntil = G.now + G.rand(0.6, 1.4);
      }
    }

    // Shot in the feet or shins: never stand and take it. Jump, wall off the
    // low line and the level above it, and climb if it knows how.
    onLowHit() {
      const p = this.p;
      const ch = this.ch;
      const t = this.target;
      this.jump = true;
      if (this.mode === 'heal') return;
      if (this.mode === 'box') {
        // Something has opened the box low down: rebuild it.
        this.boxSpecs = null;
        return;
      }
      if (this.mode === 'engage' && p.rampRush && this.hd < 30) this.setMode(p.nineties ? 'nineties' : 'rampRush');
      const info = this.standInfo();
      const d = G.cardinal(t.pos.x - ch.pos.x, t.pos.z - ch.pos.z);
      const ci = info.ramp ? info.ramp.i : Math.floor(ch.pos.x / C);
      const cj = info.ramp ? info.ramp.j : Math.floor(ch.pos.z / C);
      const L = info.ramp ? info.ramp.k : info.level;
      this.want(G.builds.wallSpec(ci, cj, d, L));
      this.want(G.builds.wallSpec(ci, cj, d, L + 1));
      this.lastWallT = G.now;
    }

    // Steering away from the arena bulwark: a push out of its surroundings,
    // and, when it stands between us and the target, a detour round its
    // nearer end instead of up to its face. Returns [x, z] or null.
    bulwarkSteer() {
      const b = G.builds.bulwark;
      const ch = this.ch;
      const t = this.target;
      const side = Math.sign(ch.pos.z - b.z) || -Math.sign(t.pos.z - b.z) || 1;
      const near = ch.pos.x > b.x0 - 4 && ch.pos.x < b.x1 + 4 && Math.abs(ch.pos.z - b.z) < 7;
      const across = Math.sign(t.pos.z - b.z) !== side;
      if (!across && !near) return null;
      // Where the straight line to the target crosses the bulwark's line.
      const k = (b.z - ch.pos.z) / (t.pos.z - ch.pos.z || 1e-6);
      const crossX = ch.pos.x + (t.pos.x - ch.pos.x) * k;
      const blocked = across && crossX > b.x0 - 2 && crossX < b.x1 + 2;
      let gx = 0;
      let gz = 0;
      if (blocked) {
        const endX = ch.pos.x < (b.x0 + b.x1) / 2 ? b.x0 - 6 : b.x1 + 6;
        gx = endX - ch.pos.x;
        gz = b.z + side * 3 - ch.pos.z;
        const gl = Math.hypot(gx, gz) || 1;
        gx /= gl;
        gz /= gl;
      }
      if (near) gz += side * 0.8;
      return [gx, gz];
    }

    thinkEngage() {
      const ch = this.ch;
      const t = this.target;
      const p = this.p;
      if (this.wantsHeal() && (p.box || !this.los || G.now - ch.lastHurt > 1.5)) {
        this.setMode(p.box ? 'box' : 'heal');
        return;
      }
      const sinceNineties = G.now - (this.lastModeEnd.nineties || -99);
      if (p.nineties && this.hd < 24 && ch.pos.y < t.pos.y + H * 0.75 && sinceNineties > 1.2 && this.modeT > 0.3) {
        this.setMode('nineties');
        return;
      }
      const sinceRush = G.now - (this.lastModeEnd.rampRush || -99);
      if (p.rampRush && this.dy > H * 0.8 && this.hd < 26 && sinceRush > 2) {
        this.setMode('rampRush');
        return;
      }
      if (!this.los && ch.pos.y > t.pos.y + H * 1.5 && G.now - this.lastSeen > 2 && this.modeT > 1) {
        this.setMode('descend');
        return;
      }
      if (p.cone && this.dy > H * 0.6 && this.hd < 8) {
        const info = this.standInfo();
        const ci = info.ramp ? info.ramp.i : Math.floor(ch.pos.x / C);
        const cj = info.ramp ? info.ramp.j : Math.floor(ch.pos.z / C);
        this.want({ type: 'roof', i: ci, j: cj, k: info.level + 1 });
      }

      const dx = t.pos.x - ch.pos.x;
      const dz = t.pos.z - ch.pos.z;
      const len = Math.max(0.001, this.hd);
      const tx = dx / len;
      const tz = dz / len;
      const [rmin, rmax] = p.range;
      let wx = 0;
      let wz = 0;
      if (!this.los || this.hd > rmax) {
        wx = tx;
        wz = tz;
        const steer = this.bulwarkSteer();
        if (steer) {
          wx = steer[0] || wx * 0.3;
          wz = steer[1];
        }
      } else if (this.hd < rmin) {
        wx = -tx * 0.6;
        wz = -tz * 0.6;
      }
      if (this.los && p.strafe > 0) {
        if (G.now > this.strafeSwitch) {
          this.strafeDir *= -1;
          this.strafeSwitch = G.now + G.rand(0.35, 1.1) / (0.5 + p.strafe);
        }
        wx += -tz * this.strafeDir * p.strafe;
        wz += tx * this.strafeDir * p.strafe;
      } else if (!this.los && this.blockPiece && this.blockPiece.owner === this.owner) {
        // Our own wall is in the way: walk round it.
        wx += -tz * this.strafeDir;
        wz += tx * this.strafeDir;
      }
      // Fresh cover just went up: hold behind it for a moment.
      if (!this.los && G.now < this.holdUntil) {
        wx *= 0.1;
        wz *= 0.1;
      }
      // In a fight, raise its own cover now and then.
      if (this.los && G.now - this.lastCoverT > 2.2) {
        this.lastCoverT = G.now;
        if (Math.random() < p.cover && G.now - this.lastWallT > 0.8) {
          this.wallTowardTarget();
          this.lastWallT = G.now;
          this.holdUntil = G.now + G.rand(0.4, 1);
        }
      }
      const wl = Math.hypot(wx, wz);
      if (wl > 1) {
        wx /= wl;
        wz /= wl;
      }
      this.wish.set(wx, 0, wz);
      if (this.los && Math.random() < p.jumpChance * p.think) this.jump = true;

      const speed = Math.hypot(ch.vel.x, ch.vel.z);
      if (wl > 0.3 && speed < 0.8 && ch.onGround) this.stuckT += p.think;
      else this.stuckT = 0;
      if (this.stuckT > 0.45) {
        this.stuckT = 0;
        this.jump = true;
        const blocker = this.pieceAhead();
        if (blocker && blocker.owner === this.owner) {
          // Walk through our own wall if the wand is ready; otherwise remove it.
          if (!(p.wand && blocker.type === 'wall' && this.usePhase(blocker))) this.dispel(blocker);
        } else if (blocker && !blocker.fixed && Math.random() < p.shootBuilds) {
          this.focus(blocker, 2);
        } else if (blocker && p.rampRush) {
          this.setMode('rampRush');
          this.climbDir = G.cardinal(wx, wz);
        } else {
          this.strafeDir *= -1;
        }
      }
    }

    // Shared by ramp rushes (straight line) and nineties (spiral).
    thinkClimb(nineties) {
      const ch = this.ch;
      const t = this.target;
      const p = this.p;
      if (ch.pos.y > this.bestY + 0.4) {
        this.bestY = ch.pos.y;
        this.progressT = 0;
      } else {
        this.progressT += p.think;
      }
      if (this.progressT > 1.8) {
        this.setMode('engage');
        return;
      }
      this.climbGoal = Math.max(this.climbGoal, t.pos.y + H * 1.3);
      const level = Math.round(ch.pos.y / H);
      const done = nineties
        ? ch.pos.y >= Math.min(this.climbGoal, t.pos.y + H * 2.5)
        : ch.pos.y >= t.pos.y + H || level - this.climbStartLevel >= p.rushSteps;
      if ((done && this.modeT > 0.5) || level >= G.MAX_LEVEL - 1) {
        this.setMode('highground');
        return;
      }
      if (this.wantsHeal() && p.box && this.recentDamage(1.5) > 0) {
        this.setMode('box');
        return;
      }
      const info = this.standInfo();
      let wx = 0;
      let wz = 0;
      if (info.ramp) {
        const r = info.ramp;
        const d = r.dir;
        const dv = G.DIRS[d];
        if (nineties) {
          let d2 = (d + this.turn + 4) % 4;
          let mi = r.i + G.DIRS[d2].x;
          let mj = r.j + G.DIRS[d2].z;
          if (!inGrid(mi, mj)) {
            this.turn = -this.turn;
            d2 = (d + this.turn + 4) % 4;
            mi = r.i + G.DIRS[d2].x;
            mj = r.j + G.DIRS[d2].z;
          }
          const L = r.k + 1;
          if (!inGrid(mi, mj) || L > G.MAX_LEVEL) {
            this.setMode('highground');
            return;
          }
          const slot = G.builds.get({ type: 'ramp', i: mi, j: mj, k: L });
          if (slot && !(slot.type === 'ramp' && slot.dir === d2)) {
            this.setMode('engage');
            return;
          }
          if (info.progress > 0.15) {
            this.want({ type: 'ramp', i: mi, j: mj, k: L, dir: d2 });
            this.want(G.builds.wallSpec(r.i, r.j, d, L));
            if (p.sideWalls) this.want(G.builds.wallSpec(mi, mj, d, L));
          }
          const d2v = G.DIRS[d2];
          if (info.progress < 0.86) {
            wx = dv.x + d2v.x * 0.25;
            wz = dv.z + d2v.z * 0.25;
          } else {
            wx = d2v.x + dv.x * 0.15;
            wz = d2v.z + dv.z * 0.15;
          }
        } else {
          const ni = r.i + dv.x;
          const nj = r.j + dv.z;
          const L = r.k + 1;
          if (!inGrid(ni, nj) || L > G.MAX_LEVEL) {
            this.setMode('highground');
            return;
          }
          const slot = G.builds.get({ type: 'ramp', i: ni, j: nj, k: L });
          if (slot && !(slot.type === 'ramp' && slot.dir === d)) {
            this.setMode('engage');
            return;
          }
          if (info.progress > 0.2) {
            this.want({ type: 'ramp', i: ni, j: nj, k: L, dir: d });
            this.want(G.builds.wallSpec(ni, nj, d, L));
            if (p.sideWalls) {
              this.want(G.builds.wallSpec(ni, nj, (d + 1) % 4, L));
              this.want(G.builds.wallSpec(ni, nj, (d + 3) % 4, L));
            }
          }
          wx = dv.x;
          wz = dv.z;
          // Keep to the middle of the stair so we do not slip off a side.
          if (dv.x !== 0) wz -= (ch.pos.z - (r.j * C + C / 2)) * 0.4;
          else wx -= (ch.pos.x - (r.i * C + C / 2)) * 0.4;
        }
      } else {
        const d = this.climbDir;
        const dv = G.DIRS[d];
        const ci = Math.floor(ch.pos.x / C);
        const cj = Math.floor(ch.pos.z / C);
        const ni = ci + dv.x;
        const nj = cj + dv.z;
        const L = info.level;
        if (!inGrid(ni, nj)) {
          this.climbDir = G.cardinal(-ch.pos.x, -ch.pos.z);
          return;
        }
        // Walled in front: stair up inside our own cell, over the wall.
        const front = G.builds.get(G.builds.wallSpec(ci, cj, d, L));
        if (front) {
          this.dispel(G.builds.get({ type: 'floor', i: ci, j: cj, k: L + 1 }));
          const own = { type: 'ramp', i: ci, j: cj, k: L, dir: d };
          const there = G.builds.get(own);
          if (there && !(there.type === 'ramp' && there.dir === d)) {
            this.dispel(front);
            return;
          }
          // Step back to the foot of the stair before conjuring it.
          const prog = G.builds.rampProgress({ i: ci, j: cj, dir: d }, ch.pos.x, ch.pos.z);
          if (!there && prog > 0.15) {
            this.wish.set(-dv.x, 0, -dv.z);
            return;
          }
          this.want(own);
          if (there) this.wish.set(dv.x, 0, dv.z);
          else this.wish.set(0, 0, 0);
          return;
        }
        const spec = { type: 'ramp', i: ni, j: nj, k: L, dir: d };
        const slot = G.builds.get(spec);
        if (slot && !(slot.type === 'ramp' && slot.dir === d)) {
          this.climbDir = (d + 1) % 4;
          this.blockedTries += 1;
          if (this.blockedTries > 3) this.setMode('engage');
          return;
        }
        this.want(spec);
        if (!nineties) this.want(G.builds.wallSpec(ni, nj, d, L));
        // Do not walk into the next cell until the stair exists.
        if (slot) {
          wx = dv.x;
          wz = dv.z;
        }
        if (dv.x !== 0) wz -= (ch.pos.z - (cj * C + C / 2)) * 0.4;
        else wx -= (ch.pos.x - (ci * C + C / 2)) * 0.4;
      }
      const wl = Math.hypot(wx, wz);
      if (wl > 1) this.wish.set(wx / wl, 0, wz / wl);
      else this.wish.set(wx, 0, wz);
    }

    thinkHigh() {
      const ch = this.ch;
      const t = this.target;
      const p = this.p;
      this.wish.set(0, 0, 0);
      if (ch.onGround && ch.pos.y < this.modeStartY - 2.5) {
        this.setMode('engage');
        return;
      }
      // At the build ceiling a ninety cannot climb, so never bounce into one.
      const capped = ch.pos.y >= (G.MAX_LEVEL - 2) * H;
      if (!capped && p.nineties && t.pos.y > ch.pos.y - H * 0.6 && this.hd < 26 && this.modeT > 0.4) {
        this.setMode('nineties');
        return;
      }
      if (this.wantsHeal()) {
        this.setMode(p.box ? 'box' : 'heal');
        return;
      }
      // Finish climbing the stair we are on before holding the height.
      const info = this.standInfo();
      if (info.ramp && info.progress < 0.8) {
        const dv = G.DIRS[info.ramp.dir];
        this.wish.set(dv.x, 0, dv.z);
      }
      // Our own walls hide the target: take one more ninety to peek over them.
      const blind = !this.los && G.now - this.lastSeen > 0.6 && this.modeT > 0.6;
      if (blind && G.now - this.lastSeen > 2 && (capped || ch.pos.y > t.pos.y + H * 1.5)) {
        this.setMode('descend');
        return;
      }
      if (blind && p.nineties && info.ramp && ch.pos.y < t.pos.y + H * 2.5 && Math.round(ch.pos.y / H) < 8) {
        this.setMode('nineties');
        this.climbGoal = ch.pos.y + H * 0.9;
        return;
      }
      const patience = p.nineties ? 2.5 : 3.5;
      if (!this.los && G.now - this.lastSeen > patience && this.modeT > patience) {
        this.setMode('engage');
        return;
      }
      if (p.cone && this.dy > 1 && this.hd < 9) {
        const info = this.standInfo();
        const ci = info.ramp ? info.ramp.i : Math.floor(ch.pos.x / C);
        const cj = info.ramp ? info.ramp.j : Math.floor(ch.pos.z / C);
        this.want({ type: 'roof', i: ci, j: cj, k: info.level + 1 });
      }
      if (this.los && Math.random() < p.jumpChance * p.think * 0.5) this.jump = true;
    }

    makeBox() {
      const ch = this.ch;
      const t = this.target;
      const info = this.standInfo();
      let ci = Math.floor(ch.pos.x / C);
      let cj = Math.floor(ch.pos.z / C);
      let L = info.level;
      let levels = [L];
      let roof = L + 1;
      if (info.ramp) {
        ci = info.ramp.i;
        cj = info.ramp.j;
        L = info.ramp.k;
        levels = [L, L + 1];
        roof = L + 2;
      }
      const dT = G.cardinal(t.pos.x - ch.pos.x, t.pos.z - ch.pos.z);
      const order = [dT, (dT + 1) % 4, (dT + 3) % 4, (dT + 2) % 4];
      const specs = [];
      for (const lv of levels) for (const d of order) specs.push(G.builds.wallSpec(ci, cj, d, lv));
      specs.push({ type: 'floor', i: ci, j: cj, k: roof });
      this.boxCell = { i: ci, j: cj, ramp: !!info.ramp };
      this.boxSpecs = specs.filter((s) => G.builds.inBounds(s));
    }

    thinkBox() {
      const ch = this.ch;
      const p = this.p;
      if (!this.boxSpecs) this.makeBox();
      const bc = this.boxCell;
      const cx = bc.i * C + C / 2;
      const cz = bc.j * C + C / 2;
      const ox = cx - ch.pos.x;
      const oz = cz - ch.pos.z;
      const off = Math.hypot(ox, oz);
      this.wish.set(0, 0, 0);
      if (!bc.ramp && off > 0.5) this.wish.set(ox / off, 0, oz / off).multiplyScalar(Math.min(1, off));
      // Repair any wall the enemy shoots out.
      for (const s of this.boxSpecs) this.want(s);
      const complete = this.boxSpecs.every((s) => G.builds.get(s));
      const ehp = ch.hp + ch.ward;
      const goal = Math.min(200, p.healBelow + 40);
      if (complete && ch.drinkT <= 0 && ehp < goal) G.combat.startDrink(ch);
      const finished = ch.drinkT <= 0 && (ch.potions === 0 || ehp >= goal || !G.combat.canDrink(ch));
      if ((finished && this.modeT > 0.6) || this.modeT > 9) {
        const roof = this.boxSpecs[this.boxSpecs.length - 1];
        this.dispel(G.builds.get(roof));
        this.setMode(p.nineties ? 'nineties' : 'engage');
      }
    }

    // Walk back down our own structure: greedy downhill steps.
    thinkDescend() {
      const ch = this.ch;
      const t = this.target;
      if ((this.los && this.modeT > 0.3) || ch.pos.y <= t.pos.y + H * 1.2 || this.modeT > 8) {
        this.setMode('engage');
        return;
      }
      let best = null;
      let bestScore = Infinity;
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        const dx = Math.cos(ang);
        const dz = Math.sin(ang);
        const px = ch.pos.x + dx * 0.6;
        const pz = ch.pos.z + dz * 0.6;
        const near = G.builds.collidersNear(px, pz, this.owner);
        if (this.blockedAt(px, pz, near)) continue;
        if (ch.groundAt(px, pz, ch.pos.y + 3, near).h > ch.pos.y + 0.05) continue;
        const h = ch.groundAt(px, pz, ch.pos.y + 0.05, near).h;
        const drop = ch.pos.y - h;
        if (drop < 0.02 || drop > 1.2) continue;
        const keep = this.descDir ? dx * this.descDir.x + dz * this.descDir.z : 0;
        const score = h - keep * 0.3;
        if (score < bestScore) {
          bestScore = score;
          best = { x: dx, z: dz };
        }
      }
      if (best) {
        this.descDir = best;
        this.wish.set(best.x, 0, best.z);
        this.bigDrop = false;
        return;
      }
      // Nowhere gentle to go: hop down toward the target if it will not hurt much.
      const l = Math.max(0.001, this.hd);
      this.wish.set((t.pos.x - ch.pos.x) / l, 0, (t.pos.z - ch.pos.z) / l);
      this.bigDrop = ch.hp > 60;
    }

    thinkHeal() {
      const ch = this.ch;
      const t = this.target;
      if (ch.drinkT <= 0) {
        const quiet = !this.los || G.now - ch.lastHurt > 1.5;
        if (!(quiet && G.combat.startDrink(ch)) && this.modeT > 0.5) {
          this.setMode('engage');
          return;
        }
      }
      const dx = ch.pos.x - t.pos.x;
      const dz = ch.pos.z - t.pos.z;
      const l = Math.max(0.001, Math.hypot(dx, dz));
      this.wish.set((dx / l) * 0.6, 0, (dz / l) * 0.6);
    }

    updateFocus() {
      const ch = this.ch;
      const t = this.target;
      const p = this.p;
      if (this.focusPiece && (!this.focusPiece.alive || G.now > this.focusUntil)) this.focusPiece = null;
      if (this.focusPiece) return;
      const gp = t.groundPiece;
      const above = t.pos.y - ch.pos.y > H * 0.5;
      if (p.shootSupport > 0 && gp && gp.alive && !gp.fixed && gp.owner !== this.owner && above && this.hd < 30) {
        // Shoot out the stair or floor the target is standing on.
        const eager = p.shootSupport >= 1 && t.pos.y - ch.pos.y > H && gp.hp < 150;
        if ((!this.los || eager) && Math.random() < p.shootSupport && this.visible(gp)) {
          this.focus(gp, 2.5);
          return;
        }
      }
      const breakable = this.blockPiece && !this.blockPiece.fixed;
      if (!this.los && breakable && this.blockPiece.owner !== this.owner && this.hd < 22) {
        if (Math.random() < p.shootBuilds * p.think * 4) this.focus(this.blockPiece, 2);
      }
    }

    edgeSafety() {
      const ch = this.ch;
      const w = this.wish;
      if (w.lengthSq() < 0.01 || !ch.onGround) return;
      const climbing = this.mode === 'nineties' || this.mode === 'rampRush';
      const look = climbing ? 0.4 : 0.75;
      const px = ch.pos.x + w.x * look;
      const pz = ch.pos.z + w.z * look;
      const near = G.builds.collidersNear(px, pz, this.owner);
      // Something just above our feet ahead is a step or an obstacle, not a cliff.
      if (ch.groundAt(px, pz, ch.pos.y + 3, near).h > ch.pos.y + 0.05) return;
      const g = ch.groundAt(px, pz, ch.pos.y + G.STEP, near);
      const drop = ch.pos.y - g.h;
      let allow = this.mode === 'engage' && ch.hp > 70 ? H * 2.2 : 1.6;
      if (this.mode === 'descend') allow = this.bigDrop ? H * 2.2 : 1.3;
      if (drop > allow) w.set(0, 0, 0);
    }

    processQueue(dt) {
      this.buildCd -= dt;
      while (this.queue.length && this.buildCd <= 0) {
        const s = this.queue.shift();
        if (G.builds.get(s) || !G.builds.canPlace(s)) continue;
        G.builds.place(s, this.owner);
        this.buildCd += this.p.buildInterval * G.rand(0.85, 1.15);
      }
      if (this.buildCd < 0) this.buildCd = 0;
    }

    /* Aim and fire --------------------------------------------------------- */

    aimAndShoot(dt) {
      const ch = this.ch;
      const t = this.target;
      const p = this.p;
      ch.eye(E);
      let shooting = false;
      const s = this.perceived();
      if (this.focusPiece) {
        G.builds.centre(this.focusPiece, D);
        shooting = true;
      } else {
        D.set(s.x, s.y + (this.aimHead ? 1.64 : 1.1), s.z);
        shooting = this.los && G.now >= this.acquireAt;
      }
      D.sub(E);
      const dist = D.length();
      const desiredYaw = G.yawFromDir(D.x, D.z);
      const desiredPitch = Math.atan2(D.y, Math.hypot(D.x, D.z));
      const k = 1 - Math.exp(-p.track * dt);
      this.aimYaw += G.angleDiff(this.aimYaw, desiredYaw) * k;
      this.aimPitch += (desiredPitch - this.aimPitch) * k;
      ch.yaw = this.aimYaw;
      ch.pitch = this.aimPitch;
      if (ch.drinkT > 0) return;

      const wantIdx = dist < p.scatterRange ? 1 : 0;
      if (wantIdx !== ch.weaponIdx && G.now > this.nextSwitch) {
        G.combat.switchWeapon(ch, wantIdx, p.switchDelay);
        this.nextSwitch = G.now + 0.4;
      }
      if (!shooting) {
        if (ch.ammo[ch.weaponIdx] < G.WEAPONS[ch.weaponIdx].mag * 0.5) G.combat.startReload(ch);
        return;
      }
      const err = Math.abs(G.angleDiff(this.aimYaw, desiredYaw)) + Math.abs(desiredPitch - this.aimPitch);
      if (err > p.fireTol) return;

      // Smooth wandering aim error, worse against a target on the move.
      const n = G.now + this.seed;
      const targetSpeed = Math.hypot(t.vel.x, t.vel.z) + Math.abs(t.vel.y) * 0.5;
      const amp = this.focusPiece ? p.aimErr * 0.5 : p.aimErr * (1 + Math.min(1.5, targetSpeed / 6) * 0.6);
      const ny = ((Math.sin(n * 1.7) + 0.6 * Math.sin(n * 4.3 + 1.1)) / 1.6) * amp;
      const np = ((Math.sin(n * 1.3 + 2) + 0.6 * Math.sin(n * 3.1 + 0.4)) / 1.6) * amp;
      const dir = G.dirFromYawPitch(this.aimYaw + ny, this.aimPitch + np, D);
      ch.muzzle(TIP);
      if (G.combat.tryFire(ch, E, dir, TIP, { mul: p.fireMul })) {
        this.aimHead = Math.random() < p.headBias;
      }
    }
  }

  G.AIBrain = AIBrain;
})();

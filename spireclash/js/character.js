/**
 * Spireclash characters: palettes for the armoured duellists (the model
 * itself lives in models.js), plus the shared movement controller (walking, jumping, stairs, step-ups and
 * collision with conjured pieces). The player and every AI use the same code.
 */
(function () {
  'use strict';
  const G = window.G;
  const GRAV = 24;
  // Jump height grows with the square of take-off speed: this is 10% higher
  // than the original 8 units per second, then another 5% on top.
  const JUMP_V = 8 * Math.sqrt(1.1 * 1.05);
  // How fast a duellist rises onto a floor or stair placed under them.
  const LIFT_SPEED = 9;
  const SPEED = 6.4;
  const SNAP = 0.75;
  const HEIGHT = 1.8;
  const RADIUS = 0.35;
  // Defeat bow: hip height the upper body pivots on, and how far it bends.
  const BOW_HIP = 0.9;
  const BOW_ANGLE = 0.75;
  // Right-handed stance: the body turns this far (radians) so the left
  // shoulder leads, while head and weapon arm turn back to aim dead ahead.
  const TWIST = 0.32;
  // Where the Fire Blast pouch rests in the hand (firebag.js).
  const BAG_Y = -0.6;
  // Shots leave from the right shoulder: this far right of the eye, and
  // at this height above the feet.
  const SHOT_RIGHT = 0.34;
  const SHOT_HEIGHT = 1.45;
  const SHOT_DIR = new THREE.Vector3();

  // Each rival shares the concept-art base model with its own colours and
  // details: helm style, plume or horns, spike count, heraldry and runes.
  G.PALETTES = {
    player: {
      key: 'player',
      armour: 0x9aa1ab,
      plate: 0xb4bac3,
      trim: 0xc8952f,
      cloth: 0x8e1c22,
      dark: 0x2b2f37,
      glow: 0x46c3ff,
      field: 0x2449a0,
      emblem: 0xeadcb4,
      charge: 'lion',
      spikes: 2,
    },
    squire: {
      key: 'squire',
      armour: 0x8a6a45,
      plate: 0x9c7a50,
      trim: 0xa8783a,
      cloth: 0x3f6b2a,
      dark: 0x3a2c1e,
      leather: 0x4a3220,
      glow: 0xffb13b,
      field: 0x3f6b2a,
      emblem: 0xe8c66a,
      charge: 'oak',
      helm: 'kettle',
      shield: 'round',
      pauldron: 0.8,
      spikes: 0,
      capeLength: 0.75,
    },
    knight: {
      key: 'knight',
      armour: 0x6e747e,
      plate: 0x868c96,
      trim: 0xcfd3da,
      cloth: 0x1e1a1c,
      dark: 0x1c1e23,
      glow: 0xff4136,
      field: 0x9c1b22,
      emblem: 0xdfe3ea,
      charge: 'tower',
      plume: 0xb3262b,
      bothEyes: true,
      spikes: 3,
    },
    archmage: {
      key: 'archmage',
      armour: 0x2a2233,
      plate: 0x382d45,
      trim: 0xb08a3e,
      cloth: 0x3b145c,
      dark: 0x0d0b10,
      leather: 0x2a1a2e,
      glow: 0xc26bff,
      field: 0x1b0f2e,
      emblem: 0xc26bff,
      charge: 'star',
      horns: true,
      bothEyes: true,
      runes: true,
      spikes: 1,
      pauldron: 1.15,
      capeLength: 1.25,
    },
  };

  function overlapsH(x, z, r, b) {
    return x + r > b.min.x && x - r < b.max.x && z + r > b.min.z && z - r < b.max.z;
  }

  class Character {
    constructor(scene, opts) {
      this.scene = scene;
      this.isAI = !!opts.isAI;
      this.name = opts.name;
      this.pos = new THREE.Vector3();
      this.vel = new THREE.Vector3();
      this.yaw = 0;
      this.pitch = 0;
      this.onGround = true;
      this.groundPiece = null;
      this.radius = RADIUS;
      this.height = HEIGHT;
      this.walkPhase = 0;
      this.deathT = 0;
      this.recoil = 0;
      this.throwT = 0;
      this.building = false;
      this.liftPiece = null;
      const inv = new THREE.MeshBasicMaterial({ visible: false });
      // Round hit volumes, kept just inside the collision radius, so no
      // corner of them can poke through a wall the knight stands against.
      this.hitBody = new THREE.Mesh(new THREE.CylinderGeometry(RADIUS - 0.02, RADIUS - 0.02, 1.4, 16), inv);
      this.hitBody.position.y = 0.7;
      this.hitBody.userData = { char: this, head: false };
      this.hitHead = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.46, 16), inv);
      this.hitHead.position.y = 1.66;
      this.hitHead.userData = { char: this, head: true };
      this.setPalette(opts.palette);
      this.resetStats();
    }

    setPalette(pal) {
      if (this.model) {
        this.scene.remove(this.model);
        this.model.traverse((m) => {
          if (m.isMesh && m !== this.hitBody && m !== this.hitHead) {
            m.geometry.dispose();
            for (const mat of [].concat(m.material)) mat.dispose();
          }
        });
      }
      this.pal = pal;
      this.parts = G.buildKnightModel(pal);
      this.model = this.parts.root;
      this.model.add(this.hitBody, this.hitHead);
      this.scene.add(this.model);
    }

    resetStats() {
      this.hp = 100;
      this.ward = 50;
      this.alive = true;
      this.potions = 2;
      this.weaponIdx = 0;
      this.ammo = G.WEAPONS.map((w) => w.mag);
      this.fireCd = 0;
      this.reloadT = 0;
      this.drinkT = 0;
      this.switchT = 0;
      this.lastHurt = -99;
      this.lastLowHit = -99;
      this.lastAttacker = null;
    }

    reset(x, z, yaw) {
      this.pos.set(x, 0, z);
      this.vel.set(0, 0, 0);
      this.yaw = yaw;
      this.pitch = 0;
      this.onGround = true;
      this.groundPiece = null;
      this.deathT = 0;
      this.liftPiece = null;
      this.resetStats();
      this.model.visible = true;
      this.model.rotation.set(0, yaw, 0);
      this.animate(0);
    }

    eye(out) {
      return out.set(this.pos.x, this.pos.y + 1.55, this.pos.z);
    }

    /**
     * Where a shot starts: the right shoulder, so a right-handed duellist
     * can fire past the right edge of cover with only the shoulder clear.
     * If a build stands between eye and shoulder (hugging a wall on the
     * right), it fires from the eye instead, so no shot starts inside cover.
     */
    shotOrigin(out) {
      this.eye(out);
      SHOT_DIR.set(Math.cos(this.yaw) * SHOT_RIGHT, SHOT_HEIGHT - 1.55, -Math.sin(this.yaw) * SHOT_RIGHT);
      const len = SHOT_DIR.length();
      SHOT_DIR.divideScalar(len);
      if (G.builds.pick(out, SHOT_DIR, len + 0.1)) return out;
      return out.addScaledVector(SHOT_DIR, len);
    }

    /**
     * Firing flourishes. Water Bolt: the gloved hand shakes as the bolt
     * leaves it. Fire Blast: the pouch is flung forwards, tumbling, and
     * snaps back to the hand.
     */
    animateCast(dt) {
      const P = this.parts;
      const r = this.recoil;
      P.bow.rotation.set(Math.sin(G.now * 75) * 0.22 * r, 0, Math.cos(G.now * 60) * 0.22 * r);
      this.throwT = Math.max(0, this.throwT - dt);
      const k = 1 - this.throwT / G.THROW_TIME;
      const out = this.throwT > 0 ? Math.sin(Math.PI * k) : 0;
      // Out along the arm and lofted a little upwards (-z).
      P.staff.position.y = BAG_Y - out * 0.75;
      P.staff.position.z = -out * 0.18;
      P.staff.rotation.x = this.throwT > 0 ? -Math.PI * 2 * k : 0;
      // The arm flicks forwards and down with the throw.
      if (this.weaponIdx === 1) P.armR.rotation.x -= out * 0.35;
    }

    muzzle(out) {
      const tip = this.weaponIdx === 0 ? this.parts.bowTip : this.parts.staffTip;
      return tip.getWorldPosition(out);
    }

    // Surface height of a floor or stair at (x, z), or null off its footprint.
    surfaceOf(p, x, z) {
      if (!p.solid) return G.builds.slopeHeight(p, x, z);
      return overlapsH(x, z, this.radius * 0.7, p.aabb) ? p.aabb.max.y : null;
    }

    // A piece just appeared. If it is one of our own and cuts through our
    // body, we end up on top of it rather than built over: floors, stairs
    // and spires lift us all the way onto their surface, and walls nudge us
    // out to the side we were mostly on. A rival's floor or stair only lifts
    // us when its surface is within our height, as before.
    liftOnto(p) {
      if (!this.alive) return;
      const own = p.owner === (this.isAI ? 'ai' : 'player');
      const b = p.aabb;
      const throughBody = b.min.y < this.pos.y + HEIGHT - 0.05 && b.max.y > this.pos.y + 0.001;
      if (p.type === 'wall') {
        // Anyone's wall placed through us: step out to the side we were on,
        // so we are never left standing inside it.
        if (throughBody && overlapsH(this.pos.x, this.pos.z, this.radius, b)) this.stepOutOf(b, p.axis);
        return;
      }
      const top = this.surfaceOf(p, this.pos.x, this.pos.z);
      if (top === null || top <= this.pos.y + 0.001) return;
      const reach = own ? (throughBody ? G.LEVEL_H + 0.5 : 0) : HEIGHT * 0.95;
      if (top - this.pos.y >= reach) return;
      this.liftPiece = p;
    }

    // Slide sideways out of a wall's thickness, to whichever face is nearer.
    stepOutOf(b, axis) {
      const r = this.radius + 0.02;
      if (axis === 'x') {
        const mid = (b.min.x + b.max.x) / 2;
        this.pos.x = this.pos.x < mid ? b.min.x - r : b.max.x + r;
      } else {
        const mid = (b.min.z + b.max.z) / 2;
        this.pos.z = this.pos.z < mid ? b.min.z - r : b.max.z + r;
      }
    }

    // Carry a lift on towards the piece's surface. True while still rising.
    updateLift(dt) {
      const p = this.liftPiece;
      const top = p && p.alive && !(p.phaseT > 0) ? this.surfaceOf(p, this.pos.x, this.pos.z) : null;
      if (top === null || top <= this.pos.y) {
        this.liftPiece = null;
        return false;
      }
      this.pos.y = Math.min(top, this.pos.y + LIFT_SPEED * dt);
      this.vel.y = 0;
      this.onGround = true;
      this.groundPiece = p;
      if (this.pos.y >= top) this.liftPiece = null;
      return true;
    }

    // Highest walkable surface under (x, z) that is no higher than maxTop.
    groundAt(x, z, maxTop, near) {
      const list = near || G.builds.collidersNear(x, z, this.owner());
      const r = this.radius * 0.7;
      let h = 0;
      let piece = null;
      for (const p of list) {
        let top;
        if (p.solid) {
          if (!overlapsH(x, z, r, p.aabb)) continue;
          top = p.aabb.max.y;
        } else {
          top = G.builds.slopeHeight(p, x, z);
          if (top === null) continue;
        }
        if (top <= maxTop && top > h) {
          h = top;
          piece = p;
        }
      }
      return { h, piece };
    }

    // Which side's pieces are ours: 'ai' or 'player'.
    owner() {
      return this.isAI ? 'ai' : 'player';
    }

    moveAxis(axis, delta, near) {
      if (delta === 0) return;
      const nx = axis === 'x' ? this.pos.x + delta : this.pos.x;
      const nz = axis === 'z' ? this.pos.z + delta : this.pos.z;
      const feet = this.pos.y;
      const r = this.radius;
      for (const p of near) {
        if (p.solid) {
          const b = p.aabb;
          if (feet >= b.max.y - 0.001 || feet + HEIGHT <= b.min.y) continue;
          if (!overlapsH(nx, nz, r, b)) continue;
          if (b.max.y - feet <= G.STEP) continue;
          // Already inside it (a piece was placed on top of us): we may walk
          // out through the nearer face, but never on through the piece.
          if (overlapsH(this.pos.x, this.pos.z, r, b)) {
            const mid = axis === 'x' ? (b.min.x + b.max.x) / 2 : (b.min.z + b.max.z) / 2;
            if (Math.sign(delta) === Math.sign(this.pos[axis] - mid)) continue;
          }
          this.vel[axis] = 0;
          return;
        }
        const hN = G.builds.slopeHeight(p, nx, nz);
        if (hN === null) continue;
        if (hN - feet <= G.STEP || hN >= feet + HEIGHT - 0.05) continue;
        const hO = G.builds.slopeHeight(p, this.pos.x, this.pos.z);
        if (hO !== null && hO - feet > G.STEP && hO < feet + HEIGHT) continue;
        this.vel[axis] = 0;
        return;
      }
      this.pos[axis] += delta;
    }

    ceiling(prevFeet, near) {
      for (const p of near) {
        if (!p.solid) continue;
        const b = p.aabb;
        if (!overlapsH(this.pos.x, this.pos.z, this.radius * 0.9, b)) continue;
        if (prevFeet + HEIGHT <= b.min.y + 0.02 && this.pos.y + HEIGHT > b.min.y) {
          this.pos.y = b.min.y - HEIGHT;
          this.vel.y = 0;
        }
      }
    }

    // Returns the landing speed when touching down, for fall damage.
    physics(dt, wish, jump, speedMul) {
      if (!this.alive) return 0;
      const sp = SPEED * (speedMul || 1);
      const accel = this.onGround ? 55 : 16;
      this.vel.x = G.moveTowards(this.vel.x, wish.x * sp, accel * dt);
      this.vel.z = G.moveTowards(this.vel.z, wish.z * sp, accel * dt);
      if (jump && this.onGround) {
        this.vel.y = JUMP_V;
        this.onGround = false;
        this.groundPiece = null;
      }
      this.vel.y = Math.max(-45, this.vel.y - GRAV * dt);
      const near = G.builds.collidersNear(this.pos.x, this.pos.z, this.owner());
      this.moveAxis('x', this.vel.x * dt, near);
      this.moveAxis('z', this.vel.z * dt, near);
      if (this.liftPiece && this.updateLift(dt)) return 0;
      const prevFeet = this.pos.y;
      const wasGround = this.onGround;
      this.pos.y += this.vel.y * dt;
      if (this.vel.y > 0) this.ceiling(prevFeet, near);
      const reach = Math.max(prevFeet, this.pos.y) + (wasGround ? G.STEP : 0.05);
      const g = this.groundAt(this.pos.x, this.pos.z, reach, near);
      let impact = 0;
      if (this.pos.y <= g.h) {
        if (!wasGround) impact = -this.vel.y;
        this.pos.y = g.h;
        this.vel.y = 0;
        this.onGround = true;
        this.groundPiece = g.piece;
      } else if (wasGround && this.vel.y <= 0 && this.pos.y - g.h < SNAP) {
        this.pos.y = g.h;
        this.vel.y = 0;
        this.onGround = true;
        this.groundPiece = g.piece;
      } else {
        this.onGround = false;
        this.groundPiece = null;
      }
      const lim = G.ARENA - this.radius;
      this.pos.x = G.clamp(this.pos.x, -lim, lim);
      this.pos.z = G.clamp(this.pos.z, -lim, lim);
      return impact;
    }

    /**
     * Defeat: rather than falling over, the knight takes a courtly bow.
     * The upper body bends forward at the hip while the legs stay planted,
     * the head dips, the weapon hand sweeps to the waist and the shield arm
     * swings out behind.
     */
    animateBow(dt) {
      const P = this.parts;
      this.deathT += dt;
      // Ease out over about half a second, then hold the bow.
      const t = Math.min(1, this.deathT * 2);
      const f = 1 - (1 - t) * (1 - t);
      const a = BOW_ANGLE * f;
      // The root pivots at the feet, so shift it to keep the hip fixed.
      const back = BOW_HIP * Math.sin(a);
      this.model.position.set(
        this.pos.x + back * Math.sin(this.yaw),
        this.pos.y + BOW_HIP * (1 - Math.cos(a)),
        this.pos.z + back * Math.cos(this.yaw)
      );
      this.model.rotation.set(-a, this.yaw, 0);
      // Counter the bend so the legs stay upright under the hip.
      P.legL.rotation.x = a;
      P.legR.rotation.x = a;
      P.armR.rotation.set(1.0 * f, 0, -0.9 * f);
      P.armL.rotation.set(-0.3 * f, 0, -0.6 * f);
      P.head.rotation.set(-0.35 * f, 0, 0);
      P.potion.visible = false;
      P.ring.visible = false;
      if (P.capeStrips) G.flutterClassicCape(P, 0, true, G.now);
      else G.updateCape(P.cape, dt, G.now, { f: 0, side: 0, air: false, legL: a, legR: a });
      if (P.tabard) G.updateTabard(P.tabard, dt, G.now, { fwd: 0, side: 0, air: false, legL: a, legR: a });
      this.model.updateMatrixWorld(true);
    }

    /** Cape and tabard: simulated cloth in high graphics, simple flutter in classic. */
    animateCloth(dt, f, twist) {
      const P = this.parts;
      if (P.capeStrips) {
        G.flutterClassicCape(P, f, this.onGround, G.now);
        return;
      }
      // Cape billow: forward speed lifts it out behind, strafing swings it.
      const cy = Math.cos(this.yaw - twist);
      const sy = Math.sin(this.yaw - twist);
      G.updateCape(P.cape, dt, G.now, {
        f,
        side: (this.vel.x * cy - this.vel.z * sy) / SPEED,
        air: !this.onGround,
        legL: P.legL.rotation.x,
        legR: P.legR.rotation.x,
      });
      // Tabard: forward speed streams the back panel, backing up the front.
      G.updateTabard(P.tabard, dt, G.now, {
        fwd: -(this.vel.x * sy + this.vel.z * cy) / SPEED,
        side: (this.vel.x * cy - this.vel.z * sy) / SPEED,
        air: !this.onGround,
        legL: P.legL.rotation.x,
        legR: P.legR.rotation.x,
      });
    }

    animate(dt) {
      const P = this.parts;
      this.model.position.copy(this.pos);
      if (!this.alive) {
        this.animateBow(dt);
        return;
      }
      P.ring.visible = true;
      const speed = Math.hypot(this.vel.x, this.vel.z);
      const f = Math.min(1, speed / SPEED);
      if (f > 0.05) this.walkPhase += dt * (3 + speed * 1.4);
      const s = Math.sin(this.walkPhase) * 0.8 * f;
      if (this.onGround) {
        P.legL.rotation.x = s;
        P.legR.rotation.x = -s;
      } else {
        P.legL.rotation.x = -0.5;
        P.legR.rotation.x = 0.3;
      }
      this.recoil = Math.max(0, this.recoil - dt * 6);
      const aim = Math.PI / 2 + this.pitch + this.recoil * 0.35;
      // Square up a little when running so the legs stay pointed forwards.
      const twist = TWIST * (1 - f * 0.6);
      const drinking = this.drinkT > 0;
      if (drinking) {
        P.armR.rotation.set(2.4, twist, 0.5);
        P.armL.rotation.set(s * 0.5, 0, 0);
      } else if (this.building) {
        P.armR.rotation.set(aim, twist, 0);
        P.armL.rotation.set(aim + 0.35, twist, 0.15);
      } else {
        // Spell hand or pouch held out on the right, the left arm raised
        // in a loose guard.
        P.armR.rotation.set(aim, twist, 0);
        P.armL.rotation.set(0.9 + s * 0.3, twist - 0.4, 0.15);
      }
      this.animateCast(dt);
      P.head.rotation.set(this.pitch * 0.6, twist, 0);
      this.animateCloth(dt, f, twist);
      const wand = !!this.wandOut;
      P.bow.visible = !drinking && !wand && this.weaponIdx === 0;
      // The glove replaces the armoured fist rather than being held in it.
      P.armR.userData.hand.visible = !P.bow.visible;
      P.staff.visible = !drinking && !wand && this.weaponIdx === 1;
      P.wand.visible = !drinking && wand;
      P.potion.visible = drinking;
      this.model.rotation.set(0, this.yaw - twist, 0);
      this.model.updateMatrixWorld(true);
    }
  }

  G.Character = Character;
  G.CHAR = { HEIGHT, RADIUS, SPEED };
})();

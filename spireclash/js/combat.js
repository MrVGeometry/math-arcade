/**
 * Spireclash combat: the two weapons, hitscan shots, damage to duellists and
 * pieces, the healing draught, and the short-lived visual effects (bolts,
 * sparks and falling rubble).
 */
(function () {
  'use strict';
  const G = window.G;

  G.WEAPONS = [
    {
      id: 'bow',
      name: 'Runebow',
      dmg: 34,
      head: 2,
      interval: 0.36,
      mag: 10,
      reload: 1.7,
      pellets: 1,
      spread: 0.004,
      moveSpread: 0.012,
      airSpread: 0.045,
      range: 250,
      falloff: null,
      sound: 'bow',
      width: 0.05,
    },
    {
      id: 'scatter',
      name: 'Dragonbreath',
      dmg: 11,
      head: 1.5,
      interval: 0.85,
      mag: 5,
      reload: 2.1,
      pellets: 9,
      spread: 0.075,
      moveSpread: 0.01,
      airSpread: 0.03,
      range: 40,
      falloff: [6, 22, 0.3],
      sound: 'scatter',
      width: 0.025,
    },
  ];
  G.DRAUGHT = { time: 2, heal: 50 };

  const ray = new THREE.Raycaster();
  const chars = [];
  const tmpU = new THREE.Vector3();
  const tmpV = new THREE.Vector3();
  const tmpD = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  function setChars(list) {
    chars.length = 0;
    chars.push(...list);
  }

  // First thing hit along a ray: a piece, a duellist or the ground.
  function raycast(origin, dir, maxDist, ignore) {
    ray.set(origin, dir);
    ray.far = maxDist;
    const objs = G.builds.meshes.slice();
    for (const c of chars) {
      if (c !== ignore && c.alive) objs.push(c.hitBody, c.hitHead);
    }
    const hits = ray.intersectObjects(objs, false);
    const best = hits[0];
    const groundT = dir.y < -1e-6 ? -origin.y / dir.y : Infinity;
    if (best && best.distance <= groundT) {
      const ud = best.object.userData;
      return {
        point: best.point,
        distance: best.distance,
        piece: ud.piece || null,
        char: ud.char || null,
        head: !!ud.head,
      };
    }
    if (groundT <= maxDist) {
      return {
        point: origin.clone().addScaledVector(dir, groundT),
        distance: groundT,
        ground: true,
      };
    }
    return null;
  }

  function perturb(dir, spread, out) {
    if (spread <= 0) return out.copy(dir);
    tmpU.copy(Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP).cross(dir).normalize();
    tmpV.copy(dir).cross(tmpU).normalize();
    const a = spread * Math.sqrt(Math.random());
    const th = Math.random() * Math.PI * 2;
    out.copy(dir).multiplyScalar(Math.cos(a));
    out.addScaledVector(tmpU, Math.cos(th) * Math.sin(a));
    out.addScaledVector(tmpV, Math.sin(th) * Math.sin(a));
    return out.normalize();
  }

  function falloff(w, d) {
    if (!w.falloff) return 1;
    const [a, b, min] = w.falloff;
    if (d <= a) return 1;
    if (d >= b) return min;
    return G.lerp(1, min, (d - a) / (b - a));
  }

  function damageChar(target, amount, attacker, head) {
    if (!target.alive || amount <= 0) return;
    const total = Math.round(amount);
    const absorbed = Math.min(target.ward, total);
    target.ward -= absorbed;
    target.hp -= total - absorbed;
    target.lastHurt = G.now;
    target.lastAttacker = attacker;
    if (G.events && G.events.onDamage) {
      G.events.onDamage(target, total, attacker, head, absorbed === total);
    }
    if (target.hp <= 0) {
      target.hp = 0;
      target.alive = false;
      if (G.events && G.events.onDeath) G.events.onDeath(target, attacker);
    }
  }

  function fire(shooter, origin, dir, spread, fxFrom) {
    const w = G.WEAPONS[shooter.weaponIdx];
    const totals = new Map();
    const colour = w.id === 'bow' ? shooter.pal.glow : 0xff9a3c;
    for (let n = 0; n < w.pellets; n++) {
      perturb(dir, spread, tmpD);
      const hit = raycast(origin, tmpD, w.range, shooter);
      const end = (hit ? hit.point : origin.clone().addScaledVector(tmpD, w.range)).clone();
      let spark = null;
      if (hit) spark = hit.char ? [0xff4060, 3] : hit.piece ? [0xe8dcc0, 3] : [0x9a8a62, 2];
      const showSpark = () => {
        if (spark) G.fx.sparks(end, spark[0], spark[1]);
      };
      // The runebow looses a visible bolt (sparks when it lands, and it
      // sticks where it hits cover); other weapons draw a tracer.
      if (w.id === 'bow') {
        G.fx.bolt(fxFrom, end, colour, shooter.pal.cloth, showSpark, !!hit && !hit.char);
      } else if (w.id === 'scatter') {
        // Dragonbreath: every pellet a burning streak of fire.
        G.fx.firePellet(fxFrom, end, showSpark);
      } else {
        G.fx.tracer(fxFrom, end, colour, w.width);
        showSpark();
      }
      if (!hit) continue;
      const mul = falloff(w, hit.distance);
      if (hit.char) {
        // Struck in the feet or shins: the AI reacts to this specially.
        if (hit.point.y - hit.char.pos.y < 0.75) hit.char.lastLowHit = G.now;
        const e = totals.get(hit.char) || { dmg: 0, head: false };
        e.dmg += w.dmg * mul * (hit.head ? w.head : 1);
        e.head = e.head || hit.head;
        totals.set(hit.char, e);
      } else if (hit.piece) {
        G.builds.damage(hit.piece, w.dmg * mul, shooter);
      }
    }
    for (const [c, e] of totals) damageChar(c, e.dmg, shooter, e.head);
  }

  function tryFire(ch, origin, dir, fxFrom, opts) {
    const o = opts || {};
    if (!ch.alive || ch.fireCd > 0 || ch.reloadT > 0 || ch.drinkT > 0 || ch.switchT > 0) return false;
    const idx = ch.weaponIdx;
    const w = G.WEAPONS[idx];
    if (ch.ammo[idx] <= 0) {
      startReload(ch);
      return false;
    }
    ch.ammo[idx] -= 1;
    ch.fireCd = w.interval * (o.mul || 1);
    const moving = Math.hypot(ch.vel.x, ch.vel.z) > 1;
    let spread = w.spread + (moving ? w.moveSpread : 0) + (ch.onGround ? 0 : w.airSpread);
    spread *= o.spreadMul || 1;
    fire(ch, origin, dir, spread, fxFrom);
    ch.recoil = 1;
    G.sound.play(w.sound, ch.pos);
    G.fx.flash(fxFrom, w.id === 'bow' ? ch.pal.glow : 0xff8a2a);
    if (w.id === 'scatter') G.fx.fireBlast(fxFrom, dir);
    if (ch.ammo[idx] === 0) startReload(ch);
    return true;
  }

  function startReload(ch) {
    const w = G.WEAPONS[ch.weaponIdx];
    if (ch.reloadT > 0 || ch.ammo[ch.weaponIdx] >= w.mag || ch.drinkT > 0) return;
    ch.reloadT = w.reload;
    G.sound.play('reload', ch.pos);
  }

  function switchWeapon(ch, idx, delay) {
    cancelDrink(ch);
    if (ch.weaponIdx === idx) return;
    ch.weaponIdx = idx;
    ch.reloadT = 0;
    ch.switchT = delay === undefined ? 0.2 : delay;
  }

  function canDrink(ch) {
    return ch.alive && ch.potions > 0 && ch.drinkT <= 0 && (ch.hp < 100 || ch.ward < 100);
  }

  function startDrink(ch) {
    if (!canDrink(ch)) return false;
    ch.drinkT = G.DRAUGHT.time;
    ch.reloadT = 0;
    G.sound.play('drink', ch.pos);
    return true;
  }

  function cancelDrink(ch) {
    ch.drinkT = 0;
  }

  function heal(ch, amount) {
    const toHp = Math.min(amount, 100 - ch.hp);
    ch.hp += toHp;
    ch.ward = Math.min(100, ch.ward + (amount - toHp));
  }

  function tick(ch, dt) {
    if (!ch.alive) return;
    if (ch.fireCd > 0) ch.fireCd -= dt;
    if (ch.switchT > 0) ch.switchT -= dt;
    if (ch.reloadT > 0) {
      ch.reloadT -= dt;
      if (ch.reloadT <= 0) {
        ch.reloadT = 0;
        ch.ammo[ch.weaponIdx] = G.WEAPONS[ch.weaponIdx].mag;
      }
    }
    if (ch.drinkT > 0) {
      ch.drinkT -= dt;
      if (ch.drinkT <= 0) {
        ch.drinkT = 0;
        ch.potions -= 1;
        heal(ch, G.DRAUGHT.heal);
        G.sound.play('heal', ch.pos);
      }
    }
  }

  G.combat = {
    setChars,
    raycast,
    damageChar,
    tryFire,
    startReload,
    switchWeapon,
    canDrink,
    startDrink,
    cancelDrink,
    tick,
  };

  /* ---------------------------------------------------------------------- */
  /* Effects                                                                 */
  /* ---------------------------------------------------------------------- */

  let scene = null;
  const live = [];
  const tracerGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
  tracerGeo.translate(0, 0.5, 0);
  tracerGeo.rotateX(Math.PI / 2);
  const sparkGeo = new THREE.SphereGeometry(0.045, 8, 6);
  const chunkGeo = G.roundedBox(1, 1, 1, 0.3, 2);
  const flashGeo = new THREE.SphereGeometry(0.16, 16, 12);
  const DEBRIS_COLOUR = { wall: 0x8a8274, floor: 0x7c766a, ramp: 0x8a8274, roof: 0x3a4258 };

  function add(objs, mat, life, step) {
    for (const o of objs) scene.add(o);
    live.push({ objs, mat, life, t: 0, step });
  }

  function tracer(a, b, colour, width) {
    const mat = new THREE.MeshBasicMaterial({
      color: colour,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const m = new THREE.Mesh(tracerGeo, mat);
    m.position.copy(a);
    m.lookAt(b);
    m.scale.set(width, width, Math.max(0.01, a.distanceTo(b)));
    add([m], mat, 0.12, (e, f) => {
      mat.opacity = 0.9 * (1 - f);
    });
  }

  function flash(pos, colour) {
    const mat = new THREE.MeshBasicMaterial({
      color: colour,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const m = new THREE.Mesh(flashGeo, mat);
    m.position.copy(pos);
    add([m], mat, 0.07, (e, f) => {
      mat.opacity = 1 - f;
      m.scale.setScalar(1 + f * 1.5);
    });
  }

  function sparks(pos, colour, n) {
    const mat = new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 1 });
    const objs = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(sparkGeo, mat);
      m.position.copy(pos);
      m.userData.v = new THREE.Vector3(G.rand(-3, 3), G.rand(1, 5), G.rand(-3, 3));
      objs.push(m);
    }
    add(objs, mat, 0.35, (e, f, dt) => {
      mat.opacity = 1 - f;
      for (const o of e.objs) {
        o.userData.v.y -= 18 * dt;
        o.position.addScaledVector(o.userData.v, dt);
      }
    });
  }

  function debris(pos, type) {
    const mat = new THREE.MeshStandardMaterial({
      color: DEBRIS_COLOUR[type] || 0x8a8274,
      roughness: 0.9,
      transparent: true,
      opacity: 1,
    });
    const objs = [];
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(chunkGeo, mat);
      m.scale.setScalar(G.rand(0.25, 0.6));
      m.position.set(pos.x + G.rand(-1.2, 1.2), pos.y + G.rand(-1, 1), pos.z + G.rand(-1.2, 1.2));
      m.userData.v = new THREE.Vector3(G.rand(-3, 3), G.rand(0, 5), G.rand(-3, 3));
      m.userData.r = new THREE.Vector3(G.rand(-6, 6), G.rand(-6, 6), G.rand(-6, 6));
      m.castShadow = true;
      objs.push(m);
    }
    add(objs, mat, 0.9, (e, f, dt) => {
      mat.opacity = f < 0.6 ? 1 : 1 - (f - 0.6) / 0.4;
      for (const o of e.objs) {
        o.userData.v.y -= 20 * dt;
        o.position.addScaledVector(o.userData.v, dt);
        if (o.position.y < 0.2) {
          o.position.y = 0.2;
          o.userData.v.set(0, 0, 0);
        }
        o.rotation.x += o.userData.r.x * dt;
        o.rotation.y += o.userData.r.y * dt;
      }
    });
  }

  /* Crossbow bolts ---------------------------------------------------------- */

  // A bolt built along +z (head forwards), matching the one on the runebow
  // but a little larger so it reads in flight. Geometry and the wood and
  // steel are shared; fletching materials are cached per colour.
  const BOLT_LEN = 0.6;
  const BOLT_SPEED = 110;
  const boltGeo = (() => {
    const shaft = new THREE.CylinderGeometry(0.011, 0.011, BOLT_LEN, 6);
    shaft.rotateX(Math.PI / 2);
    const head = new THREE.ConeGeometry(0.024, 0.08, 4);
    head.rotateX(Math.PI / 2);
    head.translate(0, 0, BOLT_LEN / 2 + 0.04);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.05);
    shape.lineTo(0.03, 0.035);
    shape.lineTo(0.024, -0.05);
    shape.lineTo(0, -0.05);
    const vane = new THREE.ShapeGeometry(shape);
    vane.rotateX(Math.PI / 2);
    vane.translate(0, 0, -BOLT_LEN / 2 + 0.07);
    return { shaft, head, vane };
  })();
  const boltWood = new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.7 });
  const boltSteel = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.8, roughness: 0.35 });
  const fletchMats = {};

  function boltMesh(fletch) {
    if (!fletchMats[fletch]) {
      fletchMats[fletch] = new THREE.MeshStandardMaterial({ color: fletch, roughness: 0.9, side: THREE.DoubleSide });
    }
    const g = new THREE.Group();
    g.add(new THREE.Mesh(boltGeo.shaft, boltWood), new THREE.Mesh(boltGeo.head, boltSteel));
    for (let i = 0; i < 3; i += 1) {
      const v = new THREE.Mesh(boltGeo.vane, fletchMats[fletch]);
      v.rotation.z = (i * Math.PI * 2) / 3 + Math.PI / 2;
      g.add(v);
    }
    return g;
  }

  /**
   * A bolt flying from a to b with a faint glowing trail. onArrive runs as
   * it lands; with stick, it stays lodged where it hit for a moment.
   */
  function bolt(a, b, glow, fletch, onArrive, stick) {
    const from = a.clone();
    const to = b.clone();
    const dist = from.distanceTo(to);
    const dir = to.clone().sub(from).normalize();
    const flight = Math.max(0.04, dist / BOLT_SPEED);
    const lodged = 1.4;
    const m = boltMesh(fletch);
    m.position.copy(from);
    m.lookAt(to);
    const trailMat = new THREE.MeshBasicMaterial({
      color: glow,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const trail = new THREE.Mesh(tracerGeo, trailMat);
    trail.position.copy(from);
    trail.lookAt(from.clone().sub(dir));
    trail.scale.set(0.012, 0.012, 0.01);
    add([m, trail], trailMat, flight + (stick ? lodged : 0.15), (e, f) => {
      const k = Math.min(1, e.t / flight);
      if (k < 1) {
        m.position.lerpVectors(from, to, k);
        trail.position.copy(m.position).addScaledVector(dir, -BOLT_LEN / 2);
        trail.scale.z = Math.max(0.01, Math.min(2, dist * k));
        return;
      }
      if (!e.arrived) {
        e.arrived = true;
        if (onArrive) onArrive();
        // Bury the head in what it hit, or vanish if it hit nothing solid.
        m.position.copy(to).addScaledVector(dir, -BOLT_LEN / 2 + 0.06);
        m.visible = !!stick;
      }
      const after = e.t - flight;
      trailMat.opacity = Math.max(0, 0.55 * (1 - after / 0.15));
      // A lodged bolt shrinks away over its last moment.
      if (stick) m.scale.setScalar(Math.max(0.001, Math.min(1, (lodged - after) / 0.3)));
    });
  }

  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const e = live[i];
      e.t += dt;
      const f = Math.min(1, e.t / e.life);
      e.step(e, f, dt);
      if (e.t >= e.life) {
        for (const o of e.objs) scene.remove(o);
        for (const m of [].concat(e.mat)) m.dispose();
        live.splice(i, 1);
      }
    }
  }

  function clear() {
    for (const e of live) {
      for (const o of e.objs) scene.remove(o);
      for (const m of [].concat(e.mat)) m.dispose();
    }
    live.length = 0;
  }

  G.fx = {
    init(sc) {
      scene = sc;
    },
    // For effects built elsewhere (firefx.js): objects, their material (or
    // materials, all disposed at the end), lifetime and per-frame step.
    spawn: add,
    tracer,
    bolt,
    flash,
    sparks,
    debris,
    update,
    clear,
  };
})();

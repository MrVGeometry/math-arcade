/**
 * Spireclash building system. Conjured stone pieces snap to a 4 x 4 x 4 grid:
 * walls sit on cell edges, floors on cell bottoms, and stairs (ramps) or
 * spires (cones) share a cell's slope slot. Every piece needs support: when a
 * piece breaks, anything no longer connected to the ground collapses.
 */
(function () {
  'use strict';
  const G = window.G;
  const C = G.CELL;
  const H = G.LEVEL_H;
  const T = 0.3;
  const ROOF_H = 1.5;
  const BUILD_TIME = 0.9;
  // A new piece pops to full size this fast, so placing feels instant even
  // though its strength still builds up over BUILD_TIME.
  const POP_TIME = 0.07;
  const EDGE_R = 0.12;
  const MAX_HP = { wall: 100, floor: 100, ramp: 100, roof: 100 };
  const TINT = { player: 0x46c3ff, ai: 0xff4136, arena: 0xe2b857 };
  // The arena bulwark: one storey of unbreakable wall across the middle,
  // three cells wide and centred on the spawn line, so the duellists still
  // start out of each other's sight.
  const BULWARK = { from: -1, to: 1 };
  // Yaw that turns a +z-rising stair to rise along each grid direction.
  const DIR_YAW = [Math.PI / 2, 0, -Math.PI / 2, Math.PI];
  const NAMES = { wall: 'Wall', floor: 'Floor', ramp: 'Stair', roof: 'Spire' };
  // Phase wand: a phased piece lets duellists and shots pass for this long.
  const PHASE_TIME = 3.5;

  const pieces = new Map();
  const columns = new Map();
  const meshes = [];
  // Hit meshes of phased pieces: skipped by shots, kept for the wand's aim.
  const phasedMeshes = [];
  const pickRay = new THREE.Raycaster();
  const scratch = new Set();
  const geo = {};
  let scene = null;
  let ghost = null;
  let ghostKey = '';
  let ghostValid = null;
  let ghostInvalid = null;

  function init(sc) {
    scene = sc;
    geo.wallX = G.roundedBox(T, H, C, EDGE_R, 3);
    geo.wallZ = G.roundedBox(C, H, T, EDGE_R, 3);
    geo.floor = G.roundedBox(C, T, C, EDGE_R, 3);
    geo.ramp = G.roundedBox(C, T, C * Math.SQRT2, EDGE_R, 3);
    geo.roof = new THREE.ConeGeometry((C / 2) * Math.SQRT2, ROOF_H, 4, 1);
    // A strong blue, so the preview stands out against stone and sky.
    ghostValid = new THREE.MeshBasicMaterial({
      color: 0x2f7bff,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    ghostInvalid = new THREE.MeshBasicMaterial({
      color: 0xff5050,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
  }

  function setTint(owner, colour) {
    TINT[owner] = colour;
  }

  /* Spec helpers ----------------------------------------------------------- */

  function keyOf(s) {
    if (s.type === 'wall') return `W${s.axis}${s.i},${s.j},${s.k}`;
    if (s.type === 'floor') return `F${s.i},${s.j},${s.k}`;
    return `S${s.i},${s.j},${s.k}`;
  }

  // The wall on the edge of cell (i, j) facing grid direction dir.
  function wallSpec(i, j, dir, k) {
    switch (dir) {
      case 0:
        return { type: 'wall', axis: 'x', i: i + 1, j, k };
      case 2:
        return { type: 'wall', axis: 'x', i, j, k };
      case 1:
        return { type: 'wall', axis: 'z', i, j: j + 1, k };
      default:
        return { type: 'wall', axis: 'z', i, j, k };
    }
  }

  function inBounds(s) {
    if (s.k < 0 || s.k > G.MAX_LEVEL) return false;
    const lo = G.GRID_MIN;
    const hi = G.GRID_MAX;
    if (s.type === 'wall' && s.axis === 'x') {
      return s.i >= lo && s.i <= hi + 1 && s.j >= lo && s.j <= hi;
    }
    if (s.type === 'wall') return s.i >= lo && s.i <= hi && s.j >= lo && s.j <= hi + 1;
    return s.i >= lo && s.i <= hi && s.j >= lo && s.j <= hi;
  }

  function aabbOf(s) {
    const y0 = s.k * H;
    if (s.type === 'wall' && s.axis === 'x') {
      return {
        min: { x: s.i * C - T / 2, y: y0, z: s.j * C },
        max: { x: s.i * C + T / 2, y: y0 + H, z: (s.j + 1) * C },
      };
    }
    if (s.type === 'wall') {
      return {
        min: { x: s.i * C, y: y0, z: s.j * C - T / 2 },
        max: { x: (s.i + 1) * C, y: y0 + H, z: s.j * C + T / 2 },
      };
    }
    if (s.type === 'floor') {
      return {
        min: { x: s.i * C, y: y0 - T / 2, z: s.j * C },
        max: { x: (s.i + 1) * C, y: y0 + T / 2, z: (s.j + 1) * C },
      };
    }
    const top = s.type === 'roof' ? y0 + ROOF_H : y0 + H;
    return {
      min: { x: s.i * C, y: y0, z: s.j * C },
      max: { x: (s.i + 1) * C, y: top, z: (s.j + 1) * C },
    };
  }

  function colsOf(s) {
    if (s.type === 'wall' && s.axis === 'x') {
      return [
        [s.i - 1, s.j],
        [s.i, s.j],
      ];
    }
    if (s.type === 'wall') {
      return [
        [s.i, s.j - 1],
        [s.i, s.j],
      ];
    }
    return [[s.i, s.j]];
  }

  function touches(a, b) {
    const e = 0.06;
    return (
      a.min.x <= b.max.x + e &&
      a.max.x >= b.min.x - e &&
      a.min.y <= b.max.y + e &&
      a.max.y >= b.min.y - e &&
      a.min.z <= b.max.z + e &&
      a.max.z >= b.min.z - e
    );
  }

  function grounded(box) {
    return box.min.y <= 0.01;
  }

  function candidatesAround(cols, out) {
    out.clear();
    for (const [ci, cj] of cols) {
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          const list = columns.get(`${ci + di},${cj + dj}`);
          if (list) for (const p of list) out.add(p);
        }
      }
    }
    return out;
  }

  function get(spec) {
    return pieces.get(keyOf(spec)) || null;
  }

  function canPlace(spec) {
    if (!spec || !inBounds(spec)) return false;
    if (pieces.has(keyOf(spec))) return false;
    const box = aabbOf(spec);
    if (grounded(box)) return true;
    for (const p of candidatesAround(colsOf(spec), scratch)) {
      if (touches(box, p.aabb)) return true;
    }
    return false;
  }

  // Whether a piece placed here would join onto an existing build (touching
  // the ground alone does not count).
  function joins(spec) {
    if (!spec || !inBounds(spec)) return false;
    const box = aabbOf(spec);
    for (const p of candidatesAround(colsOf(spec), scratch)) {
      if (p.alive && touches(box, p.aabb)) return true;
    }
    return false;
  }

  /* Meshes ----------------------------------------------------------------- */

  function makeObject(s, mat) {
    const y0 = s.k * H;
    const cx = s.i * C + C / 2;
    const cz = s.j * C + C / 2;
    let root;
    let hit;
    if (s.type === 'wall') {
      root = hit = new THREE.Mesh(s.axis === 'x' ? geo.wallX : geo.wallZ, mat);
      if (s.axis === 'x') root.position.set(s.i * C, y0 + H / 2, cz);
      else root.position.set(cx, y0 + H / 2, s.j * C);
    } else if (s.type === 'floor') {
      root = hit = new THREE.Mesh(geo.floor, mat);
      root.position.set(cx, y0, cz);
    } else if (s.type === 'ramp') {
      root = new THREE.Group();
      root.position.set(cx, y0 + H / 2, cz);
      root.rotation.y = DIR_YAW[s.dir || 0];
      hit = new THREE.Mesh(geo.ramp, mat);
      hit.rotation.x = -Math.PI / 4;
      // Drop the slab so its top face, not its centre, is the walking line.
      hit.position.set(0, -(T / 2) * Math.SQRT1_2, (T / 2) * Math.SQRT1_2);
      root.add(hit);
    } else {
      root = hit = new THREE.Mesh(geo.roof, mat);
      root.position.set(cx, y0 + ROOF_H / 2, cz);
      root.rotation.y = Math.PI / 4;
    }
    hit.castShadow = true;
    hit.receiveShadow = true;
    return { root, hit };
  }

  function textureFor(type) {
    if (type === 'wall') return G.tex.brick;
    if (type === 'floor') return G.tex.flag;
    if (type === 'ramp') return G.tex.stairs;
    return G.tex.slate;
  }

  function place(spec, owner) {
    if (!canPlace(spec)) return null;
    const type = spec.type;
    const mat = new THREE.MeshStandardMaterial({
      map: textureFor(type),
      emissiveMap: G.tex.runes,
      emissive: new THREE.Color(TINT[owner]),
      emissiveIntensity: 0.9,
      roughness: 0.92,
      metalness: 0.02,
      transparent: true,
      opacity: 0.75,
    });
    const obj = makeObject(spec, mat);
    // Full size from the first frame: the mesh is also what shots hit, so a
    // shrunken pop-in would leave gaps a shot could slip through.
    const piece = {
      key: keyOf(spec),
      type,
      name: NAMES[type],
      i: spec.i,
      j: spec.j,
      k: spec.k,
      axis: spec.axis || null,
      dir: spec.dir || 0,
      owner,
      maxHp: MAX_HP[type],
      hp: MAX_HP[type] * 0.1,
      dmg: 0,
      age: 0,
      pop: 0,
      built: false,
      flash: 0,
      alive: true,
      obj: obj.root,
      hitMesh: obj.hit,
      mat,
      aabb: aabbOf(spec),
      solid: type === 'wall' || type === 'floor',
      fixed: owner === 'arena',
      phaseT: 0,
      cols: colsOf(spec),
    };
    obj.hit.userData.piece = piece;
    scene.add(obj.root);
    obj.root.updateMatrixWorld(true);
    pieces.set(piece.key, piece);
    for (const [ci, cj] of piece.cols) {
      const ck = `${ci},${cj}`;
      if (!columns.has(ck)) columns.set(ck, []);
      columns.get(ck).push(piece);
    }
    meshes.push(obj.hit);
    if (owner !== 'arena') G.sound.play('build', centre(piece));
    if (G.events && G.events.onPlace) G.events.onPlace(piece);
    return piece;
  }

  function centre(p, out) {
    const o = out || new THREE.Vector3();
    const b = p.aabb;
    return o.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
  }

  /* Damage, destruction and structural support ---------------------------- */

  function recomputeHp(p) {
    const f = p.built ? 1 : Math.min(1, p.age / BUILD_TIME);
    p.hp = p.maxHp * (0.1 + 0.9 * f) - p.dmg;
  }

  function damage(p, amount, attacker) {
    if (!p.alive) return;
    p.flash = 1;
    if (p.fixed) return;
    p.dmg += amount;
    recomputeHp(p);
    if (G.events && G.events.onBuildDamage) G.events.onBuildDamage(p, amount, attacker);
    if (p.hp <= 0) destroy(p, true);
  }

  function unregister(p) {
    p.alive = false;
    pieces.delete(p.key);
    for (const [ci, cj] of p.cols) {
      const list = columns.get(`${ci},${cj}`);
      if (!list) continue;
      const idx = list.indexOf(p);
      if (idx >= 0) list.splice(idx, 1);
    }
    const mi = meshes.indexOf(p.hitMesh);
    if (mi >= 0) meshes.splice(mi, 1);
    const pi = phasedMeshes.indexOf(p.hitMesh);
    if (pi >= 0) phasedMeshes.splice(pi, 1);
    scene.remove(p.obj);
    p.mat.dispose();
  }

  function destroy(p, cascade, quiet) {
    if (!p.alive || p.fixed) return;
    unregister(p);
    if (!quiet && G.fx) G.fx.debris(centre(p), p.type);
    if (cascade) {
      G.sound.play('break', centre(p));
      collapse();
    }
  }

  // Flood from every grounded piece; whatever is not reached falls.
  function collapse() {
    const reached = new Set();
    const stack = [];
    for (const p of pieces.values()) {
      if (grounded(p.aabb)) {
        reached.add(p);
        stack.push(p);
      }
    }
    const near = new Set();
    while (stack.length) {
      const p = stack.pop();
      candidatesAround(p.cols, near);
      for (const q of near) {
        if (!reached.has(q) && touches(p.aabb, q.aabb)) {
          reached.add(q);
          stack.push(q);
        }
      }
    }
    const fallen = [];
    for (const p of pieces.values()) if (!reached.has(p)) fallen.push(p);
    fallen.forEach((p, n) => destroy(p, false, n > 24));
  }

  function placeBulwark() {
    for (let i = BULWARK.from; i <= BULWARK.to; i++) {
      const p = place({ type: 'wall', axis: 'z', i, j: 0, k: 0 }, 'arena');
      if (!p) continue;
      p.built = true;
      p.age = BUILD_TIME;
      p.pop = 1;
      p.obj.scale.setScalar(1);
      p.hp = p.maxHp;
      p.mat.transparent = false;
      p.mat.opacity = 1;
      p.mat.color.setScalar(0.82);
      p.mat.emissiveIntensity = 0.6;
    }
  }

  /* Phasing ---------------------------------------------------------------- */

  // Turn a piece insubstantial for a few seconds. It still holds up whatever
  // rests on it, so phasing a wall never brings a tower down.
  // Optional secs: how long it stays phased (PHASE_TIME by default).
  function phase(p, secs) {
    if (!p || !p.alive || p.fixed || p.phaseT > 0) return false;
    p.phaseT = secs || PHASE_TIME;
    p.phaseDur = p.phaseT;
    const mi = meshes.indexOf(p.hitMesh);
    if (mi >= 0) meshes.splice(mi, 1);
    phasedMeshes.push(p.hitMesh);
    p.mat.transparent = true;
    p.mat.depthWrite = false;
    p.obj.traverse((m) => {
      if (m.isMesh) m.castShadow = false;
    });
    G.sound.play('phase', centre(p));
    return true;
  }

  function unphase(p) {
    if (!(p.phaseT > 0)) return;
    p.phaseT = 0;
    const pi = phasedMeshes.indexOf(p.hitMesh);
    if (pi >= 0) phasedMeshes.splice(pi, 1);
    if (!p.alive) return;
    meshes.push(p.hitMesh);
    p.mat.depthWrite = true;
    p.mat.opacity = p.built ? 1 : 0.75 + 0.25 * Math.min(1, p.age / BUILD_TIME);
    p.obj.traverse((m) => {
      if (m.isMesh) m.castShadow = true;
    });
    p.flash = 1;
    G.sound.play('unphase', centre(p));
    // Solid again: anyone standing in it is lifted onto it or stepped out.
    if (G.events && G.events.onSolid) G.events.onSolid(p);
  }

  // The piece under a ray, phased or not (the wand can end a phase early).
  function pick(origin, dir, far) {
    pickRay.set(origin, dir);
    pickRay.far = far;
    const hit = pickRay.intersectObjects(meshes.concat(phasedMeshes), false)[0];
    return hit ? { piece: hit.object.userData.piece, distance: hit.distance } : null;
  }

  // Every piece along a ray, phased or not, nearest first, each listed once
  // at the distance the ray first meets it.
  function pickAll(origin, dir, far) {
    pickRay.set(origin, dir);
    pickRay.far = far;
    const seen = new Set();
    const out = [];
    for (const hit of pickRay.intersectObjects(meshes.concat(phasedMeshes), false)) {
      const piece = hit.object.userData.piece;
      if (seen.has(piece)) continue;
      seen.add(piece);
      out.push({ piece, distance: hit.distance });
    }
    return out;
  }

  // Compile every build material up front, so the first piece placed (and
  // the first one broken) does not stall a frame while shaders compile.
  function prewarm(renderer, camera) {
    const tmp = new THREE.Group();
    const piece = new THREE.MeshStandardMaterial({
      map: G.tex.brick,
      emissiveMap: G.tex.runes,
      emissive: new THREE.Color(TINT.player),
      transparent: true,
    });
    const chunk = new THREE.MeshStandardMaterial({ transparent: true });
    // Receiving shadows is part of a shader's key, so warm both variants.
    for (const m of [piece, chunk, ghostValid, ghostInvalid]) {
      for (const shade of [false, true]) {
        const mesh = new THREE.Mesh(geo.floor, m);
        mesh.receiveShadow = shade;
        tmp.add(mesh);
      }
    }
    scene.add(tmp);
    renderer.compile(scene, camera);
    // The materials are left undisposed: disposing them would throw away the
    // compiled programs this is here to keep.
    scene.remove(tmp);
  }

  /* Wand highlight --------------------------------------------------------- */

  // The piece the wand is pointed at glows blue, with a bright outline
  // drawn over everything so it reads even behind other pieces.
  const HIGHLIGHT = 0x2f7bff;
  let highlighted = null;
  let outline = null;

  function highlight(p) {
    if (highlighted === p) return;
    if (highlighted && highlighted.alive) {
      highlighted.mat.emissive.setHex(TINT[highlighted.owner]);
      highlighted.mat.color.copy(highlighted.colourBefore);
      if (!(highlighted.phaseT > 0)) highlighted.mat.emissiveIntensity = highlighted.glowBefore;
    }
    highlighted = p && p.alive ? p : null;
    if (!outline) {
      outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
        new THREE.LineBasicMaterial({ color: 0x6fb0ff, transparent: true, opacity: 0.95, depthTest: false })
      );
      outline.renderOrder = 10;
      scene.add(outline);
    }
    outline.visible = !!highlighted;
    if (!highlighted) return;
    highlighted.glowBefore = highlighted.mat.emissiveIntensity;
    highlighted.colourBefore = highlighted.mat.color.clone();
    // Tinted blue through and glowing hard, so it stands out even from the
    // player's own blue-runed pieces.
    highlighted.mat.color.setRGB(0.45, 0.62, 1.15);
    highlighted.mat.emissive.setHex(HIGHLIGHT);
    highlighted.mat.emissiveIntensity = Math.max(highlighted.mat.emissiveIntensity, 2.6);
    const b = highlighted.aabb;
    outline.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
    outline.scale.set(b.max.x - b.min.x + 0.06, b.max.y - b.min.y + 0.06, b.max.z - b.min.z + 0.06);
  }

  function clear() {
    highlight(null);
    for (const p of [...pieces.values()]) unregister(p);
    pieces.clear();
    columns.clear();
    meshes.length = 0;
    phasedMeshes.length = 0;
  }

  function update(dt) {
    for (const p of pieces.values()) {
      if (p.phaseT > 0) {
        p.phaseT -= dt;
        if (p.phaseT <= 0) {
          p.phaseT = 0.0001;
          unphase(p);
          continue;
        }
        // Shimmer, then flicker for the last moments as a warning.
        const warn = p.phaseT < Math.min(0.8, (p.phaseDur || PHASE_TIME) * 0.35) && Math.floor(p.phaseT * 12) % 2 === 0;
        p.mat.opacity = warn ? 0.55 : 0.2 + Math.sin(G.now * 9) * 0.04;
        p.mat.emissiveIntensity = 2.4;
        continue;
      }
      // A brief bright flash as a piece appears, in place of a size pop.
      if (p.pop < 1) {
        p.pop = Math.min(1, p.pop + dt / POP_TIME);
        p.mat.emissiveIntensity = Math.max(p.mat.emissiveIntensity, 0.9 + (1 - p.pop) * 2);
      }
      if (p.built && p.flash <= 0) continue;
      if (p.fixed) {
        p.flash = Math.max(0, p.flash - dt * 5);
        p.mat.emissiveIntensity = 0.6 + p.flash * 2;
        continue;
      }
      if (!p.built) {
        p.age += dt;
        const f = Math.min(1, p.age / BUILD_TIME);
        // The material stays in the transparent pass at full opacity, so
        // finishing a piece never forces a shader rebuild mid-fight.
        p.mat.opacity = 0.75 + 0.25 * f;
        if (f >= 1) {
          p.built = true;
          p.mat.opacity = 1;
        }
        recomputeHp(p);
      }
      p.flash = Math.max(0, p.flash - dt * 5);
      const building = p.built ? 0 : 1 - p.age / BUILD_TIME;
      p.mat.emissiveIntensity = 0.9 + p.flash * 2.5 + building * 1.5;
      p.mat.color.setScalar(0.45 + 0.55 * Math.max(0, p.hp / p.maxHp));
    }
  }

  /* Queries used by physics, combat and the AI ---------------------------- */

  // Pieces near (x, z) that block movement. A phased piece lets only its
  // owner through: pass the mover's owner ('player' or 'ai') so a rival's
  // phased wall stays solid to them.
  function collidersNear(x, z, owner) {
    const out = scratch;
    out.clear();
    const ci = Math.floor(x / C);
    const cj = Math.floor(z / C);
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        const list = columns.get(`${ci + di},${cj + dj}`);
        if (list) for (const p of list) if (!(p.phaseT > 0) || p.owner !== owner) out.add(p);
      }
    }
    return [...out];
  }

  function rampProgress(p, x, z) {
    const x0 = p.i * C;
    const z0 = p.j * C;
    let t;
    switch (p.dir) {
      case 0:
        t = (x - x0) / C;
        break;
      case 1:
        t = (z - z0) / C;
        break;
      case 2:
        t = (x0 + C - x) / C;
        break;
      default:
        t = (z0 + C - z) / C;
        break;
    }
    return G.clamp(t, 0, 1);
  }

  // Surface height of a stair or spire at (x, z), or null outside its cell.
  function slopeHeight(p, x, z) {
    const x0 = p.i * C;
    const z0 = p.j * C;
    if (x < x0 || x > x0 + C || z < z0 || z > z0 + C) return null;
    if (p.type === 'ramp') return p.k * H + rampProgress(p, x, z) * H;
    const m = Math.max(Math.abs(x - x0 - C / 2), Math.abs(z - z0 - C / 2)) / (C / 2);
    return p.k * H + ROOF_H * (1 - m);
  }

  function showGhost(spec, valid) {
    if (!spec) {
      if (ghost) ghost.visible = false;
      return;
    }
    const k = keyOf(spec) + spec.type + (spec.dir || 0);
    if (k !== ghostKey) {
      if (ghost) scene.remove(ghost);
      ghost = makeObject(spec, ghostValid).root;
      ghost.traverse((m) => {
        if (m.isMesh) {
          m.castShadow = false;
          m.receiveShadow = false;
          m.renderOrder = 5;
        }
      });
      scene.add(ghost);
      ghostKey = k;
    }
    ghost.visible = true;
    const mat = valid ? ghostValid : ghostInvalid;
    ghost.traverse((m) => {
      if (m.isMesh) m.material = mat;
    });
  }

  G.builds = {
    init,
    setTint,
    keyOf,
    get,
    wallSpec,
    inBounds,
    canPlace,
    joins,
    aabbOf,
    // The bulwark's extent, for the AI to keep its distance.
    bulwark: { x0: BULWARK.from * C, x1: (BULWARK.to + 1) * C, z: 0 },
    place,
    placeBulwark,
    prewarm,
    phase,
    unphase,
    highlight,
    pick,
    pickAll,
    PHASE_TIME,
    damage,
    destroy,
    clear,
    update,
    centre,
    collidersNear,
    slopeHeight,
    rampProgress,
    showGhost,
    meshes,
    pieces,
    ROOF_H,
    TINT,
    count: () => pieces.size,
  };
})();

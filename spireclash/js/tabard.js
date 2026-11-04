/**
 * Spireclash tabard: the cloth hanging front and back from under the belt,
 * simulated like the cape. Each panel drapes over the armoured skirt and
 * is pushed clear of the swinging legs every frame, so armour never shows
 * through it. Running lifts the back panel (backing up lifts the front),
 * strafing swings both and jumping floats them. Same cloth, wrinkles and
 * gilded hem as the cape.
 * Model space: y up from the feet, the knight facing -z.
 */
(function () {
  'use strict';
  const G = window.G;

  const NU = 10;
  const NV = 18;
  // Hung just under the belt, a little wider at the hem than the top.
  const TOP_Y = 1.0;
  const TOP_DEPTH = 0.172;
  const LEN = 0.56;
  const TOP_HALF = 0.1;
  const HEM_HALF = 0.135;
  const GAP = 0.016;
  const TORSO_Y = 0.9;
  // The pointed steel plate over the front panel: its height span, half
  // width and the depth of its back face, which the cloth stays behind.
  const PLATE = { y0: 0.8, y1: 0.99, half: 0.1, depth: 0.238 };

  // Outer size of the skirt at model height y (matches buildSkirt).
  function skirt(y) {
    const t = y - TORSO_Y;
    if (t > 0.11 || t < -0.17) return null;
    const k = Math.max(0, Math.min(1, (0.1 - t) / 0.26));
    const r = 0.206 + k * 0.09;
    return { rx: r, rz: r * 0.78 };
  }

  // Push one point (at depth w away from the body) clear of the skirt and
  // the legs. sign is +1 for the back panel, -1 for the front.
  function clear(sim, x, y, w, legs) {
    let out = w;
    const s = skirt(y);
    if (s && Math.abs(x) < s.rx) out = Math.max(out, s.rz * Math.sqrt(1 - (x / s.rx) ** 2) + GAP);
    for (const leg of legs) {
      const along = leg.hipY - y;
      if (along < -0.05 || along > 1) continue;
      const c = Math.max(Math.cos(leg.angle), 0.3);
      const reach = Math.min(Math.max(along / c, 0), 1);
      const axis = sim.sign * -Math.sin(leg.angle) * reach;
      const r = 0.132 + GAP;
      const dx = x - leg.x;
      // A tilted leg's horizontal slice is an ellipse, deeper by 1 / cos.
      if (Math.abs(dx) < r) out = Math.max(out, axis + (r / c) * Math.sqrt(1 - (dx / r) ** 2));
    }
    if (sim.sign < 0 && y > PLATE.y0 && y < PLATE.y1 && Math.abs(x) < PLATE.half) out = Math.min(out, PLATE.depth);
    return out;
  }

  function sheetGeometry() {
    const cols = NU + 1;
    const uv = new Float32Array(cols * (NV + 1) * 2);
    const index = [];
    for (let r = 0; r <= NV; r += 1) {
      for (let k = 0; k < cols; k += 1) {
        const i = r * cols + k;
        uv[i * 2] = k / NU;
        uv[i * 2 + 1] = 1 - r / NV;
        if (r < NV && k < NU) index.push(i, i + cols, i + 1, i + 1, i + cols, i + cols + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cols * (NV + 1) * 3), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(index);
    return geo;
  }

  function panel(mat, root, sign) {
    const mesh = new THREE.Mesh(sheetGeometry(), mat);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    root.add(mesh);
    return { mesh, sign, lift: 0, sway: 0, air: 0, phase: G.rand(0, 6) };
  }

  G.buildTabard = function (pal, root) {
    const mat = new THREE.MeshStandardMaterial({
      map: G.capeTexture(pal),
      normalMap: G.capeNormal(),
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughness: 0.9,
      side: THREE.DoubleSide,
      // Wins any depth tie with armour it rests against.
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    });
    const tabard = { front: panel(mat, root, -1), back: panel(mat, root, 1) };
    G.updateTabard(tabard, 0, 0, { fwd: 0, side: 0, air: false, legL: 0, legR: 0 });
    return tabard;
  };

  function updatePanel(sim, dt, now, o, legs) {
    // The back panel streams out when running forwards, the front one when
    // backing up; both ease in so they trail behind the motion.
    const target = Math.max(0, sim.sign * o.fwd);
    const k = Math.min(1, dt * 4);
    sim.lift += (target - sim.lift) * k;
    sim.sway += (-o.side - sim.sway) * k;
    sim.air += ((o.air ? 1 : 0) - sim.air) * Math.min(1, dt * 5);
    const lift = sim.lift;
    const arr = sim.mesh.geometry.attributes.position.array;
    const ds = LEN / NV;
    const speed = 2.4 + lift * 5;
    const amp = 0.04 + lift * 0.14 + sim.air * 0.06;
    for (let col = 0; col <= NU; col += 1) {
      const u = (col / NU) * 2 - 1;
      let y = TOP_Y;
      let w = TOP_DEPTH + 0.01 * (1 - u * u);
      for (let row = 0; row <= NV; row += 1) {
        const v = row / NV;
        if (row > 0) {
          const ripple = Math.sin(now * speed - v * 7 + u * 1.5 + sim.phase) * amp * v;
          const phi = 0.02 + lift * (0.2 + v * 0.9) + sim.air * 0.4 * v + ripple;
          y -= Math.cos(phi) * ds;
          w += Math.sin(phi) * ds;
        }
        const x = u * (TOP_HALF + (HEM_HALF - TOP_HALF) * v) + sim.sway * 0.12 * v * v;
        // Soft vertical folds, plus a small flutter that grows down the cloth.
        const fold = Math.cos(u * Math.PI * 2 + sim.phase) * 0.008 * (0.3 + v);
        const flap = Math.sin(now * speed * 1.4 + u * 3 - v * 5) * 0.01 * (lift + sim.air) * v;
        // The top row is sewn under the belt; below it the cloth drapes over
        // whatever it meets and hangs on from there.
        if (row > 0) w = clear(sim, x, y, w + fold + flap, legs) - fold - flap;
        const i = (row * (NU + 1) + col) * 3;
        arr[i] = x;
        arr[i + 1] = y;
        arr[i + 2] = sim.sign * (w + fold + flap);
      }
    }
    sim.mesh.geometry.attributes.position.needsUpdate = true;
    sim.mesh.geometry.computeVertexNormals();
  }

  /**
   * Reshape both panels for this frame. o.fwd is forward speed (-1..1,
   * negative when backing up), o.side sideways speed, o.air whether
   * airborne, and o.legL / o.legR the legs' swing angles.
   */
  G.updateTabard = function (tabard, dt, now, o) {
    const legs = [
      { x: -0.13, hipY: 0.9, angle: o.legL },
      { x: 0.13, hipY: 0.9, angle: o.legR },
    ];
    updatePanel(tabard.front, dt, now, o, legs);
    updatePanel(tabard.back, dt, now, o, legs);
  };
})();

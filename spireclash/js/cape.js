/**
 * Spireclash capes: one continuous sheet of cloth sewn to a soft rolled
 * collar that wraps the neck and rests on the pauldrons, flaring towards the
 * hem and billowing out behind a running knight. The sheet is reshaped
 * every frame, layered with folds and ripples, and pushed clear of the
 * torso, pauldrons and swinging legs so armour never pokes through.
 */
(function () {
  'use strict';
  const G = window.G;

  // Grid resolution: columns across the cape, rows down its length.
  const NU = 28;
  const NV = 34;
  // The collar arc: how far round the neck it wraps (radians either side of
  // the spine), its radii, and its height at the spine and at the shoulders.
  const WRAP = 1.25;
  const COLLAR_RX = 0.29;
  const COLLAR_RZ = 0.205;
  const COLLAR_Y = 1.52;
  const COLLAR_RISE = 0.11;
  // Width across the backs of the pauldrons, reached just below the collar.
  const SHOULDER_HALF = 0.34;
  // Below the shoulders each side edge angles outwards by 15 degrees.
  const FLARE = Math.tan((15 * Math.PI) / 180);
  // Clearance kept between the cloth and the armour beneath it.
  const GAP = 0.025;
  // Scabbard axis in model space: top (x, y, z) then tip (x, y, z).
  const SHEATH = [-0.29, 0.94, -0.02, -0.19, 0.22, 0.37];

  // A point on the collar for u in -1..1 (knight faces -z, so +z is the back).
  function collar(u, out) {
    const a = u * WRAP;
    out.x = Math.sin(a) * COLLAR_RX;
    out.z = Math.cos(a) * COLLAR_RZ;
    out.y = COLLAR_Y + COLLAR_RISE * (1 - Math.cos(a)) / (1 - Math.cos(WRAP));
    return out;
  }

  // A sheet of NU x NV quads with u across (0..1) and v down (top = 1).
  function sheetGeometry() {
    const cols = NU + 1;
    const rows = NV + 1;
    const uv = new Float32Array(cols * rows * 2);
    const index = [];
    for (let r = 0; r < rows; r += 1) {
      for (let k = 0; k < cols; k += 1) {
        const i = r * cols + k;
        uv[i * 2] = k / NU;
        uv[i * 2 + 1] = 1 - r / NV;
        if (r < NV && k < NU) index.push(i, i + cols, i + 1, i + 1, i + cols, i + cols + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cols * rows * 3), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(index);
    return geo;
  }

  // Back of the torso (including the tabard and faulds) at height y.
  function torsoBack(y) {
    if (y < 0.38 || y > 1.56) return null;
    // Below the skirt: the back panel of the tabard, which the cape covers.
    if (y < 0.56) return { rx: 0.19, rz: 0.25 };
    if (y < 1.05) return { rx: 0.33, rz: 0.25 };
    // The muscled backplate: lats, shoulder blades and upper-back bulge.
    if (y < 1.38) return { rx: 0.32, rz: 0.195 };
    return { rx: 0.29, rz: 0.2 };
  }

  // Lift z so the point sits on or behind the back of a circle of radius r
  // centred at (cx, cz) in a horizontal slice, measured across dx only.
  function behind(z, dx, cz, r) {
    if (Math.abs(dx) >= r) return z;
    const surf = cz + Math.sqrt(r * r - dx * dx);
    return z < surf ? surf : z;
  }

  // Pushes one point back out of every body part it has sunk into.
  function clear(x, y, z, legs) {
    let out = z;
    const t = torsoBack(y);
    if (t && Math.abs(x) < t.rx) {
      const q = x / t.rx;
      out = Math.max(out, t.rz * Math.sqrt(1 - q * q) + GAP);
    }
    // Pauldrons: a squat dome over each shoulder with lames beneath.
    for (const sx of [-0.3, 0.3]) {
      const qx = (x - sx) / (0.3 + GAP);
      const qy = (y - 1.41) / (0.24 + GAP);
      const k = 1 - qx * qx - qy * qy;
      if (k > 0) out = Math.max(out, (0.27 + GAP) * Math.sqrt(k));
    }
    // The sheathed runeblade on the left hip, its tip slanting back.
    if (y < SHEATH[1] && y > SHEATH[4]) {
      const t = (SHEATH[1] - y) / (SHEATH[1] - SHEATH[4]);
      const ax = SHEATH[0] + (SHEATH[3] - SHEATH[0]) * t;
      const az = SHEATH[2] + (SHEATH[5] - SHEATH[2]) * t;
      out = behind(out, x - ax, az, 0.05 + GAP);
    }
    // Legs: capsules from the hip, swung by their x rotation.
    for (const leg of legs) {
      const along = leg.hipY - y;
      if (along < -0.05 || along > 1) continue;
      // Leg axis at this height: the foot swings to -z for a positive angle.
      const c = Math.max(Math.cos(leg.angle), 0.3);
      const reach = Math.min(Math.max(along / c, 0), 1);
      const r = 0.115 + GAP;
      const dx = x - leg.x;
      // A tilted leg's horizontal slice is an ellipse, deeper by 1 / cos.
      if (Math.abs(dx) < r) out = Math.max(out, -Math.sin(leg.angle) * reach + (r / c) * Math.sqrt(1 - (dx / r) ** 2));
    }
    return out;
  }

  // Spreads each row's push sideways so a leg raises a soft bulge in the
  // cloth instead of a sharp fin, then clears the body once more so the
  // smoothing can never sink a vertex back into the armour. The top row is
  // sewn to the collar and stays put.
  function spread(arr, push, legs) {
    const cols = NU + 1;
    for (let row = 1; row <= NV; row += 1) {
      const base = row * cols;
      for (let col = 0; col < cols; col += 1) {
        let best = 0;
        for (let j = Math.max(0, col - 8); j <= Math.min(NU, col + 8); j += 1) {
          best = Math.max(best, push[base + j] * (1 - Math.abs(j - col) * 0.1));
        }
        const i = (base + col) * 3;
        arr[i + 2] = clear(arr[i], arr[i + 1], arr[i + 2] + best, legs);
      }
    }
  }

  // The rolled collar: a soft tube of the cape cloth along the top edge,
  // with a small gilded brooch where it rests on each shoulder.
  function buildCollar(mat, M, part, root) {
    const pts = [];
    const p = {};
    for (let i = 0; i <= 20; i += 1) {
      collar(i / 10 - 1, p);
      pts.push(new THREE.Vector3(p.x * 1.04, p.y + 0.012, p.z * 1.04));
    }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.026, 10, false);
    // Softly bunched cloth rather than a smooth pipe.
    const pos = tube.attributes.position;
    const centre = new THREE.Vector3();
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 1) {
      const ring = Math.floor(i / 11);
      tube.parameters.path.getPointAt(ring / 48, centre);
      v.fromBufferAttribute(pos, i).sub(centre);
      v.multiplyScalar(1 + Math.sin(ring * 0.7) * 0.14 + Math.sin(ring * 1.9 + 1) * 0.06);
      pos.setXYZ(i, centre.x + v.x, centre.y + v.y, centre.z + v.z);
    }
    tube.computeVertexNormals();
    part(tube, mat, 0, 0, 0, root);
    for (const s of [-1, 1]) {
      collar(s, p);
      const brooch = part(new THREE.SphereGeometry(0.036, 16, 10), M.trim, p.x * 1.06, p.y + 0.03, p.z, root);
      brooch.scale.set(1, 0.45, 1);
      part(new THREE.IcosahedronGeometry(0.014, 0), M.glow, p.x * 1.06, p.y + 0.045, p.z, root);
    }
  }

  G.buildCape = function (pal, M, part, root) {
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
    const mesh = new THREE.Mesh(sheetGeometry(), mat);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    root.add(mesh);
    buildCollar(mat, M, part, root);
    // Each cape gets its own fold pattern so no two hang alike.
    const phase = [G.rand(0, 6), G.rand(0, 6), G.rand(0, 6), G.rand(0, 6)];
    const sim = { mesh, phase, len: pal.capeLength || 1.1, lift: 0, sway: 0, air: 0, push: new Float32Array((NU + 1) * (NV + 1)) };
    G.updateCape(sim, 0, 0, { f: 0, side: 0, air: false, legL: 0, legR: 0 });
    return sim;
  };

  // Resting folds: deep pleats falling from the collar plus finer ones
  // between them, all deepening towards the hem and easing as it billows.
  function folds(sim, u, v) {
    const p = sim.phase;
    const depth = (0.2 + v) * (1 - sim.lift * 0.35);
    const pleats = Math.cos(u * 8.2 + p[0]) * 0.04 + Math.cos(u * 14.5 + p[1]) * 0.02 + Math.cos(u * 23 + p[2]) * 0.009;
    // Diagonal wrinkles crossing the pleats, as heavy cloth twists slightly.
    const twist = Math.sin(u * 11 + v * 9 + p[3]) * 0.009 + Math.sin(u * 17 - v * 13 + p[0]) * 0.005;
    return pleats * depth + twist * v;
  }

  // Moving ripples: a long swell rolling down the cape, a quicker one
  // across it, and a fine shiver that grows with speed.
  function ripples(sim, u, v, now) {
    const lift = sim.lift;
    const s = 2.2 + lift * 5;
    const swell = Math.sin(now * s * 1.3 + u * 3.1 - v * 5 + sim.phase[3]) * (0.012 + lift * 0.035);
    const cross = Math.sin(now * s * 0.9 - u * 5.5 + v * 2) * (0.006 + lift * 0.018);
    const shiver = Math.sin(now * s * 2.1 - v * 14 + u * 2.3) * (0.003 + lift * 0.012);
    return (swell + cross + shiver) * v;
  }

  /**
   * Reshape the cape for this frame. `o.f` is run speed (0..1), `o.side` is
   * sideways speed (-1..1, positive to the knight's right), `o.air` whether
   * airborne, and `o.legL` / `o.legR` the legs' swing angles.
   */
  G.updateCape = function (sim, dt, now, o) {
    // Ease towards the target billow so the cape trails behind movement.
    const k = Math.min(1, dt * 3.5);
    sim.lift += (o.f - sim.lift) * k;
    sim.sway += (-o.side - sim.sway) * k;
    sim.air += ((o.air ? 1 : 0) - sim.air) * Math.min(1, dt * 5);
    const lift = sim.lift;
    const arr = sim.mesh.geometry.attributes.position.array;
    const legs = [
      { x: -0.13, hipY: 0.9, angle: o.legL },
      { x: 0.13, hipY: 0.9, angle: o.legR },
    ];
    const ds = sim.len / NV;
    const amp = 0.035 + lift * 0.16 + sim.air * 0.08;
    const speed = 2.2 + lift * 5;
    const top = {};
    for (let col = 0; col <= NU; col += 1) {
      const u = (col / NU) * 2 - 1;
      collar(u, top);
      let y = top.y;
      let z = top.z;
      let carry = 0;
      for (let row = 0; row <= NV; row += 1) {
        const v = row / NV;
        const i = row * (NU + 1) + col;
        if (row > 0) {
          // Angle from hanging straight down, opening up towards the hem.
          const wave = Math.sin(now * speed - v * 6.5 + u * 1.7) * amp * v;
          const phi = 0.07 + (lift * 1.05 + sim.air * 0.55) * (0.25 + v * 0.85) + wave;
          y -= Math.cos(phi) * ds;
          z += Math.sin(phi) * ds;
        }
        // Fall outwards over the shoulder caps first, then flare to the hem.
        const cap = Math.min(1, v / 0.14);
        const over = top.x + (u * SHOULDER_HALF - top.x) * cap * cap * (3 - 2 * cap);
        const x = over + u * FLARE * Math.max(0, v - 0.14) * sim.len + sim.sway * 0.35 * Math.pow(v, 1.5) * sim.len;
        // The outer edges curl in a little, cupping the air.
        const curl = -0.05 * u * u * v * (0.6 + lift);
        const want = z + folds(sim, u, v) + ripples(sim, u, v, now) + curl;
        arr[i * 3] = x;
        arr[i * 3 + 1] = y;
        arr[i * 3 + 2] = want;
        sim.push[i] = 0;
        if (row === 0) continue;
        // Cloth pushed out by the body drapes over it rather than kinking.
        const cleared = clear(x, y, want + carry, legs);
        carry = Math.max(carry * 0.86, cleared - want);
        sim.push[i] = cleared - want;
      }
    }
    spread(arr, sim.push, legs);
    sim.mesh.geometry.attributes.position.needsUpdate = true;
    sim.mesh.geometry.computeVertexNormals();
  };
})();

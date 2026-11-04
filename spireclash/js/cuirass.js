/**
 * Spireclash muscle cuirass: the breastplate and backplate as one sculpted
 * shell, after a heroic physique. A V-shaped torso (broad across the chest
 * and lats, nipped at the waist) carries pecs, a sternum groove and a
 * subtle six-pack in front, and behind it the upper-back bulge, shoulder
 * blades with a ripple beneath, flaring lats and a groove down the spine.
 * Built in torso space: y up from the hips, the front facing -z.
 */
(function () {
  'use strict';
  const G = window.G;

  const Y0 = 0.08;
  const Y1 = 0.648;
  const ROWS = 48;
  const COLS = 80;
  // Half-width (x) and half-depth (z) of the bare torso up its height.
  const PROFILE = [
    [0.08, 0.176, 0.133],
    [0.14, 0.186, 0.136],
    [0.22, 0.208, 0.142],
    [0.32, 0.25, 0.155],
    [0.4, 0.278, 0.166],
    [0.46, 0.286, 0.17],
    [0.52, 0.278, 0.166],
    [0.57, 0.25, 0.152],
    [0.61, 0.19, 0.122],
    [0.635, 0.12, 0.085],
    [0.648, 0.03, 0.03],
  ];

  function profile(y) {
    const p = PROFILE;
    if (y <= p[0][0]) return { rx: p[0][1], rz: p[0][2] };
    for (let i = 1; i < p.length; i += 1) {
      if (y <= p[i][0]) {
        const t = (y - p[i - 1][0]) / (p[i][0] - p[i - 1][0]);
        // Eased between points so the silhouette has no kinks.
        const k = t * t * (3 - 2 * t);
        return { rx: p[i - 1][1] + (p[i][1] - p[i - 1][1]) * k, rz: p[i - 1][2] + (p[i][2] - p[i - 1][2]) * k };
      }
    }
    const last = p[p.length - 1];
    return { rx: last[1], rz: last[2] };
  }

  const bump = (d, s) => Math.exp(-(d / s) * (d / s));
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  // How far the plate swells out (or sinks in) from the bare V-shaped
  // torso at angle a (0 = front, increasing towards the right) and height y.
  function relief(a, y) {
    let d = 0;
    for (const s of [-1, 1]) {
      // Pecs, with a crisp crease along their lower edge.
      d += 0.028 * bump(a - s * 0.45, 0.36) * bump(y - 0.47, 0.065);
      // A six-pack: three pairs of low blocks.
      for (const row of [0.335, 0.26, 0.185]) d += 0.009 * bump(a - s * 0.17, 0.11) * bump(y - row, 0.032);
    }
    d -= 0.01 * bump(y - 0.395, 0.025) * bump(a, 0.9);
    // Sternum groove, running on down between the abs.
    d -= 0.01 * bump(a, 0.06) * bump(y - 0.44, 0.12);
    d -= 0.008 * bump(a, 0.045) * bump(y - 0.22, 0.12);
    const b = wrap(a - Math.PI);
    // Groove down the spine.
    d -= 0.012 * bump(b, 0.07) * bump(y - 0.36, 0.2);
    for (const s of [-1, 1]) {
      // The bulge across the top of the back.
      d += 0.02 * bump(b - s * 0.35, 0.42) * bump(y - 0.53, 0.08);
      // Shoulder blades, with a ripple beneath them.
      d += 0.012 * bump(b - s * 0.62, 0.24) * bump(y - 0.44, 0.06);
      d -= 0.006 * bump(b - s * 0.62, 0.3) * bump(y - 0.375, 0.02);
      // Lats flaring out to make the V.
      d += 0.016 * bump(b - s * 1.05, 0.34) * bump(y - 0.36, 0.11);
      // The long muscles either side of the spine, low down.
      d += 0.007 * bump(b - s * 0.13, 0.08) * bump(y - 0.2, 0.08);
    }
    // Fade the relief out where the shell closes in at the neck.
    return d * Math.min(1, Math.max(0, (0.63 - y) / 0.04));
  }

  /** A point on the cuirass at angle a and height y, pushed out by lift. */
  function surface(a, y, lift, out) {
    const { rx, rz } = profile(y);
    const px = rx * Math.sin(a);
    const pz = -rz * Math.cos(a);
    // Outward normal of the bare ellipse at this point.
    let nx = px / (rx * rx);
    let nz = pz / (rz * rz);
    const nl = Math.hypot(nx, nz) || 1;
    nx /= nl;
    nz /= nl;
    const d = relief(a, y) + (lift || 0);
    return out.set(px + nx * d, y, pz + nz * d);
  }

  function shellGeometry() {
    const cols = COLS + 1;
    const pos = new Float32Array((ROWS + 1) * cols * 3);
    const uv = new Float32Array((ROWS + 1) * cols * 2);
    const index = [];
    const p = new THREE.Vector3();
    for (let r = 0; r <= ROWS; r += 1) {
      const y = Y0 + ((Y1 - Y0) * r) / ROWS;
      for (let c = 0; c < cols; c += 1) {
        const i = r * cols + c;
        // Start at the side, so the closing seam hides under the arm.
        surface((c / COLS) * Math.PI * 2 + Math.PI / 2, y, 0, p);
        pos.set([p.x, p.y, p.z], i * 3);
        uv.set([c / COLS, r / ROWS], i * 2);
        if (r < ROWS && c < COLS) index.push(i, i + cols, i + 1, i + 1, i + cols, i + cols + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(index);
    geo.computeVertexNormals();
    // Share one normal across the seam so its shading is continuous.
    const n = geo.attributes.normal;
    for (let r = 0; r <= ROWS; r += 1) {
      const a = r * cols;
      const b = a + COLS;
      const x = n.getX(a) + n.getX(b);
      const y = n.getY(a) + n.getY(b);
      const z = n.getZ(a) + n.getZ(b);
      const l = Math.hypot(x, y, z) || 1;
      n.setXYZ(a, x / l, y / l, z / l);
      n.setXYZ(b, x / l, y / l, z / l);
    }
    return geo;
  }

  // A gilded tube following the sculpted surface all the way round at y.
  function ring(mat, y, parent) {
    const pts = [];
    for (let i = 0; i < 64; i += 1) pts.push(surface((i / 64) * Math.PI * 2, y, 0.004, new THREE.Vector3()));
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 128, 0.011, 6, true);
    const m = new THREE.Mesh(tube, mat);
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  // How far forward (as a positive depth) the plate reaches across a strip
  // of the chest at height y, so a badge can sit clear of the pecs.
  function frontDepth(y, halfWidth) {
    const p = new THREE.Vector3();
    let deepest = 0;
    for (let x = -halfWidth; x <= halfWidth; x += halfWidth / 6) {
      const a = Math.asin(Math.max(-1, Math.min(1, x / profile(y).rx)));
      deepest = Math.max(deepest, -surface(a, y, 0, p).z);
    }
    return deepest;
  }

  G.cuirass = {
    surface,
    frontDepth,
    build(M, parent) {
      const shell = new THREE.Mesh(shellGeometry(), M.plateSmooth);
      shell.castShadow = true;
      parent.add(shell);
      ring(M.trimSmooth, 0.1, parent);
      ring(M.trimSmooth, 0.6, parent);
      return shell;
    },
  };
})();

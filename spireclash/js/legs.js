/**
 * Spireclash legs: muscled thigh plates (quads in front, the outer quad on
 * the side, the teardrop above the knee, a hamstring behind), a rounded
 * knee guard, and tall boots in a contrasting blackened steel. Each boot's
 * shaft is shaped round the calf, rises to a gilded point at the front,
 * and ends in a rounded armoured foot with layered toe plates.
 * Leg space: pivot at the hip, -y down the leg, -z forward, side * x out.
 */
(function () {
  'use strict';
  const G = window.G;
  const { part, glowPatch } = G.armour;

  const bump = (d, s) => Math.exp(-(d / s) * (d / s));
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  function bulge(mat, r, sx, sy, sz, x, y, z, parent) {
    const m = part(new THREE.SphereGeometry(r, 20, 14), mat, x, y, z, parent);
    m.scale.set(sx, sy, sz);
    return m;
  }

  // Interpolate a [y, value] table (y descending) with eased steps.
  function table(rows, y) {
    if (y >= rows[0][0]) return rows[0][1];
    for (let i = 1; i < rows.length; i += 1) {
      if (y >= rows[i][0]) {
        const t = (rows[i - 1][0] - y) / (rows[i - 1][0] - rows[i][0]);
        const k = t * t * (3 - 2 * t);
        return rows[i - 1][1] + (rows[i][1] - rows[i - 1][1]) * k;
      }
    }
    return rows[rows.length - 1][1];
  }

  /* Boot shaft ------------------------------------------------------------ */

  const BOOT_BOTTOM = -0.84;
  // Shaft radius down the leg: flared at the top, full at the calf, slim
  // at the ankle.
  const BOOT_R = [[-0.46, 0.1], [-0.5, 0.094], [-0.56, 0.09], [-0.62, 0.087], [-0.7, 0.078], [-0.78, 0.068], [-0.84, 0.072]];

  // The top edge: level behind, rising to a point over the shin.
  const bootTop = (a) => -0.51 + 0.05 * bump(a, 0.45);

  // The calf (two heads behind) and a faint ridge down the shin.
  function bootRelief(a, y) {
    const b = wrap(a - Math.PI);
    let d = 0.006 * bump(a, 0.22) * bump(y + 0.65, 0.12);
    for (const s of [-1, 1]) d += 0.03 * bump(b - s * 0.45, 0.45) * bump(y + 0.59, 0.06);
    return d;
  }

  function bootPoint(a, y, lift, out) {
    const r = table(BOOT_R, y) + bootRelief(a, y) + lift;
    return out.set(r * Math.sin(a), y, -r * Math.cos(a) * 0.95);
  }

  function shaftGeometry() {
    const rows = 30;
    const cols = 48;
    const pos = new Float32Array((rows + 1) * (cols + 1) * 3);
    const uv = new Float32Array((rows + 1) * (cols + 1) * 2);
    const index = [];
    const p = new THREE.Vector3();
    for (let r = 0; r <= rows; r += 1) {
      for (let c = 0; c <= cols; c += 1) {
        // Start at the side, so the closing seam faces the other leg.
        const a = (c / cols) * Math.PI * 2 + Math.PI / 2;
        const y = bootTop(a) + ((BOOT_BOTTOM - bootTop(a)) * r) / rows;
        const i = r * (cols + 1) + c;
        bootPoint(a, y, 0, p);
        pos.set([p.x, p.y, p.z], i * 3);
        uv.set([c / cols, 1 - r / rows], i * 2);
        if (r < rows && c < cols) index.push(i, i + 1, i + cols + 1, i + 1, i + cols + 2, i + cols + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(index);
    geo.computeVertexNormals();
    // One shared normal along the seam, so its shading is continuous.
    const n = geo.attributes.normal;
    for (let r = 0; r <= rows; r += 1) {
      const a = r * (cols + 1);
      const b = a + cols;
      const v = new THREE.Vector3(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
      n.setXYZ(a, v.x, v.y, v.z);
      n.setXYZ(b, v.x, v.y, v.z);
    }
    return geo;
  }

  // A gilded tube round the boot, following yAt(a).
  function bootTrim(M, yAt, lift, r, parent) {
    const pts = [];
    for (let i = 0; i < 48; i += 1) {
      const a = (i / 48) * Math.PI * 2;
      pts.push(bootPoint(a, yAt(a), lift, new THREE.Vector3()));
    }
    return part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, r, 6, true), M.trimSmooth, 0, 0, 0, parent);
  }

  function buildFoot(M, leg) {
    // Rounded armoured foot on a dark sole, with a heel cup behind.
    bulge(M.boot, 1, 0.07, 0.044, 0.135, 0, -0.856, -0.055, leg);
    bulge(M.boot, 0.052, 1.3, 0.95, 1, 0, -0.85, 0.042, leg);
    part(G.roundedBox(0.13, 0.02, 0.27, 0.009, 2), M.dark, 0, -0.89, -0.05, leg);
    // Overlapping shells over the instep and toes, each a little smaller.
    const shell = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    for (let i = 0; i < 3; i += 1) {
      const k = 1 - i * 0.13;
      part(shell, M.boot, 0, -0.862, -0.03 - i * 0.05, leg).scale.set(0.074 * k, 0.05 * k, 0.065 * k);
    }
  }

  /** Build one leg into its hip-pivot group. side: -1 left, 1 right. */
  G.buildLeg = function (M, pal, leg, side) {
    part(new THREE.CylinderGeometry(0.075, 0.06, 0.84, 12), M.mail, 0, -0.45, 0, leg);
    // Thigh: a tapering core, the quads swelling in front, the outer quad
    // on the side, the teardrop just above the knee on the inside, and a
    // hamstring behind.
    const core = new THREE.LatheGeometry(
      [[0.07, -0.41], [0.084, -0.36], [0.098, -0.26], [0.106, -0.14], [0.102, -0.04], [0.09, 0.0]].map(([r, y]) => new THREE.Vector2(r, y)),
      24
    );
    part(core, M.armourSmooth, 0, 0, 0, leg).scale.z = 0.95;
    bulge(M.plateSmooth, 0.076, 1.15, 2.3, 1, 0, -0.18, -0.05, leg);
    bulge(M.plateSmooth, 0.06, 0.85, 2.4, 1, side * 0.062, -0.2, -0.008, leg);
    bulge(M.plateSmooth, 0.052, 0.9, 1.3, 0.95, -side * 0.044, -0.345, -0.04, leg);
    bulge(M.armourSmooth, 0.064, 1, 2.4, 0.9, 0, -0.2, 0.036, leg);
    // Knee: a joint to fill the bend down into the boot, and a guard with
    // a gilded border.
    bulge(M.plateSmooth, 0.078, 1, 1.5, 1, 0, -0.45, 0, leg);
    bulge(M.trimSmooth, 0.07, 1.1, 0.95, 0.7, 0, -0.43, -0.044, leg);
    bulge(M.plateSmooth, 0.06, 1.1, 0.95, 0.75, 0, -0.43, -0.056, leg);
    // The boot, standing out in blackened steel.
    part(shaftGeometry(), M.boot, 0, 0, 0, leg);
    bootTrim(M, bootTop, 0.005, 0.012, leg);
    bootTrim(M, () => -0.815, 0.004, 0.01, leg);
    buildFoot(M, leg);
    if (pal.runes) glowPatch(M, 0.02, 0.2, 0, -0.66, -0.083, leg);
  };
})();

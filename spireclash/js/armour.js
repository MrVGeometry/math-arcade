/**
 * Spireclash body armour, after the concept art: chunky faceted plate
 * (eight-sided, flat shaded so every facet catches the light) with a gilded
 * band along each plate's edge. Builds the torso, pauldrons and arms (legs.js does the legs);
 * models.js adds the helm, shield, cape and weapons on top.
 */
(function () {
  'use strict';
  const G = window.G;

  // Eight facets around every turned plate, like the concept art.
  const SEG = 8;

  function part(geo, mat, x, y, z, parent) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  // Hard-edged block with a single bevel facet on every edge.
  const slab = (w, h, d, b) => G.roundedBox(w, h, d, b || Math.min(w, h, d) * 0.28, 1);
  const taper = (rTop, rBot, len, seg) => new THREE.CylinderGeometry(rTop, rBot, len, seg || SEG);
  const lathe = (pts, segs) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs || SEG);
  const facetBall = (r, w, h) => new THREE.SphereGeometry(r, w || 6, h || 4);

  // A gilded band: a short faceted ring with real thickness, hugging a
  // plate of radius r at height y.
  function band(M, parent, r, y, h, scaleZ, thick) {
    const t = thick || 0.012;
    const geo = lathe([[r - 0.004, -h / 2], [r + t, -h / 2], [r + t, h / 2], [r - 0.004, h / 2]]);
    const m = part(geo, M.trim, 0, y, 0, parent);
    if (scaleZ) m.scale.z = scaleZ;
    return m;
  }

  // A small glowing patch facing outwards from the y axis at (x, z).
  function glowPatch(M, w, h, x, y, z, parent) {
    const m = part(new THREE.PlaneGeometry(w, h), M.glow, x, y, z, parent);
    m.rotation.y = Math.atan2(x, z);
    m.castShadow = false;
    return m;
  }

  // A heraldic badge (crest face over a gilded rim) facing along +z.
  function badge(M, crestMat, shape, size, parent) {
    const g = new THREE.Group();
    parent.add(g);
    const face = part(new THREE.ShapeGeometry(shape), crestMat, 0, 0, 0.015, g);
    face.scale.set(size, size, 1);
    const rim = part(new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false }), M.trim, 0, 0, 0, g);
    rim.scale.set(size * 1.22, size * 1.22, 1);
    return g;
  }

  // An ellipsoid of smooth plate: the building block of the muscled arm.
  function bulge(mat, r, sx, sy, sz, x, y, z, parent) {
    const m = part(new THREE.SphereGeometry(r, 20, 14), mat, x, y, z, parent);
    m.scale.set(sx, sy, sz);
    return m;
  }

  /**
   * Muscled plate for one arm. Local -y runs down the arm, -z is the front
   * (biceps, knuckles) and side * x is the outside of the arm.
   */
  function buildArm(M, pal, arm, side) {
    // Built slim, then widened (not lengthened) to match the oversized
    // pauldrons; the hand a little less, so it still closes on the grip.
    const body = new THREE.Group();
    body.scale.set(1.4, 1, 1.4);
    const hand = new THREE.Group();
    hand.scale.set(1.2, 1, 1.2);
    arm.add(body, hand);
    part(taper(0.05, 0.044, 0.62, 12), M.mail, 0, -0.32, 0, body);
    // Upper arm: a biceps swelling at the front and a broader triceps
    // behind, set a little higher, rising right up under the pauldron.
    bulge(M.plateSmooth, 0.07, 1, 1.75, 1.05, 0, -0.175, -0.026, body);
    bulge(M.armourSmooth, 0.074, 1.05, 1.85, 1, 0, -0.15, 0.028, body);
    // Elbow: a rounded joint with a gilded cop on the point behind.
    bulge(M.plateSmooth, 0.058, 1, 1, 1, 0, -0.31, 0, body);
    bulge(M.trimSmooth, 0.045, 1, 0.9, 0.8, 0, -0.31, 0.03, body);
    bulge(M.plateSmooth, 0.038, 1, 0.9, 0.8, 0, -0.31, 0.038, body);
    // Forearm: heavy just below the elbow, tapering to the wrist, with the
    // long muscle on the outer top standing proud.
    const fore = lathe([[0.053, -0.565], [0.054, -0.53], [0.062, -0.47], [0.072, -0.41], [0.077, -0.37], [0.068, -0.33]], 20);
    part(fore, M.plateSmooth, 0, 0, 0, body).scale.z = 0.9;
    bulge(M.plateSmooth, 0.042, 1, 2.3, 1, side * 0.03, -0.4, -0.026, body);
    // Flared gilded cuff at the wrist.
    part(lathe([[0.056, -0.585], [0.074, -0.56], [0.078, -0.545], [0.062, -0.535]], 20), M.trimSmooth, 0, 0, 0, body);
    // Hand: four armoured fingers curled round the grip, a plate over the
    // back of the hand with gilded knuckles, and a thumb laid along the top.
    for (let i = 0; i < 4; i += 1) {
      const wrap = new THREE.Group();
      wrap.position.y = -0.6 - i * 0.024;
      wrap.rotation.y = Math.PI + side * 0.35;
      hand.add(wrap);
      const finger = part(new THREE.TorusGeometry(0.05, 0.0125, 8, 12, Math.PI * 1.15), M.plateSmooth, 0, 0, 0, wrap);
      finger.rotation.x = Math.PI / 2;
    }
    const back = part(G.roundedBox(0.03, 0.1, 0.085, 0.012, 2), M.plateSmooth, side * 0.05, -0.636, 0.004, hand);
    back.rotation.z = side * -0.08;
    part(G.roundedBox(0.022, 0.09, 0.03, 0.008, 2), M.trimSmooth, side * 0.058, -0.636, -0.034, hand);
    part(new THREE.CapsuleGeometry(0.016, 0.05, 4, 10), M.plateSmooth, -side * 0.024, -0.6, -0.05, hand);
    if (pal.runes) glowPatch(M, 0.018, 0.16, side * 0.072, -0.44, 0, body);
  }

  function buildPauldron(M, pal, side, torso, crestMat, shape) {
    const g = new THREE.Group();
    g.position.set(side * 0.3, 0.53, 0);
    // Oversized, as in the concept art.
    g.scale.setScalar(1.15);
    torso.add(g);
    const big = pal.pauldron || 1;
    const spread = new THREE.Vector3(1.3 * big, 1.05, 1.3 * big);
    // Rounded dome with a gilded rim.
    const dome = new THREE.SphereGeometry(0.15, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    part(dome, M.plateSmooth, 0, 0, 0, g).scale.copy(spread);
    const rim = part(new THREE.TorusGeometry(0.15, 0.011, 8, 40), M.trimSmooth, 0, 0.004, 0, g);
    rim.rotation.x = Math.PI / 2;
    rim.scale.set(spread.x, spread.z, 1);
    // Two lames nested just under the dome's rim, each a slightly larger
    // band of the same sphere, so the layers flow on down the arm. Each
    // ends in a gilded hem.
    const top = Math.PI / 2 - 0.14;
    const bottom = Math.PI / 2 + 0.4;
    for (let i = 0; i < 2; i += 1) {
      const lame = new THREE.Group();
      lame.position.set(side * (0.012 + i * 0.014), -0.03 - i * 0.04, 0);
      lame.rotation.z = side * -(0.16 + i * 0.12);
      g.add(lame);
      const r = 0.156 + i * 0.008;
      const shell = new THREE.SphereGeometry(r, 24, 4, 0, Math.PI * 2, top, bottom - top);
      part(shell, M.plateOpenSmooth, 0, 0, 0, lame).scale.copy(spread);
      const hem = part(new THREE.TorusGeometry(r * Math.sin(bottom), 0.009, 8, 40), M.trimSmooth, 0, r * Math.cos(bottom) * spread.y, 0, lame);
      hem.rotation.x = Math.PI / 2;
      hem.scale.set(spread.x, spread.z, 1);
    }
    // A solid steel core inside the shell, so any gap between the dome and
    // the lames (or beneath them) shows steel rather than empty space.
    const core = part(new THREE.SphereGeometry(0.135, 24, 12), M.plateSmooth, side * 0.01, -0.05, 0, g);
    core.scale.set(spread.x, 1, spread.z * 0.95);
    core.castShadow = false;
    // Heraldic badge on the outside of the upper lame.
    const b = badge(M, crestMat, shape, 0.08, g);
    b.position.set(side * 0.212 * big, -0.07, 0);
    b.rotation.set(0, side * Math.PI / 2, side * -0.3);
    // Spikes: smooth, gently tapering horns, each seated in a gilded collar
    // right on the dome's surface and standing out along its curve.
    const spikes = pal.spikes || 0;
    const horn = lathe([[0.027, -0.012], [0.027, 0.02], [0.023, 0.06], [0.016, 0.098], [0.008, 0.128], [0.003, 0.141], [0, 0.144]], 18);
    const collar = new THREE.TorusGeometry(0.027, 0.007, 8, 20);
    const radii = new THREE.Vector3(0.15 * spread.x, 0.15 * spread.y, 0.15 * spread.z);
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < spikes; i += 1) {
      // Set a little forward so the cape draped over the back never meets them.
      const z = spikes === 1 ? -0.06 : -0.13 + (0.15 * i) / (spikes - 1);
      const x = side * 0.06;
      const q = 1 - (x / radii.x) ** 2 - (z / radii.z) ** 2;
      const y = radii.y * Math.sqrt(Math.max(0, q));
      // Point along the dome's normal there, leaning a little more upright.
      const dir = new THREE.Vector3(x / radii.x ** 2, y / radii.y ** 2, z / radii.z ** 2).normalize();
      dir.addScaledVector(up, 0.5).normalize();
      const mount = new THREE.Group();
      mount.position.set(x, y - 0.004, z);
      mount.quaternion.setFromUnitVectors(up, dir);
      g.add(mount);
      part(horn, M.trimSmooth, 0, 0, 0, mount);
      part(collar, M.trimSmooth, 0, 0.004, 0, mount).rotation.x = Math.PI / 2;
    }
  }

  // The armoured skirt (faulds): three overlapping lames, each swelling
  // out in a smooth curve and oval like the waist above, wide and deep
  // enough to ride over the quads, every one ending in a rolled gilded hem.
  function buildSkirt(M, torso) {
    const depth = 0.78;
    const lames = [
      [0.1, 0.2, 0.22, 0.234, -0.002],
      [0.02, 0.222, 0.246, 0.26, -0.082],
      [-0.06, 0.248, 0.272, 0.286, -0.158],
    ];
    for (const [top, rTop, rMid, rBot, bottom] of lames) {
      const pts = [];
      for (let i = 0; i <= 8; i += 1) {
        const t = i / 8;
        // A gentle outward swell between top and bottom edge.
        const r = rTop + (rBot - rTop) * t + (rMid - (rTop + rBot) / 2) * Math.sin(Math.PI * t) * 2;
        pts.push(new THREE.Vector2(r, top + (bottom - top) * t));
      }
      pts.reverse();
      part(new THREE.LatheGeometry(pts, 48), M.plateOpenSmooth, 0, 0, 0, torso).scale.z = depth;
      const hem = [];
      for (let i = 0; i < 48; i += 1) {
        const a = (i / 48) * Math.PI * 2;
        hem.push(new THREE.Vector3(Math.sin(a) * (rBot + 0.004), bottom, Math.cos(a) * (rBot + 0.004) * depth));
      }
      part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hem, true), 96, 0.009, 6, true), M.trimSmooth, 0, 0, 0, torso);
    }
  }

  function buildTorso(M, pal, root, crestMat, shape) {
    const torso = new THREE.Group();
    torso.position.y = 0.9;
    root.add(torso);
    // Mail shirt, kept inside the cuirass so its grooves never show it.
    part(taper(0.16, 0.165, 0.5, 16), M.mail, 0, 0.3, 0, torso).scale.z = 0.72;
    // Sculpted muscle cuirass (cuirass.js), gilded at waist and neckline.
    G.cuirass.build(M, torso);
    // Gilded studs high on the chest, below the collarbones.
    const stud = new THREE.SphereGeometry(0.018, 12, 8);
    const at = new THREE.Vector3();
    for (const s of [-1, 1]) {
      for (const [a, y] of [[0.95, 0.545], [1.2, 0.51]]) {
        G.cuirass.surface(s * a, y, 0.008, at);
        part(stud, M.trimSmooth, at.x, at.y, at.z, torso);
      }
    }
    // Layered gorget around the neck.
    part(taper(0.13, 0.17, 0.07), M.armour, 0, 0.64, 0, torso).scale.z = 0.85;
    band(M, torso, 0.13, 0.675, 0.018, 0.85);
    part(taper(0.11, 0.13, 0.05), M.plate, 0, 0.7, 0, torso).scale.z = 0.85;
    // The palette's heraldry on the chest, framed in gold.
    // Sitting on the sternum, clear of the pecs either side.
    const crest = badge(M, crestMat, shape, 0.15, torso);
    crest.position.set(0, 0.43, -(G.cuirass.frontDepth(0.43, 0.075) + 0.006));
    crest.rotation.set(-0.08, Math.PI, 0);
    // Belt with a broad square buckle.
    part(taper(0.208, 0.208, 0.065), M.leather, 0, 0.12, 0, torso).scale.z = 0.78;
    const buckle = part(new THREE.TorusGeometry(0.04, 0.011, 4, 4), M.plate, 0, 0.12, -0.17, torso);
    buckle.rotation.z = Math.PI / 4;
    buckle.scale.set(1.25, 1, 1);
    buildSkirt(M, torso);
    // A pointed steel plate over the front of the tabard (tabard.js),
    // gilded at the edge, standing just proud of the cloth beneath it.
    const fauld = new THREE.Group();
    fauld.position.set(0, -0.02, -0.25);
    fauld.rotation.set(0.12, Math.PI, 0);
    torso.add(fauld);
    const plate = part(new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false }), M.plate, 0, 0, 0.008, fauld);
    plate.scale.set(0.17, 0.17, 1);
    const plateRim = part(new THREE.ExtrudeGeometry(shape, { depth: 0.01, bevelEnabled: false }), M.trim, 0, 0, 0, fauld);
    plateRim.scale.set(0.2, 0.2, 1);
    G.buildScabbard(M, torso);
    buildPauldron(M, pal, -1, torso, crestMat, shape);
    buildPauldron(M, pal, 1, torso, crestMat, shape);
    return torso;
  }

  G.armour = { part, slab, taper, lathe, facetBall, band, glowPatch, badge, buildArm, buildTorso };
})();

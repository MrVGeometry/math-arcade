/**
 * Spireclash fairytale castle, standing on the hill to the north of the
 * arena: smooth cream plaster, slender towers of many heights crowned with
 * tall curved blue roofs and gold finials, arched windows, a rose window and
 * a gatehouse facing the duelling ground. The front faces +z.
 */
(function () {
  'use strict';
  const G = window.G;

  let M = null;

  function materials() {
    const T = G.castleTextures();
    const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.85, metalness: 0 }, o));
    const relief = (n) => new THREE.Vector2(n, n);
    return {
      wall: std({ color: 0xfff6e8, map: T.stucco.map, normalMap: T.stucco.normal, normalScale: relief(0.7) }),
      shade: std({ color: 0xe9e1d2, map: T.stucco.map, normalMap: T.stucco.normal, normalScale: relief(0.7) }),
      plinth: std({ color: 0xd6cbb8, map: G.tex.castle }),
      roof: std({ color: 0x2452c8, map: T.scales.map, normalMap: T.scales.normal, normalScale: relief(1.3), roughness: 0.42, metalness: 0.1 }),
      roofUnder: std({ color: 0x23335e, side: THREE.DoubleSide }),
      gold: std({ color: 0xe6b84f, map: G.tex.metal, metalness: 0.75, roughness: 0.3 }),
      glass: std({ map: T.glass, roughness: 0.2, metalness: 0.1, emissive: 0x0a1230 }),
      rose: std({ map: T.rose, emissiveMap: T.rose, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.3 }),
      door: std({ map: T.door, roughness: 0.8 }),
      banner: std({ map: T.banner, alphaTest: 0.5, roughness: 0.9, side: THREE.DoubleSide }),
      pennant: std({ color: 0xb01e30, map: G.tex.cloth, roughness: 0.9, side: THREE.DoubleSide }),
    };
  }

  // Stretch a shape's UVs to 0..1 across its bounds, so a texture painted
  // for a whole window or door fits it exactly.
  function fitUV(geo) {
    geo.computeBoundingBox();
    const b = geo.boundingBox;
    const uv = geo.attributes.uv;
    const pos = geo.attributes.position;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, (pos.getX(i) - b.min.x) / (b.max.x - b.min.x), (pos.getY(i) - b.min.y) / (b.max.y - b.min.y));
    }
    return geo;
  }

  function add(geo, mat, x, y, z, parent) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  // An arch: a rectangle with a round top, w wide and h tall, base at y = 0.
  function archShape(w, h) {
    const s = new THREE.Shape();
    const r = w / 2;
    s.moveTo(-r, 0);
    s.lineTo(r, 0);
    s.lineTo(r, h - r);
    s.absarc(0, h - r, r, 0, Math.PI, false);
    s.closePath();
    return s;
  }

  // An arched window with a plaster surround, set into a surface facing
  // along angle a (0 faces +z).
  function windowAt(parent, x, y, z, a, w, h) {
    const frame = add(new THREE.ShapeGeometry(archShape(w * 1.35, h * 1.15), 12), M.shade, x, y - h * 0.08, z, parent);
    frame.rotation.y = a;
    const pane = add(fitUV(new THREE.ShapeGeometry(archShape(w, h), 12)), M.glass, x + Math.sin(a) * 0.05, y, z + Math.cos(a) * 0.05, parent);
    pane.rotation.y = a;
  }

  // A tall witch's-hat roof: concave sides sweeping out to a flared eave.
  function roofGeometry(r, h) {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const rad = r * (1 - t) ** 1.45 + r * 0.12 * (1 - t) ** 10;
      pts.push(new THREE.Vector2(Math.max(rad, 0.001), t * h));
    }
    const geo = new THREE.LatheGeometry(pts, 36);
    return G.land.tiled(geo, (Math.PI * 2 * r) / 2.4, h / 2.4);
  }

  // Gold finial: a ball and a needle spire, with a pennant on taller towers.
  function finial(parent, y, size, pennant) {
    add(new THREE.SphereGeometry(size * 0.35, 16, 12), M.gold, 0, y + size * 0.3, 0, parent);
    add(new THREE.ConeGeometry(size * 0.12, size * 2.6, 10), M.gold, 0, y + size * 1.8, 0, parent);
    if (!pennant) return;
    const flag = new THREE.Shape();
    flag.moveTo(0, 0);
    flag.lineTo(size * 2.4, -size * 0.35);
    flag.lineTo(0, -size * 0.8);
    flag.closePath();
    add(new THREE.ShapeGeometry(flag), M.pennant, 0, y + size * 2.6, 0, parent);
  }

  // A round tower: plaster body, gold band, corbelled parapet ring, the
  // roof and finial, and arched windows facing the front.
  function tower(g, o) {
    const t = new THREE.Group();
    t.position.set(o.x, o.y || 0, o.z);
    g.add(t);
    const { r, h } = o;
    const body = new THREE.CylinderGeometry(r, r * 1.05, h, 32);
    add(G.land.tiled(body, (Math.PI * 2 * r) / 12, h / 12), M.wall, 0, h / 2, 0, t);
    // A cut-stone plinth where towers meet the ground (not perched ones).
    if (!o.y) {
      const ph = Math.min(2.4, h * 0.12);
      const plinth = new THREE.CylinderGeometry(r * 1.07, r * 1.13, ph, 32);
      add(G.land.tiled(plinth, (Math.PI * 2 * r) / 6, ph / 6), M.plinth, 0, ph / 2, 0, t);
    }
    // Corbelled ring flaring out beneath the roof, edged in gold.
    add(new THREE.CylinderGeometry(r * 1.16, r, r * 0.45, 32), M.wall, 0, h + r * 0.22, 0, t);
    add(new THREE.TorusGeometry(r * 1.16, r * 0.05, 8, 40), M.gold, 0, h + r * 0.45, 0, t).rotation.x = Math.PI / 2;
    // The waist band sits in the clear wall below the lowest window row, so
    // it never runs across a window.
    const bandY = o.rows === 0 ? h * 0.62 : h * 0.35 - Math.min(1.2, h * 0.05);
    add(new THREE.TorusGeometry(r * 1.02, r * 0.04, 8, 40), M.gold, 0, bandY, 0, t).rotation.x = Math.PI / 2;
    const roofR = r * 1.2;
    const roofH = o.roof || r * 4;
    const roofY = h + r * 0.45;
    add(roofGeometry(roofR, roofH), M.roof, 0, roofY, 0, t);
    add(new THREE.CircleGeometry(roofR * 1.12, 36), M.roofUnder, 0, roofY + 0.02, 0, t).rotation.x = Math.PI / 2;
    finial(t, roofY + roofH, Math.max(0.6, r * 0.3), roofH > 12);
    // Windows: a column of arches facing the arena, stacked up the tower.
    const w = Math.min(1.4, r * 0.38);
    for (const a of o.faces || [0]) {
      for (let k = 0; k < (o.rows || 2); k++) {
        const wy = h * (0.35 + k * 0.22);
        windowAt(t, Math.sin(a) * (r * 1.01 + 0.02), wy, Math.cos(a) * (r * 1.01 + 0.02), a, w, w * 2.3);
      }
    }
    return t;
  }

  // A hipped roof over a rectangular block: a four-sided cone squared off.
  function hipRoof(g, x, y, z, w, d, h) {
    const geo = G.land.tiled(new THREE.ConeGeometry(Math.SQRT1_2, h, 4, 1), 12, h / 3);
    // The cone's base is the roof's underside: dark eaves, not shingles.
    const roof = add(geo, [M.roof, M.roofUnder], x, y + h / 2, z, g);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(w * 1.08, 1, d * 1.08);
  }

  function curtainWalls(g) {
    const W = 60;
    const H = 10;
    for (const [w, d, x, z] of [
      [W, 3, 0, W / 2],
      [W, 3, 0, -W / 2],
      [3, W, W / 2, 0],
      [3, W, -W / 2, 0],
    ]) {
      const geo = G.land.tiled(G.roundedBox(w, H, d, 0.6, 3).clone(), Math.max(w, d) / 12, H / 12);
      add(geo, M.wall, x, H / 2, z, g);
      const base = G.land.tiled(G.roundedBox(w + 0.5, 1.6, d + 0.5, 0.3, 2).clone(), Math.max(w, d) / 6, 0.27);
      add(base, M.plinth, x, 0.8, z, g);
      // Rounded merlons along the wall walk, capped with a gold rail below.
      const len = Math.max(w, d);
      for (let k = -len / 2 + 2; k <= len / 2 - 2; k += 3) {
        add(G.roundedBox(1.6, 2, 1.6, 0.18, 2), M.wall, w > d ? x + k : x, H + 1, w > d ? z : z + k, g);
      }
      add(G.roundedBox(w > d ? w : 3.4, 0.3, w > d ? 3.4 : d, 0.12, 2), M.gold, x, H - 0.4, z, g);
    }
    for (const [x, z] of [
      [W / 2, W / 2],
      [-W / 2, W / 2],
      [W / 2, -W / 2],
      [-W / 2, -W / 2],
    ]) {
      tower(g, { x, z, r: 4.2, h: 18, roof: 15, rows: 1, faces: [Math.atan2(x, z)] });
    }
  }

  function gatehouse(g) {
    // The gatehouse block's front face.
    const z = 33.55;
    for (const x of [-7.5, 7.5]) tower(g, { x, z: 31, r: 3.2, h: 22, roof: 13, rows: 2 });
    // Banners hanging from the gatehouse either side of the gate.
    for (const x of [-4.4, 4.4]) add(new THREE.PlaneGeometry(2.2, 6), M.banner, x * 1.05, 9, z + 0.05, g);
    add(G.land.tiled(G.roundedBox(12, 16, 5, 0.6, 3).clone(), 1, 1.3), M.wall, 0, 8, 31, g);
    // Gate arch with a gold surround, and a small balcony window above.
    add(new THREE.ShapeGeometry(archShape(6.4, 10.5), 16), M.gold, 0, 0, z, g);
    add(fitUV(new THREE.ShapeGeometry(archShape(5.6, 9.8), 16)), M.door, 0, 0, z + 0.05, g);
    windowAt(g, 0, 11.5, z, 0, 1.4, 2.8);
    hipRoof(g, 0, 16, 31, 12, 5, 4);
  }

  function keep(g) {
    // Great hall: a tall block with a steep roof and a rose window.
    const hall = G.land.tiled(G.roundedBox(30, 24, 20, 0.8, 3).clone(), 2.5, 2);
    add(hall, M.wall, 0, 12, -2, g);
    add(G.roundedBox(30.6, 0.5, 20.6, 0.2, 2), M.gold, 0, 24, -2, g);
    hipRoof(g, 0, 24, -2, 30, 20, 14);
    const front = 8.05;
    for (const x of [-5.5, 5.5]) {
      windowAt(g, x, 4, front, 0, 1.6, 4.2);
      windowAt(g, x, 13.5, front, 0, 1.4, 3.6);
    }
    // Rose window: a gold wheel over a dark glass disc.
    add(new THREE.CircleGeometry(3.4, 32), M.shade, 0, 15, front, g);
    add(new THREE.CircleGeometry(2.8, 32), M.rose, 0, 15, front + 0.05, g);
    add(new THREE.TorusGeometry(2.8, 0.18, 8, 40), M.gold, 0, 15, front + 0.1, g);
    for (let k = 0; k < 8; k++) {
      const spoke = add(new THREE.BoxGeometry(0.16, 5.4, 0.08), M.gold, 0, 15, front + 0.1, g);
      spoke.rotation.z = (k / 8) * Math.PI;
    }
    add(new THREE.CircleGeometry(0.6, 20), M.gold, 0, 15, front + 0.14, g);
    // Towers rising around and above the hall, tallest at the centre.
    tower(g, { x: 0, y: 24, z: -4, r: 4, h: 30, roof: 24, rows: 3 });
    tower(g, { x: -10.5, z: 9, r: 3.4, h: 36, roof: 15, rows: 3 });
    tower(g, { x: 10.5, z: 9, r: 3.4, h: 36, roof: 15, rows: 3 });
    tower(g, { x: -13, z: -12, r: 3.8, h: 46, roof: 18, rows: 3, faces: [0, -1.2] });
    tower(g, { x: 13, z: -12, r: 3.8, h: 46, roof: 18, rows: 3, faces: [0, 1.2] });
    tower(g, { x: -18, z: 2, r: 2.4, h: 30, roof: 11, rows: 2, faces: [-0.9] });
    tower(g, { x: 18, z: 2, r: 2.4, h: 30, roof: 11, rows: 2, faces: [0.9] });
    tower(g, { x: 0, z: -14, r: 3, h: 52, roof: 15, rows: 3 });
  }

  G.buildCastle = function (scene, x, z) {
    M = materials();
    const g = new THREE.Group();
    g.position.set(x, G.land.height(x, z) + 0.06, z);
    // A touch larger than life, so it reads clearly from the arena.
    g.scale.setScalar(1.3);
    curtainWalls(g);
    gatehouse(g);
    keep(g);
    scene.add(g);
    return g;
  };
})();

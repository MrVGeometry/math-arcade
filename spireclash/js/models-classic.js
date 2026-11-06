/**
 * Spireclash classic knight models, used by the default "Classic" graphics
 * setting: chunky, stylised plate armour built from soft, rounded
 * primitives (rounded plates, capsule limbs, smooth domes), after the
 * concept art (great helm with a gilded cross, spiked pauldrons, heraldic
 * shield, tattered cape, tabard and a sheathed runeblade). The high-detail
 * knight lives in models.js. Both carry the same Water Bolt glove, Fire
 * Blast pouch and phase wand.
 * Each palette changes the colours and a few details on the same base model.
 */
(function () {
  'use strict';
  const G = window.G;

  // Heraldry is drawn once per palette and shared between rounds.
  const crestCache = {};

  const hex = (c) => '#' + c.toString(16).padStart(6, '0');

  function drawCharge(g, kind, col) {
    g.fillStyle = col;
    g.strokeStyle = col;
    if (kind === 'lion') {
      // A rampant lion in silhouette: body, mane, raised paws and a curled tail.
      g.beginPath();
      g.ellipse(64, 92, 20, 32, -0.35, 0, Math.PI * 2);
      g.fill();
      // Shaggy mane: a jagged ring of points around the head.
      g.beginPath();
      for (let i = 0; i < 18; i += 1) {
        const a = (i / 18) * Math.PI * 2;
        const r = i % 2 ? 17 : 27;
        g.lineTo(74 + Math.cos(a) * r, 50 + Math.sin(a) * r);
      }
      g.fill();
      // Muzzle and jaw jutting forwards.
      g.fillRect(88, 46, 18, 12);
      g.fillRect(88, 58, 12, 6);
      g.lineWidth = 9;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(74, 74);
      g.lineTo(96, 66);
      g.lineTo(102, 52);
      g.moveTo(70, 86);
      g.lineTo(98, 88);
      g.moveTo(58, 116);
      g.lineTo(76, 136);
      g.moveTo(52, 112);
      g.lineTo(42, 138);
      g.stroke();
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(48, 100);
      g.quadraticCurveTo(22, 96, 30, 66);
      g.quadraticCurveTo(36, 54, 28, 46);
      g.stroke();
      g.beginPath();
      g.arc(28, 42, 8, 0, Math.PI * 2);
      g.fill();
      return;
    }
    if (kind === 'oak') {
      g.fillRect(58, 84, 12, 50);
      for (const [x, y, r] of [[64, 56, 26], [42, 72, 18], [86, 72, 18], [64, 80, 20]]) {
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fill();
      }
      return;
    }
    if (kind === 'tower') {
      g.fillRect(42, 52, 44, 84);
      for (let x = 38; x < 92; x += 14) g.fillRect(x, 36, 9, 20);
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillRect(56, 106, 16, 30);
      g.fillRect(59, 70, 10, 14);
      return;
    }
    // Star: an eight-pointed arcane star inside a ring.
    g.lineWidth = 5;
    g.beginPath();
    g.arc(64, 84, 40, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? 14 : 36;
      g.lineTo(64 + Math.cos(a) * r, 84 + Math.sin(a) * r);
    }
    g.fill();
  }

  // Heraldic face for shields and the chest badge, mapped onto a 1 x 1.25 shape.
  function crestTexture(key, pal) {
    if (crestCache[key]) return crestCache[key];
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 160;
    const g = c.getContext('2d');
    g.fillStyle = hex(pal.field);
    g.fillRect(0, 0, 128, 160);
    const grad = g.createRadialGradient(54, 60, 10, 64, 80, 110);
    grad.addColorStop(0, 'rgba(255,255,255,0.18)');
    grad.addColorStop(1, 'rgba(0,0,0,0.35)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 160);
    // Gilded inner border, following the heater outline.
    g.save();
    g.translate(64, 80);
    g.scale(128 / 1.0, -160 / 1.25);
    g.beginPath();
    heaterPath(g, 0.82);
    g.restore();
    g.lineWidth = 6;
    g.strokeStyle = hex(pal.trim);
    g.stroke();
    drawCharge(g, pal.charge, hex(pal.emblem));
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    // Shape coordinates run from -0.5..0.5 and -0.625..0.625.
    tex.repeat.set(1, 1 / 1.25);
    tex.offset.set(0.5, 0.5);
    crestCache[key] = tex;
    return tex;
  }

  // Heater shield outline (flat top, sides sweeping to a point), centred.
  function heaterPath(p, s) {
    const w = 0.5 * s;
    const top = 0.625 * s;
    p.moveTo(-w, top);
    p.lineTo(w, top);
    p.lineTo(w, 0.05 * s);
    p.quadraticCurveTo(w * 0.95, -0.42 * s, 0, -top);
    p.quadraticCurveTo(-w * 0.95, -0.42 * s, -w, 0.05 * s);
    p.lineTo(-w, top);
  }

  function shieldShape(round) {
    const s = new THREE.Shape();
    if (round) s.absarc(0, 0, 0.5, 0, Math.PI * 2, false);
    else heaterPath(s, 1);
    return s;
  }

  function makeKit(pal) {
    const std = (o) => new THREE.MeshStandardMaterial(o);
    return {
      armour: std({ color: pal.armour, metalness: 0.7, roughness: 0.42 }),
      plate: std({ color: pal.plate || pal.armour, metalness: 0.75, roughness: 0.32 }),
      trim: std({ color: pal.trim, metalness: 0.85, roughness: 0.28 }),
      cloth: std({ color: pal.cloth, roughness: 0.95, side: THREE.DoubleSide }),
      dark: std({ color: pal.dark, roughness: 0.75, metalness: 0.25 }),
      leather: std({ color: pal.leather || 0x5a3a22, roughness: 0.85 }),
      glow: new THREE.MeshBasicMaterial({ color: pal.glow }),
      wood: std({ color: 0x6b4a2b, roughness: 0.8 }),
    };
  }

  function part(geo, mat, x, y, z, parent) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  // Every plate has softly rounded edges, so nothing reads as a cube.
  const box = (w, h, d) => G.roundedBox(w, h, d, Math.min(w, h, d) * 0.42, 2);
  // A limb segment: a capsule of total length len along y.
  const limb = (r, len) => new THREE.CapsuleGeometry(r, Math.max(0.01, len - r * 2), 6, 14);

  function buildLeg(M, pal, leg) {
    part(limb(0.115, 0.48), M.dark, 0, -0.24, 0, leg).scale.z = 1.08;
    part(box(0.23, 0.3, 0.1), M.plate, 0, -0.22, -0.12, leg);
    // Knee cop: a gilded diamond boss.
    const knee = part(new THREE.SphereGeometry(0.09, 16, 12), M.trim, 0, -0.44, -0.15, leg);
    knee.scale.set(1.15, 1, 0.65);
    part(box(0.25, 0.36, 0.28), M.armour, 0, -0.64, 0, leg);
    part(box(0.26, 0.05, 0.3), M.trim, 0, -0.5, 0, leg);
    part(box(0.27, 0.14, 0.38), M.plate, 0, -0.86, -0.05, leg);
    part(box(0.2, 0.08, 0.08), M.trim, 0, -0.84, -0.24, leg);
    if (pal.runes) part(box(0.03, 0.26, 0.02), M.glow, 0, -0.66, -0.145, leg);
  }

  function buildPauldron(M, pal, side, torso) {
    const g = new THREE.Group();
    g.position.set(side * 0.37, 0.58, 0);
    torso.add(g);
    const big = pal.pauldron || 1;
    const dome = new THREE.SphereGeometry(0.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    part(dome, M.plate, 0, 0, 0, g).scale.set(1.15 * big, 0.95, 1.2 * big);
    // Layered lames below the dome, each edged in gold.
    for (let i = 0; i < 2; i += 1) {
      const y = -0.07 - i * 0.09;
      const lame = part(box(0.3 * big, 0.08, 0.42 * big), M.armour, side * (0.04 + i * 0.03), y, 0, g);
      lame.rotation.z = side * -0.35;
      const edge = part(box(0.31 * big, 0.025, 0.43 * big), M.trim, side * (0.05 + i * 0.03), y - 0.04, 0, g);
      edge.rotation.z = side * -0.35;
    }
    part(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 20), M.trim, side * 0.2 * big, -0.02, 0, g).rotation.z =
      Math.PI / 2;
    const spikes = pal.spikes || 0;
    const sg = new THREE.ConeGeometry(0.035, 0.18, 12);
    for (let i = 0; i < spikes; i += 1) {
      const z = spikes === 1 ? 0 : -0.1 + (0.2 * i) / (spikes - 1);
      const s = part(sg, M.trim, side * 0.06, 0.2, z, g);
      s.rotation.z = side * -0.5;
    }
  }

  function buildTorso(M, pal, root) {
    const torso = new THREE.Group();
    torso.position.y = 0.9;
    root.add(torso);
    part(box(0.56, 0.64, 0.34), M.armour, 0, 0.34, 0, torso);
    // Breastplate ridge: two angled plates meeting down the centre.
    for (const s of [-1, 1]) {
      const p = part(box(0.27, 0.46, 0.06), M.plate, s * 0.13, 0.4, -0.18, torso);
      p.rotation.y = s * 0.22;
    }
    part(box(0.6, 0.06, 0.38), M.trim, 0, 0.64, 0, torso);
    part(box(0.12, 0.08, 0.36), M.dark, 0, 0.7, 0, torso);
    // Chest badge carrying the palette's heraldry.
    const crest = crestTexture(pal.key, pal);
    const badgeMat = new THREE.MeshStandardMaterial({ map: crest, metalness: 0.3, roughness: 0.6 });
    const badge = part(new THREE.ShapeGeometry(shieldShape(false)), badgeMat, 0, 0.42, -0.235, torso);
    badge.scale.set(0.2, 0.2, 1);
    badge.rotation.y = Math.PI;
    const rim = part(new THREE.ShapeGeometry(shieldShape(false)), M.trim, 0, 0.42, -0.228, torso);
    rim.scale.set(0.24, 0.24, 1);
    rim.rotation.y = Math.PI;
    for (const s of [-1, 1]) part(new THREE.SphereGeometry(0.025, 12, 8), M.trim, s * 0.19, 0.56, -0.22, torso);
    // Belt and buckle.
    part(box(0.6, 0.09, 0.38), M.leather, 0, 0.02, 0, torso);
    part(box(0.11, 0.09, 0.03), M.trim, 0, 0.02, -0.2, torso);
    // Tabard flaps, ragged at the hem.
    for (const z of [-0.2, 0.2]) {
      part(box(0.3, 0.42, 0.03), M.cloth, 0, -0.22, z, torso);
      for (const [x, len] of [[-0.1, 0.12], [0, 0.07], [0.1, 0.14]]) {
        part(box(0.09, len, 0.03), M.cloth, x, -0.43 - len / 2, z, torso);
      }
    }
    // Faulds: plates over the hips with gilded edges.
    for (const s of [-1, 1]) {
      const f = part(box(0.18, 0.24, 0.32), M.plate, s * 0.24, -0.12, 0, torso);
      f.rotation.z = s * 0.12;
      part(box(0.19, 0.03, 0.33), M.trim, s * 0.26, -0.24, 0, torso).rotation.z = s * 0.12;
    }
    // Scabbard with a sheathed runeblade on the left hip.
    const sheath = new THREE.Group();
    sheath.position.set(-0.32, 0, -0.04);
    sheath.rotation.set(-0.5, 0, 0.12);
    torso.add(sheath);
    part(box(0.07, 0.7, 0.04), M.leather, 0, -0.32, 0, sheath);
    part(box(0.08, 0.06, 0.05), M.trim, 0, -0.68, 0, sheath);
    part(box(0.2, 0.04, 0.05), M.trim, 0, 0.05, 0, sheath);
    part(box(0.04, 0.16, 0.04), M.leather, 0, 0.15, 0, sheath);
    part(new THREE.OctahedronGeometry(0.04), M.glow, 0, 0.25, 0, sheath);
    buildPauldron(M, pal, -1, torso);
    buildPauldron(M, pal, 1, torso);
    return torso;
  }

  function buildHelm(M, pal, root) {
    const head = new THREE.Group();
    head.position.y = 1.55;
    root.add(head);
    const style = pal.helm || 'great';
    if (style === 'kettle') {
      // Open kettle hat over a mail coif: the face is shadowed with glinting eyes.
      part(box(0.29, 0.3, 0.3), M.dark, 0, 0.13, 0, head);
      part(box(0.22, 0.14, 0.02), new THREE.MeshStandardMaterial({ color: 0x1a1410 }), 0, 0.15, -0.155, head);
      for (const s of [-1, 1]) part(box(0.04, 0.03, 0.01), M.glow, s * 0.05, 0.17, -0.168, head);
      const dome = new THREE.SphereGeometry(0.18, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
      part(dome, M.armour, 0, 0.27, 0, head).scale.set(1, 0.9, 1);
      part(new THREE.CylinderGeometry(0.19, 0.26, 0.05, 28), M.armour, 0, 0.26, 0, head);
      part(new THREE.TorusGeometry(0.262, 0.012, 8, 32), M.trim, 0, 0.235, 0, head).rotation.x = Math.PI / 2;
      part(box(0.03, 0.2, 0.3), M.trim, 0, 0.36, 0, head);
      return head;
    }
    // A bucket helm: a deeply rounded shell rather than a block.
    part(G.roundedBox(0.33, 0.36, 0.34, 0.14, 4), M.armour, 0, 0.15, 0, head);
    part(box(0.27, 0.06, 0.28), M.plate, 0, 0.35, 0, head);
    part(box(0.35, 0.05, 0.36), M.trim, 0, 0.32, 0, head);
    part(box(0.35, 0.05, 0.36), M.trim, 0, -0.01, 0, head);
    // Eye slit, a glowing eye, and the breathing grille.
    part(box(0.3, 0.045, 0.02), M.dark, 0, 0.18, -0.172, head);
    if (pal.bothEyes) {
      for (const s of [-1, 1]) part(box(0.06, 0.03, 0.01), M.glow, s * 0.075, 0.18, -0.183, head);
    } else {
      part(box(0.06, 0.03, 0.01), M.glow, -0.075, 0.18, -0.183, head);
    }
    for (const s of [-1, 1]) {
      for (let r = 0; r < 3; r += 1) {
        part(box(0.08, 0.018, 0.01), M.dark, s * 0.08, 0.1 - r * 0.035, -0.174, head);
      }
    }
    // The gilded cross down the face, topped with an arrowhead.
    part(box(0.05, 0.3, 0.025), M.trim, 0, 0.17, -0.18, head);
    const tip = part(new THREE.ConeGeometry(0.05, 0.08, 4), M.trim, 0, 0.36, -0.18, head);
    tip.rotation.y = Math.PI / 4;
    tip.scale.z = 0.4;
    for (const s of [-1, 1]) part(box(0.035, 0.035, 0.03), M.trim, s * 0.15, 0.06, -0.17, head);
    if (pal.plume) {
      const pm = new THREE.MeshStandardMaterial({ color: pal.plume, roughness: 0.9 });
      part(box(0.07, 0.12, 0.3), pm, 0, 0.44, 0.03, head);
      part(box(0.07, 0.36, 0.09), pm, 0, 0.3, 0.24, head).rotation.x = 0.55;
    }
    if (pal.horns) {
      const hg = new THREE.ConeGeometry(0.06, 0.46, 14);
      part(hg, M.trim, -0.22, 0.38, 0, head).rotation.z = 0.7;
      part(hg, M.trim, 0.22, 0.38, 0, head).rotation.z = -0.7;
      part(new THREE.ConeGeometry(0.04, 0.22, 12), M.glow, 0, 0.47, -0.05, head);
    }
    return head;
  }

  function buildArm(M, pal, arm) {
    arm.rotation.order = 'YXZ';
    part(limb(0.085, 0.32), M.dark, 0, -0.15, 0, arm);
    part(box(0.18, 0.12, 0.2), M.plate, 0, -0.32, 0, arm);
    part(box(0.19, 0.24, 0.21), M.armour, 0, -0.48, 0, arm);
    part(box(0.2, 0.04, 0.22), M.trim, 0, -0.38, 0, arm);
    part(box(0.2, 0.04, 0.22), M.trim, 0, -0.59, 0, arm);
    // Chunky gauntlet. The Water Bolt glove replaces it while shown.
    arm.userData.hand = part(box(0.17, 0.12, 0.2), M.plate, 0, -0.66, 0, arm);
    if (pal.runes) part(box(0.02, 0.18, 0.02), M.glow, 0.1, -0.48, 0, arm);
  }

  function buildShield(M, pal, root) {
    const round = pal.shield === 'round';
    const size = round ? 0.5 : 0.62;
    const face = new THREE.MeshStandardMaterial({
      map: crestTexture(pal.key, pal),
      metalness: 0.35,
      roughness: 0.55,
    });
    const settings = { depth: 0.04, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.03, bevelSegments: 4, curveSegments: 24 };
    const shape = shieldShape(round);
    const shield = new THREE.Group();
    // Carried on the left side as in the concept art, facing out and forwards
    // so it never hides the helm or the chest badge.
    shield.position.set(-0.52, 1.02, -0.06);
    shield.rotation.set(0.08, -2.3, 0.06);
    root.add(shield);
    const body = part(new THREE.ExtrudeGeometry(shape, settings), [face, M.armour], 0, 0, 0, shield);
    body.scale.set(size, size, 1);
    // Gilded rim and central boss.
    const rimGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false, curveSegments: 24 });
    const rim = part(rimGeo, M.trim, 0, 0, -0.012, shield);
    rim.scale.set(size * 1.1, size * 1.1, 1);
    if (round) part(new THREE.SphereGeometry(0.06, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.trim, 0, 0, 0.07, shield).rotation.x = Math.PI / 2;
    return shield;
  }

  function buildCape(M, pal, root) {
    const cape = new THREE.Group();
    cape.position.set(0, 1.5, 0.2);
    root.add(cape);
    const len = pal.capeLength || 1.1;
    const strips = [];
    // Uneven strips give the tattered hem from the concept art.
    const cuts = [0.82, 1, 0.9, 0.74, 0.95, 0.8, 0.68];
    const n = cuts.length;
    const w = 0.62 / n;
    for (let i = 0; i < n; i += 1) {
      const strip = new THREE.Group();
      strip.position.x = -0.31 + w * (i + 0.5);
      cape.add(strip);
      const l = len * cuts[i];
      const m = part(box(w + 0.006, l, 0.025), M.cloth, 0, -l / 2, 0, strip);
      m.rotation.y = (i - (n - 1) / 2) * 0.05;
      strips.push(strip);
    }
    part(box(0.6, 0.06, 0.06), M.trim, 0, 0.02, -0.02, cape);
    for (const s of [-1, 1]) part(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 20), M.trim, s * 0.25, 0.0, -0.05, cape).rotation.x = Math.PI / 2;
    return { cape, strips };
  }

  function buildWeapons(M, armR) {
    // Water Bolt (waterbolt.js): the blue glove with water magic in the palm.
    const { bow, bowTip } = G.buildWaterBolt(M, armR);
    // Fire Blast (firebag.js): a magic pouch that breathes fire.
    const { staff, staffTip } = G.buildFireBag(M, armR);

    const potion = new THREE.Group();
    potion.position.y = -0.64;
    armR.add(potion);
    const glass = new THREE.MeshStandardMaterial({ color: 0xff3a6a, emissive: 0x8a1030, transparent: true, opacity: 0.88 });
    part(new THREE.SphereGeometry(0.09, 18, 12), glass, 0, -0.04, 0, potion);
    part(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 12), M.trim, 0, 0.07, 0, potion);
    // Phase wand: a slender rod with gilded bands and a glowing crystal,
    // for phasing your own pieces. It does not fight.
    const wand = new THREE.Group();
    wand.position.y = -0.6;
    wand.visible = false;
    armR.add(wand);
    const rod = new THREE.MeshStandardMaterial({ color: 0x3a2414, roughness: 0.6 });
    part(new THREE.CylinderGeometry(0.011, 0.017, 0.46, 10), rod, 0, -0.18, 0, wand);
    for (const y of [0.03, -0.12, -0.4]) part(new THREE.TorusGeometry(0.017, 0.004, 6, 16), M.trim, 0, y, 0, wand).rotation.x = Math.PI / 2;
    part(new THREE.ConeGeometry(0.02, 0.04, 8), M.trim, 0, -0.42, 0, wand).rotation.x = Math.PI;
    const crystal = part(new THREE.OctahedronGeometry(0.028, 0), new THREE.MeshBasicMaterial({ color: 0x7fc8ff }), 0, -0.47, 0, wand);
    crystal.scale.set(1, 1.7, 1);
    return { bow, staff, potion, wand, bowTip, staffTip };
  }

  G.buildClassicKnight = function (pal) {
    const M = makeKit(pal);
    const root = new THREE.Group();
    root.rotation.order = 'YXZ';

    // Legs pivot at the hip so they can swing.
    const legL = new THREE.Group();
    legL.position.set(-0.14, 0.9, 0);
    const legR = new THREE.Group();
    legR.position.set(0.14, 0.9, 0);
    root.add(legL, legR);
    buildLeg(M, pal, legL);
    buildLeg(M, pal, legR);

    buildTorso(M, pal, root);
    const head = buildHelm(M, pal, root);
    head.rotation.order = 'YXZ';

    // Arms pivot at the shoulder; local -y points down the arm.
    const armR = new THREE.Group();
    armR.position.set(0.38, 1.42, 0);
    const armL = new THREE.Group();
    armL.position.set(-0.38, 1.42, 0);
    root.add(armR, armL);
    buildArm(M, pal, armL);
    buildArm(M, pal, armR);
    buildShield(M, pal, root);
    const weapons = buildWeapons(M, armR);
    const { cape, strips } = buildCape(M, pal, root);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.56, 32),
      new THREE.MeshBasicMaterial({
        color: pal.glow,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    root.add(ring);

    // No cloth simulation here: character.js flutters the strips instead.
    return Object.assign({ root, legL, legR, armL, armR, head, cape, capeStrips: strips, tabard: null, ring }, weapons);
  };

  // The classic cape: the whole cape lifts with speed and in the air, and
  // each tattered strip flutters on its own phase.
  G.flutterClassicCape = function (P, f, onGround, now) {
    P.cape.rotation.x = -(0.1 + f * 0.6 + (onGround ? 0 : 0.4)) - Math.sin(now * 2.3) * 0.05;
    P.capeStrips.forEach((strip, i) => {
      strip.rotation.x = -Math.sin(now * (3 + f * 4) + i * 1.3) * (0.04 + f * 0.1);
    });
  };
})();

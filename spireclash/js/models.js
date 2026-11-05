/**
 * Spireclash knight models, after the concept art: a rounded great helm
 * (helm.js) with a gilded cross, spiked pauldrons, a heraldic shield, flowing cape,
 * tabard and a sheathed runeblade, over the faceted plate from armour.js.
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
    // Battle wear over the paint, from the shared steel texture.
    g.globalAlpha = 0.35;
    g.globalCompositeOperation = 'multiply';
    g.drawImage(G.tex.steel.image, 0, 0, 128, 160);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
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

  const DOUBLE = THREE.DoubleSide;

  function makeKit(pal) {
    const T = G.tex;
    const mailColour = new THREE.Color(pal.dark).lerp(new THREE.Color(pal.armour), 0.5);
    const plate = pal.plate || pal.armour;
    const normalScale = new THREE.Vector2(0.9, 0.9);
    // Worn, faceted steel: flat shading keeps every plate's facets crisp.
    const steel = (color, o) => new THREE.MeshStandardMaterial(Object.assign({
      color,
      map: T.steel,
      normalMap: T.steelNormal,
      normalScale,
      envMap: G.armourEnv || null,
      envMapIntensity: 0.9,
      metalness: 0.7,
      roughness: 0.42,
      flatShading: true,
    }, o));
    const gilt = (o) => new THREE.MeshStandardMaterial(Object.assign({
      color: pal.trim,
      map: T.gold,
      normalMap: T.goldNormal,
      envMap: G.armourEnv || null,
      envMapIntensity: 1.1,
      metalness: 0.82,
      roughness: 0.32,
      flatShading: true,
    }, o));
    return {
      armour: steel(pal.armour),
      plate: steel(plate, { roughness: 0.38 }),
      // Open shells (faulds, lames) are seen from both sides.
      plateOpen: steel(plate, { roughness: 0.38, side: DOUBLE }),
      trim: gilt(),
      trimOpen: gilt({ side: DOUBLE }),
      // Smooth-shaded versions for the rounded pieces (helm, pauldrons).
      armourSmooth: steel(pal.armour, { flatShading: false }),
      plateSmooth: steel(plate, { roughness: 0.38, flatShading: false }),
      plateOpenSmooth: steel(plate, { roughness: 0.38, side: DOUBLE, flatShading: false }),
      trimSmooth: gilt({ flatShading: false }),
      // Boots in a contrasting blackened steel, so they stand out.
      boot: steel(new THREE.Color(pal.dark).lerp(new THREE.Color(plate), 0.22).getHex(), { roughness: 0.4, flatShading: false }),
      mail: new THREE.MeshStandardMaterial({ color: mailColour, map: T.mail, metalness: 0.5, roughness: 0.55 }),
      dark: new THREE.MeshStandardMaterial({ color: pal.dark, roughness: 0.7, metalness: 0.3 }),
      leather: new THREE.MeshStandardMaterial({ color: pal.leather || 0x5a3a22, map: T.leather, roughness: 0.8 }),
      glow: new THREE.MeshBasicMaterial({ color: pal.glow, side: DOUBLE }),
      wood: new THREE.MeshStandardMaterial({ color: 0x8a6440, map: T.bark, roughness: 0.8 }),
    };
  }

  const { part, taper } = G.armour;
  const box = (w, h, d) => G.roundedBox(w, h, d, Math.min(w, h, d) * 0.42, 2);

  function buildShield(M, pal, root) {
    const round = pal.shield === 'round';
    const size = round ? 0.5 : 0.62;
    const face = new THREE.MeshStandardMaterial({
      map: crestTexture(pal.key, pal),
      normalMap: G.tex.steelNormal,
      normalScale: new THREE.Vector2(0.5, 0.5),
      metalness: 0.1,
      roughness: 0.7,
    });
    const shape = shieldShape(round);
    const shield = new THREE.Group();
    // Carried on the left side as in the concept art, facing out and forwards
    // so it never hides the helm or the chest badge.
    shield.position.set(-0.54, 1.02, -0.095);
    shield.rotation.set(0.08, -2.3, 0.06);
    root.add(shield);
    const settings = { depth: 0.03, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1, curveSegments: 16 };
    part(new THREE.ExtrudeGeometry(shape, settings), [face, M.armour], 0, 0, 0.02, shield).scale.set(size, size, 1);
    // Heavy bevelled steel rim, as in the concept art.
    const rimGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.025, bevelSegments: 1, curveSegments: 16 });
    part(rimGeo, M.plate, 0, 0, -0.01, shield).scale.set(size * 1.1, size * 1.1, 1);
    if (round) {
      const boss = new THREE.SphereGeometry(0.06, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2);
      part(boss, M.trim, 0, 0, 0.09, shield).rotation.x = Math.PI / 2;
    }
    return shield;
  }

  function buildWeapons(M, pal, armR) {
    // Water Bolt (waterbolt.js): a heavy crossbow loosing bolts of water.
    const { bow, bowTip } = G.buildWaterBolt(M, armR);

    // Fire Blast (firebag.js): a magic pouch that breathes fire.
    const { staff, staffTip } = G.buildFireBag(M, armR);

    const potion = new THREE.Group();
    potion.position.y = -0.64;
    armR.add(potion);
    const glass = new THREE.MeshStandardMaterial({ color: 0xff3a6a, emissive: 0x8a1030, transparent: true, opacity: 0.88 });
    part(new THREE.SphereGeometry(0.09, 18, 12), glass, 0, -0.04, 0, potion);
    part(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 12), M.trim, 0, 0.07, 0, potion);
    // Phase wand: a slender carved rod with gilded bands and a glowing
    // crystal, for phasing your own pieces. It does not fight.
    const wand = new THREE.Group();
    wand.position.y = -0.6;
    wand.visible = false;
    armR.add(wand);
    const rod = new THREE.MeshStandardMaterial({ color: 0x3a2414, map: G.tex.bark, roughness: 0.6 });
    part(taper(0.011, 0.017, 0.46, 10), rod, 0, -0.18, 0, wand);
    for (const y of [0.03, -0.12, -0.4]) part(new THREE.TorusGeometry(0.017, 0.004, 6, 16), M.trimSmooth, 0, y, 0, wand).rotation.x = Math.PI / 2;
    part(new THREE.ConeGeometry(0.02, 0.04, 8), M.trimSmooth, 0, -0.42, 0, wand).rotation.x = Math.PI;
    const crystal = part(new THREE.OctahedronGeometry(0.028, 0), new THREE.MeshBasicMaterial({ color: 0x7fc8ff }), 0, -0.47, 0, wand);
    crystal.scale.set(1, 1.7, 1);
    return { bow, staff, potion, wand, bowTip, staffTip };
  }

  G.buildKnightModel = function (pal) {
    const M = makeKit(pal);
    const root = new THREE.Group();
    root.rotation.order = 'YXZ';
    const shape = shieldShape(false);
    const crestMat = new THREE.MeshStandardMaterial({ map: crestTexture(pal.key, pal), metalness: 0.1, roughness: 0.7 });

    // Legs pivot at the hip so they can swing.
    const legL = new THREE.Group();
    legL.position.set(-0.13, 0.9, 0);
    const legR = new THREE.Group();
    legR.position.set(0.13, 0.9, 0);
    root.add(legL, legR);
    G.buildLeg(M, pal, legL, -1);
    G.buildLeg(M, pal, legR, 1);

    G.armour.buildTorso(M, pal, root, crestMat, shape);
    const head = G.buildHelm(M, pal, root);
    head.rotation.order = 'YXZ';

    // Arms pivot at the shoulder; local -y points down the arm.
    // The shoulder joints sit up inside the pauldrons' steel cores; the
    // weapon arm a little wider, for the right-handed stance.
    const armR = new THREE.Group();
    armR.position.set(0.39, 1.39, 0);
    const armL = new THREE.Group();
    armL.position.set(-0.34, 1.39, 0);
    // Yaw last, so the body can turn while the arms keep their aim.
    armR.rotation.order = 'YXZ';
    armL.rotation.order = 'YXZ';
    root.add(armR, armL);
    G.armour.buildArm(M, pal, armL, -1);
    G.armour.buildArm(M, pal, armR, 1);
    buildShield(M, pal, root);
    const weapons = buildWeapons(M, pal, armR);
    const cape = G.buildCape(pal, M, part, root);
    const tabard = G.buildTabard(pal, root);

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

    return Object.assign({ root, legL, legR, armL, armR, head, cape, tabard, ring }, weapons);
  };
})();

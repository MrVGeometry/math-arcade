/**
 * Spireclash Fire Blast: a red velvet drawstring bag, like a dice bag,
 * gripped in the right fist by its gathered neck. A squat round sack of
 * crushed velvet hangs below the hand, gathered into soft pleats towards
 * the neck and embroidered with a d20; a black cord cinches it under the
 * fist, looping out at the sides and ending in two silver skull beads; and
 * the ruffled mouth pokes out above the fingers, black-lined, with fire
 * burning in it. The whole bag is thrown out on every shot
 * (Character.animateCast).
 * Bag space (in the right hand): -y forward, -z up, x across; the origin
 * is where the hand closes, 0.6 down the arm.
 */
(function () {
  'use strict';
  const G = window.G;
  const { part } = G.armour;

  // Where the fist closes round the neck, in bag space.
  const GRIP_Y = -0.03;
  // Centre line of the sack, a little in front of the fist, clear of the wrist.
  const SACK_Y = -0.065;
  // The sack's widest radius, and how much it is flattened front to back.
  const BELLY = 0.122;
  const FLAT = 0.9;
  const up = new THREE.Vector3(0, 1, 0);

  let tex = null;

  // Crushed red velvet: soft mottled light and dark patches with fine
  // fuzz, and faint vertical streaks where the pile is brushed. Also the
  // embroidered d20 badge, drawn once.
  function textures() {
    if (tex) return tex;
    const s = 128;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    g.fillStyle = '#b8b8b8';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 70; i += 1) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const r = 6 + Math.random() * 18;
      const light = Math.random() < 0.5;
      for (const ox of [-s, 0, s]) {
        const grad = g.createRadialGradient(x + ox, y, 0, x + ox, y, r);
        grad.addColorStop(0, light ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.22)');
        grad.addColorStop(1, 'rgba(128,128,128,0)');
        g.fillStyle = grad;
        g.fillRect(x + ox - r, y - r, r * 2, r * 2);
      }
    }
    for (let i = 0; i < 40; i += 1) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
      g.fillRect(Math.random() * s, 0, 1 + Math.random() * 3, s);
    }
    G.texKit.grain(g, s, 26);
    const velvet = new THREE.CanvasTexture(c);
    velvet.wrapS = velvet.wrapT = THREE.RepeatWrapping;
    velvet.repeat.set(3, 2);
    velvet.encoding = THREE.sRGBEncoding;
    tex = { velvet, badge: badge() };
    return tex;
  }

  // An embroidered d20: a hexagon outline with the icosahedron's face
  // lines, a paler red fill, and a 20 stitched on the centre face.
  function badge() {
    const s = 128;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    const hex = [0, 1, 2, 3, 4, 5].map((i) => {
      const a = Math.PI / 2 + (i * Math.PI) / 3;
      return [64 + Math.cos(a) * 58, 64 - Math.sin(a) * 58];
    });
    g.beginPath();
    hex.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fillStyle = '#d24a3c';
    g.fill();
    g.strokeStyle = '#140808';
    g.lineWidth = 5;
    g.lineJoin = 'round';
    g.stroke();
    // The centre face, and lines from its corners to the hexagon's.
    const tri = [[64, 30], [96, 86], [32, 86]];
    g.lineWidth = 3.5;
    g.beginPath();
    tri.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    for (const [a, b] of [[0, 0], [0, 1], [0, 5], [1, 1], [1, 2], [1, 3], [2, 3], [2, 4], [2, 5]]) {
      g.moveTo(tri[a][0], tri[a][1]);
      g.lineTo(hex[b][0], hex[b][1]);
    }
    g.stroke();
    g.fillStyle = '#140808';
    g.font = 'bold 19px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('20', 64, 68);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    // Canvas top towards -z (up the bag) once laid on the sack.
    t.flipY = false;
    return t;
  }

  /**
   * A lathe running down the bag (+z) from [radius, depth] pairs, gathered
   * into `pleats` soft folds whose depth is `fold(depth)` (a fraction of
   * the radius). Leaned forwards at the bottom by `lean`.
   */
  function gathered(mat, points, pleats, fold, y, lean, parent) {
    const geo = new THREE.LatheGeometry(points.map(([r, z]) => new THREE.Vector2(r, z)), 72);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i += 1) {
      const a = Math.atan2(p.getX(i), p.getZ(i));
      const k = 1 + fold(p.getY(i)) * Math.sin(a * pleats);
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * k);
    }
    geo.computeVertexNormals();
    const m = part(geo, mat, 0, y, 0, parent);
    m.rotation.x = Math.PI / 2 + lean;
    return m;
  }

  function sack(K, bag) {
    // Squat and round-bottomed, wider than it is tall, the pleats deepest
    // where the cloth gathers in at the top.
    const body = gathered(K.velvet, [
      [0.038, 0.048], [0.08, 0.064], [0.108, 0.088], [0.12, 0.12], [BELLY, 0.16],
      [0.12, 0.2], [0.105, 0.23], [0.07, 0.248], [0, 0.252],
    ], 11, (z) => 0.07 * Math.max(0, 1 - (z - 0.048) / 0.12), SACK_Y, 0, bag);
    body.scale.z = FLAT;
    // The gathered neck rising up through the fist.
    gathered(K.velvet, [[0.034, -0.05], [0.03, -0.01], [0.033, 0.025], [0.044, 0.06]], 8, () => 0.1, GRIP_Y, 0.3, bag);
  }

  function mouth(K, bag) {
    // The ruffled mouth frilling out above the fist, red outside and
    // black-lined within, with fire burning inside it.
    const frill = (z) => 0.13 * Math.max(0, (-z - 0.05) / 0.055);
    const pts = [[0.078, -0.105], [0.074, -0.094], [0.058, -0.08], [0.04, -0.066], [0.034, -0.05]];
    gathered(K.velvet, pts, 9, frill, GRIP_Y, 0.3, bag);
    gathered(K.lining, pts.map(([r, z]) => [r * 0.9, z + 0.002]), 9, frill, GRIP_Y, 0.3, bag);
    part(new THREE.SphereGeometry(0.028, 14, 10), K.fire, 0, -0.005, -0.08, bag).castShadow = false;
  }

  // A cord from a to b.
  function cord(mat, r, a, b, parent) {
    const d = b.clone().sub(a);
    const m = part(new THREE.CylinderGeometry(r, r, d.length(), 6), mat, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, parent);
    m.quaternion.setFromUnitVectors(up, d.normalize());
    m.castShadow = false;
    return m;
  }

  // A small silver skull bead, its face turned along -y of `parent`.
  function skull(K, x, y, z, parent) {
    const s = new THREE.Group();
    s.position.set(x, y, z);
    parent.add(s);
    part(new THREE.SphereGeometry(0.012, 12, 10), K.silver, 0, 0, 0, s).scale.set(1, 0.95, 1.1);
    part(G.roundedBox(0.014, 0.012, 0.008, 0.003, 2), K.silver, 0, -0.004, 0.011, s);
    for (const side of [-1, 1]) part(new THREE.SphereGeometry(0.0035, 8, 6), K.cord, side * 0.0045, -0.0105, 0.002, s);
    return s;
  }

  function drawstring(K, bag) {
    // The cord cinched round the neck just below the fist.
    part(new THREE.TorusGeometry(0.036, 0.006, 8, 24), K.cord, 0, -0.054, 0.05, bag);
    // Two loops flopping out to the sides.
    for (const s of [-1, 1]) {
      // An open loop hanging upright, its gap towards the cinch.
      const geo = new THREE.TorusGeometry(0.03, 0.0045, 6, 20, Math.PI * 1.6);
      geo.rotateZ(s > 0 ? -Math.PI * 0.8 : Math.PI * 0.2);
      geo.rotateX(Math.PI / 2);
      const loop = part(geo, K.cord, s * 0.058, -0.052, 0.062, bag);
      loop.rotation.y = s * 0.35;
      loop.castShadow = false;
    }
  }

  // Laid on the sack facing out at angle `turn` round its axis (0 faces
  // forwards): the embroidered d20 and, with `beads`, the skull-beaded
  // cord ends hanging over it.
  function face(K, turn, beads, bag) {
    const f = new THREE.Group();
    f.position.y = SACK_Y;
    f.rotation.z = turn;
    bag.add(f);
    const out = -BELLY * FLAT;
    for (const s of beads ? [-1, 1] : []) {
      // From the cinch, down over the sack's shoulder.
      const a = new THREE.Vector3(s * 0.014, -0.03, 0.05);
      const b = new THREE.Vector3(s * 0.036, -0.095, 0.1);
      cord(K.cord, 0.0045, a, b, f);
      skull(K, b.x, b.y - 0.004, b.z + 0.012, f);
    }
    // The badge, bent round the sack's curve.
    const geo = new THREE.PlaneGeometry(0.1, 0.1, 8, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i += 1) {
      const x = p.getX(i);
      p.setZ(i, -BELLY * FLAT * (1 - Math.cos(x / (BELLY * FLAT))));
    }
    const m = part(geo, K.badge, 0, out - 0.004, 0.165, f);
    m.rotation.x = Math.PI / 2;
    // Mirrored so the badge reads the right way round from outside.
    m.scale.x = -1;
    m.castShadow = false;
  }

  /** Build the Fire Blast bag into the right arm; returns group and mouth. */
  G.buildFireBag = function (M, armR) {
    const bag = new THREE.Group();
    bag.position.y = -0.6;
    bag.scale.setScalar(1.2);
    armR.add(bag);
    const T = textures();
    const K = {
      velvet: new THREE.MeshPhysicalMaterial({
        color: 0x8c0c08,
        map: T.velvet,
        roughness: 0.85,
        sheen: 0.7,
        sheenColor: new THREE.Color(0xff4a3a),
        sheenRoughness: 0.45,
      }),
      lining: new THREE.MeshStandardMaterial({ color: 0x030203, roughness: 0.95, side: THREE.DoubleSide }),
      cord: new THREE.MeshStandardMaterial({ color: 0x020202, roughness: 0.6 }),
      silver: new THREE.MeshStandardMaterial({ color: 0xdadce2, metalness: 0.9, roughness: 0.28, envMap: G.armourEnv || null }),
      badge: new THREE.MeshStandardMaterial({ map: T.badge, transparent: true, alphaTest: 0.5, roughness: 0.8, side: THREE.DoubleSide }),
      fire: new THREE.MeshBasicMaterial({ color: 0xff8a2a, side: THREE.DoubleSide }),
    };
    sack(K, bag);
    mouth(K, bag);
    drawstring(K, bag);
    // One face towards the rival, one turned back to the player's camera
    // over the right shoulder.
    face(K, 0, false, bag);
    face(K, Math.PI * 0.75, true, bag);
    // Shots leave from the mouth of the bag, above the fist.
    const tip = new THREE.Object3D();
    tip.position.set(0, -0.01, -0.11);
    bag.add(tip);
    return { staff: bag, staffTip: tip };
  };
})();

/**
 * Spireclash Dragonbreath: a pump shotgun built as a dragon. Dark steel
 * receiver and barrel, a ridged pump like a dragon's belly, gilded fins
 * down the spine and small folded wings, and a dragon's head for a muzzle:
 * open jaws lined with teeth, glowing eyes, swept-back horns and fire
 * glowing in its throat. Red scales over the body.
 * Gun space (in the right hand): -y forward, -z up, x across; the hand
 * closes round the receiver at the origin.
 */
(function () {
  'use strict';
  const G = window.G;
  const { part } = G.armour;

  let scaleTex = null;

  // Overlapping dragon scales: rows of rounded plates, lit at the top and
  // shadowed along their lower edge. Returns colour and normal maps.
  function scales() {
    if (scaleTex) return scaleTex;
    const s = 128;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    g.fillStyle = '#5a5a5a';
    g.fillRect(0, 0, s, s);
    const step = 16;
    for (let row = -1; row <= s / (step * 0.6) + 1; row += 1) {
      const y = row * step * 0.6;
      for (let col = -1; col <= s / step + 1; col += 1) {
        const x = col * step + (row % 2 ? step / 2 : 0);
        for (const ox of [-s, 0, s]) {
          const grad = g.createRadialGradient(x + ox, y - 3, 1, x + ox, y, step * 0.62);
          grad.addColorStop(0, '#e0e0e0');
          grad.addColorStop(0.7, '#a0a0a0');
          grad.addColorStop(1, '#2a2a2a');
          g.fillStyle = grad;
          g.beginPath();
          g.arc(x + ox, y, step * 0.6, 0, Math.PI);
          g.fill();
        }
      }
    }
    G.texKit.grain(g, s, 10);
    const map = new THREE.CanvasTexture(c);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(2, 3);
    map.encoding = THREE.sRGBEncoding;
    const normal = new THREE.CanvasTexture(G.heightToNormal(c, 3, 1, true));
    normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
    normal.repeat.set(2, 3);
    scaleTex = { map, normal };
    return scaleTex;
  }

  function ellipsoid(mat, sx, sy, sz, x, y, z, parent) {
    const m = part(new THREE.SphereGeometry(1, 20, 14), mat, x, y, z, parent);
    m.scale.set(sx, sy, sz);
    return m;
  }

  function body(K, M, gun) {
    // Receiver through the fist, with a short scaled tail to the wrist.
    part(G.roundedBox(0.066, 0.22, 0.086, 0.02, 3), K.steel, 0, -0.06, -0.008, gun);
    part(G.roundedBox(0.054, 0.08, 0.072, 0.02, 3), K.scales, 0, 0.07, -0.004, gun);
    part(G.roundedBox(0.058, 0.022, 0.076, 0.009, 2), M.trimSmooth, 0, 0.11, -0.004, gun);
    // Trigger guard and trigger beneath.
    const guard = part(new THREE.TorusGeometry(0.03, 0.005, 6, 16, Math.PI), M.trimSmooth, 0, -0.13, 0.04, gun);
    guard.rotation.set(0, Math.PI / 2, Math.PI);
    part(G.roundedBox(0.008, 0.012, 0.03, 0.003, 1), M.trimSmooth, 0, -0.13, 0.055, gun);
    // Barrel over a magazine tube.
    part(new THREE.CylinderGeometry(0.027, 0.027, 0.46, 14), K.steel, 0, -0.4, -0.02, gun);
    part(new THREE.CylinderGeometry(0.02, 0.02, 0.38, 12), K.steel, 0, -0.36, 0.03, gun);
    // The pump: a dragon's belly, ridged across.
    part(G.roundedBox(0.078, 0.18, 0.1, 0.03, 3), K.scales, 0, -0.32, 0.012, gun);
    for (let i = 0; i < 5; i += 1) {
      part(G.roundedBox(0.084, 0.012, 0.106, 0.005, 2), K.belly, 0, -0.25 - i * 0.035, 0.012, gun);
    }
    // Gilded fins down the spine, shrinking towards the head.
    for (let i = 0; i < 7; i += 1) {
      const k = 1 - i * 0.08;
      const fin = part(new THREE.ConeGeometry(0.012 * k, 0.045 * k, 4), M.trimSmooth, 0, -0.1 - i * 0.065, -0.06, gun);
      fin.rotation.x = -Math.PI / 2 - 0.5;
      fin.scale.x = 0.45;
    }
    // Small folded wings at the receiver's flanks.
    const wing = new THREE.Shape();
    wing.moveTo(0, 0);
    wing.quadraticCurveTo(0.03, -0.02, 0.07, -0.01);
    wing.lineTo(0.05, 0.015);
    wing.lineTo(0.06, 0.04);
    wing.lineTo(0.035, 0.035);
    wing.lineTo(0.03, 0.065);
    wing.quadraticCurveTo(0.01, 0.04, 0, 0);
    const wingGeo = new THREE.ShapeGeometry(wing);
    for (const s of [-1, 1]) {
      const w = part(wingGeo, K.wing, s * 0.036, -0.02, -0.03, gun);
      w.rotation.set(-Math.PI / 2 + 0.5, s * -Math.PI / 2 + s * 0.35, 0);
      w.scale.set(s, 1, 1);
    }
  }

  function head(K, M, parent) {
    // Built at its natural place on the barrel, then swollen about the neck
    // so the dragon dominates the muzzle.
    const neck = new THREE.Group();
    neck.position.y = -0.62;
    neck.scale.setScalar(1.35);
    parent.add(neck);
    const gun = new THREE.Group();
    gun.position.y = 0.62;
    neck.add(gun);
    // Gilded collar where the neck meets the barrel.
    part(new THREE.TorusGeometry(0.036, 0.009, 8, 20), M.trimSmooth, 0, -0.62, -0.012, gun).rotation.x = Math.PI / 2;
    // Skull, upper jaw tilted up and lower jaw dropped open.
    ellipsoid(K.scales, 0.056, 0.085, 0.05, 0, -0.67, -0.018, gun);
    ellipsoid(K.scales, 0.042, 0.085, 0.03, 0, -0.75, -0.03, gun).rotation.x = 0.16;
    ellipsoid(K.scales, 0.034, 0.078, 0.02, 0, -0.73, 0.03, gun).rotation.x = -0.28;
    // Brow ridges over glowing eyes, and nostrils on the snout.
    for (const s of [-1, 1]) {
      ellipsoid(K.scales, 0.018, 0.03, 0.012, s * 0.034, -0.675, -0.052, gun).rotation.z = s * 0.3;
      part(new THREE.SphereGeometry(0.009, 10, 8), K.fire, s * 0.042, -0.69, -0.034, gun);
      part(new THREE.SphereGeometry(0.006, 8, 6), K.dark, s * 0.015, -0.825, -0.046, gun);
    }
    // Teeth along both jaws.
    const tooth = new THREE.ConeGeometry(0.0055, 0.02, 5);
    for (let i = 0; i < 4; i += 1) {
      for (const s of [-1, 1]) {
        const y = -0.7 - i * 0.03;
        part(tooth, K.bone, s * (0.026 - i * 0.003), y, -0.006 + i * 0.003, gun).rotation.x = Math.PI / 2;
        part(tooth, K.bone, s * (0.022 - i * 0.003), y + 0.012, 0.02 + i * 0.006, gun).rotation.x = -Math.PI / 2;
      }
    }
    // Fire glowing in the throat.
    part(new THREE.SphereGeometry(0.026, 14, 10), K.fire, 0, -0.72, 0.004, gun);
    // Horns sweeping back and up from the top of the skull, and small
    // spikes at the cheeks.
    const horn = new THREE.LatheGeometry(
      [[0.012, 0], [0.011, 0.03], [0.008, 0.06], [0.004, 0.09], [0, 0.105]].map(([r, y]) => new THREE.Vector2(r, y)),
      12
    );
    const up = new THREE.Vector3(0, 1, 0);
    for (const s of [-1, 1]) {
      const h = part(horn, M.trimSmooth, s * 0.03, -0.635, -0.05, gun);
      h.quaternion.setFromUnitVectors(up, new THREE.Vector3(s * 0.35, 0.75, -0.55).normalize());
      const spike = part(new THREE.ConeGeometry(0.006, 0.035, 5), M.trimSmooth, s * 0.052, -0.66, -0.005, gun);
      spike.quaternion.setFromUnitVectors(up, new THREE.Vector3(s * 0.6, 0.8, 0).normalize());
    }
  }

  /** Build the Dragonbreath into the right arm; returns group and muzzle. */
  G.buildDragonbreath = function (M, armR) {
    const gun = new THREE.Group();
    gun.position.y = -0.6;
    gun.scale.setScalar(1.15);
    armR.add(gun);
    const tex = scales();
    const env = G.armourEnv || null;
    const K = {
      scales: new THREE.MeshStandardMaterial({ color: 0x9a2416, map: tex.map, normalMap: tex.normal, roughness: 0.45, metalness: 0.35, envMap: env, envMapIntensity: 0.6 }),
      belly: new THREE.MeshStandardMaterial({ color: 0xc8955a, map: G.tex.leather, roughness: 0.6, metalness: 0.15 }),
      wing: new THREE.MeshStandardMaterial({ color: 0x6e160e, map: tex.map, roughness: 0.6, side: THREE.DoubleSide }),
      steel: new THREE.MeshStandardMaterial({ color: 0x3c3e44, map: G.tex.steel, metalness: 0.8, roughness: 0.35, envMap: env, envMapIntensity: 0.9 }),
      bone: new THREE.MeshStandardMaterial({ color: 0xeee2c4, roughness: 0.5 }),
      dark: new THREE.MeshBasicMaterial({ color: 0x120604 }),
      fire: new THREE.MeshBasicMaterial({ color: 0xff8a2a }),
    };
    body(K, M, gun);
    head(K, M, gun);
    // Shots leave from between the jaws.
    const tip = new THREE.Object3D();
    tip.position.set(0, -0.86, 0.004);
    gun.add(tip);
    return { staff: gun, staffTip: tip };
  };
})();

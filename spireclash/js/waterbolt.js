/**
 * Spireclash Water Bolt: no weapon at all, just the right hand held out in
 * a puffy blue cartoon glove, palm pushed forwards: a rolled cuff, a broad
 * soft palm, four fat fingers pressed together and the thumb out to the
 * side, with water magic glowing in the palm. It replaces the armoured
 * fist while shown.
 * Glove space (in the right hand): -y forward along the arm, -z up,
 * x across. The wrist sits at the origin.
 */
(function () {
  'use strict';
  const G = window.G;
  const { part } = G.armour;

  const ball = new THREE.SphereGeometry(1, 24, 18);

  function blob(mat, sx, sy, sz, x, y, z, parent) {
    const m = part(ball, mat, x, y, z, parent);
    m.scale.set(sx, sy, sz);
    return m;
  }

  // A fat capsule from point a to point b (a finger or the thumb),
  // flattened a little front to back like a cartoon glove's fingers.
  function digit(mat, r, a, b, parent) {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = Math.max(0.001, d.length() - r * 2);
    const m = part(new THREE.CapsuleGeometry(r, len, 6, 14), mat, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, parent);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    m.scale.z = 0.85;
    return m;
  }

  function hand(K, g) {
    // A thick rolled cuff round the wrist, and a soft wrist into the palm.
    part(new THREE.TorusGeometry(0.05, 0.024, 14, 28), K.cuff, 0, 0.005, 0, g).rotation.x = Math.PI / 2;
    blob(K.glove, 0.048, 0.04, 0.045, 0, -0.03, -0.004, g);
    // The palm, bent back at the wrist so it faces forwards, broad and
    // rounded with the thumb's pad swelling on the inside.
    blob(K.glove, 0.068, 0.032, 0.066, 0, -0.06, -0.05, g);
    blob(K.glove, 0.036, 0.028, 0.04, -0.03, -0.062, -0.03, g);
    // Four fat fingers side by side, the middle one tallest and the little
    // finger shortest.
    const fingers = [[-0.039, 0.074], [-0.013, 0.086], [0.013, 0.08], [0.039, 0.066]];
    for (const [x, len] of fingers) {
      const base = new THREE.Vector3(x, -0.062, -0.085);
      const tip = new THREE.Vector3(x * 1.08, -0.066, -0.085 - len);
      digit(K.glove, 0.0145, base, tip, g);
    }
    // The thumb, splayed out and up on the inside.
    digit(K.glove, 0.016, new THREE.Vector3(-0.05, -0.06, -0.035), new THREE.Vector3(-0.098, -0.066, -0.085), g);
  }

  function magic(K, g) {
    // A bright core of water held in front of the palm, a clear blue shell
    // round it and a thin ring of light.
    blob(K.core, 0.013, 0.013, 0.013, 0, -0.105, -0.055, g);
    blob(K.shell, 0.021, 0.021, 0.021, 0, -0.105, -0.055, g).castShadow = false;
    const ring = part(new THREE.TorusGeometry(0.03, 0.0024, 6, 32), K.core, 0, -0.098, -0.055, g);
    ring.rotation.x = Math.PI / 2;
    ring.castShadow = false;
  }

  /** Build the Water Bolt glove onto the right arm; returns it and muzzle. */
  G.buildWaterBolt = function (M, armR) {
    const glove = new THREE.Group();
    glove.position.y = -0.58;
    // Oversized, cartoon fashion: half as big again as the armoured fist.
    glove.scale.set(1.8, 1.65, 1.8);
    armR.add(glove);
    const K = {
      glove: new THREE.MeshStandardMaterial({ color: 0x2a6fe0, roughness: 0.6, metalness: 0 }),
      cuff: new THREE.MeshStandardMaterial({ color: 0x3a82ee, roughness: 0.65, metalness: 0 }),
      core: new THREE.MeshBasicMaterial({ color: 0xbff0ff }),
      shell: new THREE.MeshBasicMaterial({ color: 0x3aa8ff, transparent: true, opacity: 0.5, depthWrite: false }),
    };
    hand(K, glove);
    magic(K, glove);
    // Water bolts leave from just in front of the palm.
    const bowTip = new THREE.Object3D();
    bowTip.position.set(0, -0.13, -0.055);
    glove.add(bowTip);
    return { bow: glove, bowTip };
  };
})();

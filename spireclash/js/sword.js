/**
 * Spireclash runeblade, sheathed on the left hip: a smooth tapering
 * leather scabbard with stitched seams, gilded mounts at the mouth, middle
 * and tip, and a glowing rune line down its face; above it a flared gilded
 * crossguard set with a glowing gem, a leather grip bound in a spiral, and
 * a gilded pommel holding another gem.
 * Sheath space: +y up the hilt, -y down the blade, -x the outer face (the
 * blade's flat faces outwards; the guard points fore and aft).
 */
(function () {
  'use strict';
  const G = window.G;
  const { part } = G.armour;

  const lathe = (pts, segs) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs || 20);

  function scabbard(M, sheath) {
    // Flattened, tapering leather body, rounded off at the tip.
    const body = lathe([[0.006, -0.7], [0.02, -0.685], [0.026, -0.62], [0.031, -0.35], [0.035, -0.08], [0.035, 0]]);
    part(body, M.leather, 0, 0, 0, sheath).scale.x = 0.5;
    // Gilded locket at the mouth, a band halfway and a chape on the tip.
    part(lathe([[0.037, -0.075], [0.041, -0.06], [0.041, 0.005], [0.037, 0.02]]), M.trimSmooth, 0, 0, 0, sheath).scale.x = 0.55;
    part(lathe([[0.034, -0.36], [0.037, -0.35], [0.037, -0.33], [0.034, -0.32]]), M.trimSmooth, 0, 0, 0, sheath).scale.x = 0.55;
    part(lathe([[0.002, -0.715], [0.016, -0.7], [0.026, -0.64], [0.028, -0.6], [0.025, -0.59]]), M.trimSmooth, 0, 0, 0, sheath).scale.x = 0.58;
    // A rune line glowing down the outer face between the mounts.
    const rune = part(new THREE.PlaneGeometry(0.008, 0.22), M.glow, -0.0185, -0.2, 0, sheath);
    rune.rotation.y = -Math.PI / 2;
    rune.castShadow = false;
    const rune2 = part(new THREE.PlaneGeometry(0.007, 0.18), M.glow, -0.0165, -0.47, 0, sheath);
    rune2.rotation.y = -Math.PI / 2;
    rune2.castShadow = false;
  }

  function hilt(M, sheath) {
    // Crossguard: a gilded block flaring out into curled, rounded quillons.
    part(G.roundedBox(0.04, 0.04, 0.05, 0.012, 3), M.trimSmooth, 0, 0.035, 0, sheath);
    for (const s of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(0, 0.035, s * 0.022);
      arm.rotation.x = s * (Math.PI / 2 - 0.2);
      sheath.add(arm);
      part(lathe([[0.016, 0], [0.014, 0.03], [0.011, 0.06], [0.013, 0.075], [0.016, 0.085], [0, 0.1]], 14), M.trimSmooth, 0, 0, 0, arm).scale.x = 0.8;
    }
    // Glowing gem set in the guard, on the outer face.
    part(new THREE.SphereGeometry(0.013, 12, 8), M.glow, -0.02, 0.035, 0, sheath).scale.x = 0.6;
    // Grip: leather bound in a spiral of raised cord.
    part(lathe([[0.016, 0.055], [0.019, 0.1], [0.017, 0.16], [0.015, 0.175]], 14), M.leather, 0, 0, 0, sheath);
    for (let i = 0; i < 6; i += 1) {
      const wrap = part(new THREE.TorusGeometry(0.0185, 0.0035, 6, 16), M.leather, 0, 0.068 + i * 0.019, 0, sheath);
      wrap.rotation.set(Math.PI / 2 + 0.3, 0, 0);
    }
    // Pommel: a gilded ball with a collar, holding a gem.
    part(lathe([[0.012, 0.172], [0.02, 0.18], [0.022, 0.186], [0.016, 0.192]], 14), M.trimSmooth, 0, 0, 0, sheath);
    part(new THREE.SphereGeometry(0.024, 16, 12), M.trimSmooth, 0, 0.212, 0, sheath);
    part(new THREE.IcosahedronGeometry(0.012, 1), M.glow, -0.02, 0.212, 0, sheath);
  }

  G.buildScabbard = function (M, torso) {
    const sheath = new THREE.Group();
    sheath.position.set(-0.29, 0.02, -0.02);
    sheath.rotation.set(-0.5, 0, 0.12);
    // A touch larger than life, to hold its own against the armour.
    sheath.scale.setScalar(1.15);
    torso.add(sheath);
    scabbard(M, sheath);
    hilt(M, sheath);
    return sheath;
  };
})();

/**
 * Spireclash runebow: a heavy crossbow held in the right hand. A long
 * lacquered tiller studded down both sides, a strongly recurved gilded prod
 * across the front, the string drawn back to a latch on top, a bolt with
 * coloured fletching resting in the groove, a trigger beneath, and a faint
 * rune glow along the tiller.
 * Bow space (in the right hand): -y forward along the tiller, -z up,
 * x across. The hand closes round the tiller at the origin.
 */
(function () {
  'use strict';
  const G = window.G;
  const { part } = G.armour;

  // A thin cylinder from point a to point b.
  function rod(mat, r, a, b, parent) {
    const d = new THREE.Vector3().subVectors(b, a);
    const m = part(new THREE.CylinderGeometry(r, r, d.length(), 6), mat, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, parent);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    m.castShadow = false;
    return m;
  }

  function tiller(M, wood, bow) {
    // The long stock, ending at the wrist in a gilded cap and thickening a
    // little at the fore-end under the prod.
    part(G.roundedBox(0.05, 0.66, 0.07, 0.018, 3), wood, 0, -0.29, 0, bow);
    part(G.roundedBox(0.056, 0.14, 0.078, 0.02, 3), wood, 0, -0.55, 0.002, bow);
    part(G.roundedBox(0.056, 0.03, 0.076, 0.012, 3), M.trimSmooth, 0, 0.045, 0, bow);
    // Gilded rail along the top, with the bolt groove.
    part(G.roundedBox(0.018, 0.5, 0.008, 0.003, 2), M.trimSmooth, 0, -0.36, -0.037, bow);
    // Gilded studs down both sides.
    const stud = new THREE.SphereGeometry(0.0065, 8, 6);
    for (let i = 0; i < 12; i += 1) {
      for (const s of [-1, 1]) part(stud, M.trimSmooth, s * 0.026, -0.08 - i * 0.042, -0.012, bow);
    }
    // A faint rune line glowing along each side, below the studs.
    for (const s of [-1, 1]) {
      const rune = part(new THREE.PlaneGeometry(0.34, 0.006), M.glow, s * 0.0255, -0.3, 0.014, bow);
      rune.rotation.set(0, s * Math.PI / 2, Math.PI / 2);
      rune.castShadow = false;
    }
    // Trigger lever curling down in front of the hand.
    const trigger = part(new THREE.TorusGeometry(0.022, 0.0045, 6, 12, Math.PI * 0.8), M.trimSmooth, 0, -0.11, 0.04, bow);
    trigger.rotation.set(0, Math.PI / 2, Math.PI * 0.6);
  }

  function prod(M, pal, bow) {
    const front = -0.6;
    // Gilded bow-iron holding the prod, set with a rune gem.
    part(G.roundedBox(0.075, 0.05, 0.06, 0.015, 3), M.trimSmooth, 0, front, -0.004, bow);
    part(new THREE.SphereGeometry(0.012, 12, 8), M.glow, 0, front - 0.026, -0.004, bow);
    // Recurved limbs: out and back from the bow-iron, then flicking
    // forwards again at the tips.
    const tips = [];
    for (const s of [-1, 1]) {
      const pts = [
        [0.03, front - 0.01], [0.12, front], [0.22, front + 0.035], [0.3, front + 0.09],
        [0.35, front + 0.13], [0.378, front + 0.125], [0.39, front + 0.095],
      ].map(([x, y]) => new THREE.Vector3(s * x, y, -0.004));
      const limb = part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.02, 10, false), M.trimSmooth, 0, 0, 0, bow);
      limb.scale.z = 0.75;
      const tip = pts[pts.length - 1];
      part(new THREE.SphereGeometry(0.017, 10, 8), M.trimSmooth, tip.x, tip.y, tip.z, bow);
      tips.push(tip);
    }
    // The string, drawn back from both tips to the latch on top.
    const string = new THREE.MeshStandardMaterial({ color: 0xd9cfb4, roughness: 0.9 });
    const latch = new THREE.Vector3(0, -0.03, -0.046);
    for (const tip of tips) rod(string, 0.0035, tip, latch, bow);
    const nut = part(new THREE.CylinderGeometry(0.014, 0.014, 0.034, 12), M.trimSmooth, 0, -0.03, -0.044, bow);
    nut.rotation.z = Math.PI / 2;
    // A bolt in the groove: shaft, steel head, and fletching in the
    // palette's cloth colour.
    rod(new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.7 }), 0.0055, new THREE.Vector3(0, -0.05, -0.048), new THREE.Vector3(0, -0.74, -0.048), bow);
    const head = part(new THREE.ConeGeometry(0.012, 0.045, 4), M.plateSmooth, 0, -0.76, -0.048, bow);
    head.rotation.x = Math.PI;
    const fletch = new THREE.MeshStandardMaterial({ color: pal.cloth, roughness: 0.9, side: THREE.DoubleSide });
    // One vane straight up, the other two spaced evenly round the shaft.
    for (const a of [Math.PI / 2, Math.PI / 2 + (Math.PI * 2) / 3, Math.PI / 2 - (Math.PI * 2) / 3]) {
      const vane = new THREE.Group();
      vane.position.set(0, -0.1, -0.048);
      vane.rotation.y = a;
      bow.add(vane);
      const shape = new THREE.Shape();
      shape.moveTo(0, 0.04);
      shape.lineTo(0.016, 0.03);
      shape.lineTo(0.012, -0.03);
      shape.lineTo(0, -0.03);
      part(new THREE.ShapeGeometry(shape), fletch, 0.004, 0, 0, vane).castShadow = false;
    }
  }

  /** Build the runebow into the right arm; returns the group and muzzle. */
  G.buildRunebow = function (M, pal, armR) {
    const bow = new THREE.Group();
    bow.position.y = -0.6;
    // Sized up to suit the knights' heavy build.
    bow.scale.setScalar(1.2);
    armR.add(bow);
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a2a1c, map: G.tex.leather, roughness: 0.45, metalness: 0.05 });
    tiller(M, wood, bow);
    prod(M, pal, bow);
    // Bolts fly from just beyond the bolt's head.
    const bowTip = new THREE.Object3D();
    bowTip.position.set(0, -0.79, -0.048);
    bow.add(bowTip);
    return { bow, bowTip };
  };
})();

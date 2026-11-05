/**
 * Spireclash Water Bolt shots: each one flies as a small glowing bolt of
 * water, a bright core in a soft blue halo trailing a string of tiny
 * droplets, and splashes where it lands.
 * Built on the shared effect list in combat.js (G.fx.spawn).
 */
(function () {
  'use strict';
  const G = window.G;

  const SPEED = 95;
  const TRAIL = 6;
  const SPLASH = 9;
  const SPLASH_TIME = 0.4;
  const CORE = 0xd4f6ff;
  const WATER = 0x48b4ff;
  const dropGeo = new THREE.SphereGeometry(1, 10, 8);

  // Soft halo sprite: near-white at the centre through blue to clear.
  let haloTex = null;
  function halo() {
    if (haloTex) return haloTex;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(230,250,255,1)');
    grad.addColorStop(0.3, 'rgba(120,210,255,0.8)');
    grad.addColorStop(0.65, 'rgba(40,130,230,0.3)');
    grad.addColorStop(1, 'rgba(20,80,200,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    haloTex = new THREE.CanvasTexture(c);
    haloTex.encoding = THREE.sRGBEncoding;
    return haloTex;
  }

  /**
   * One small water bolt flying from a to b. onArrive runs as it lands,
   * where it bursts into a splash of droplets that fall under gravity.
   */
  function waterBolt(a, b, onArrive) {
    const from = a.clone();
    const to = b.clone();
    const dist = from.distanceTo(to);
    const dir = to.clone().sub(from).normalize();
    const flight = Math.max(0.04, dist / SPEED);
    const coreMat = new THREE.MeshBasicMaterial({ color: CORE, transparent: true, opacity: 0.95 });
    // Solid rather than additive, so the droplets still read against a
    // bright sky.
    const dropMat = new THREE.MeshBasicMaterial({ color: WATER, transparent: true, opacity: 0.9 });
    const haloMat = new THREE.SpriteMaterial({
      map: halo(),
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    // The bolt: a stretched droplet pointing along its flight.
    const core = new THREE.Mesh(dropGeo, coreMat);
    core.scale.set(0.04, 0.04, 0.13);
    core.position.copy(from);
    core.lookAt(to);
    const glow = new THREE.Sprite(haloMat);
    glow.scale.setScalar(0.28);
    glow.position.copy(from);
    const objs = [core, glow];
    // Tiny droplets strung out behind, shrinking towards the tail.
    const trail = [];
    for (let i = 1; i <= TRAIL; i += 1) {
      const d = new THREE.Mesh(dropGeo, dropMat);
      d.scale.setScalar(0.036 * (1 - i / (TRAIL + 2)));
      d.position.copy(from);
      d.userData = { i, wobble: G.rand(0, 6) };
      trail.push(d);
      objs.push(d);
    }
    // The splash, hidden until the bolt lands, thrown back off the surface.
    const splash = [];
    for (let i = 0; i < SPLASH; i += 1) {
      const d = new THREE.Mesh(dropGeo, dropMat);
      d.visible = false;
      d.scale.setScalar(G.rand(0.022, 0.038));
      d.userData.v = new THREE.Vector3(G.rand(-2.5, 2.5), G.rand(1.5, 4.5), G.rand(-2.5, 2.5)).addScaledVector(dir, -1.5);
      splash.push(d);
      objs.push(d);
    }
    G.fx.spawn(objs, [coreMat, dropMat, haloMat], flight + SPLASH_TIME, (e, f, dt) => {
      const k = Math.min(1, e.t / flight);
      if (k < 1) {
        core.position.lerpVectors(from, to, k);
        glow.position.copy(core.position);
        for (const d of trail) {
          const back = Math.max(0, dist * k - d.userData.i * 0.15);
          d.position.copy(from).addScaledVector(dir, back);
          d.position.y += 0.015 * Math.sin(e.t * 45 + d.userData.wobble);
        }
        return;
      }
      if (!e.arrived) {
        e.arrived = true;
        if (onArrive) onArrive();
        core.visible = false;
        glow.position.copy(to);
        for (const d of trail) d.visible = false;
        for (const d of splash) {
          d.visible = true;
          d.position.copy(to);
        }
      }
      const after = Math.min(1, (e.t - flight) / SPLASH_TIME);
      haloMat.opacity = Math.max(0, 1 - after * 3);
      dropMat.opacity = 0.9 * (1 - after);
      for (const d of splash) {
        d.userData.v.y -= 14 * dt;
        d.position.addScaledVector(d.userData.v, dt);
      }
    });
  }

  G.fx.waterBolt = waterBolt;
})();

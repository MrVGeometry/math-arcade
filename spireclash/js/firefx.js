/**
 * Spireclash Dragonbreath fire: each shot throws a cone of flame and
 * scattering embers from the dragon's jaws, and every pellet flies as a
 * burning streak with a flickering flame trail that bursts where it lands.
 * Built on the shared effect list in combat.js (G.fx.spawn).
 */
(function () {
  'use strict';
  const G = window.G;

  // Soft flame sprite: white-hot core through yellow and orange to a dark
  // red fringe.
  let flameTex = null;
  function flame() {
    if (flameTex) return flameTex;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,240,1)');
    grad.addColorStop(0.2, 'rgba(255,225,130,0.95)');
    grad.addColorStop(0.45, 'rgba(255,140,40,0.7)');
    grad.addColorStop(0.75, 'rgba(190,45,10,0.3)');
    grad.addColorStop(1, 'rgba(120,20,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    flameTex = new THREE.CanvasTexture(c);
    flameTex.encoding = THREE.sRGBEncoding;
    return flameTex;
  }

  // Tints over the flame sprite: yellow-orange when fresh, deep red as it
  // cools (kept off white, so it never washes out against a bright sky).
  const HOT = new THREE.Color(0xffb040);
  const COOL = new THREE.Color(0xc02800);

  function sprite(scale) {
    const mat = new THREE.SpriteMaterial({
      map: flame(),
      color: 0xffffff,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const s = new THREE.Sprite(mat);
    s.scale.setScalar(scale);
    return s;
  }

  // A unit vector perpendicular-ish spread around dir, by up to `cone`.
  function scatter(dir, cone, out) {
    out.set(G.rand(-1, 1), G.rand(-1, 1), G.rand(-1, 1)).multiplyScalar(cone);
    return out.add(dir).normalize();
  }

  /** The cone of flame and embers bursting from the muzzle. */
  function fireBlast(pos, dir) {
    const objs = [];
    const mats = [];
    const tmp = new THREE.Vector3();
    for (let i = 0; i < 16; i += 1) {
      const s = sprite(0.15);
      s.position.copy(pos);
      const speed = G.rand(5, 15);
      s.userData = {
        v: scatter(dir, 0.32, tmp).clone().multiplyScalar(speed),
        life: G.rand(0.22, 0.42),
        grow: G.rand(0.6, 1.1),
      };
      objs.push(s);
      mats.push(s.material);
    }
    // Embers: tiny, fast and long-lived, arcing down under gravity.
    for (let i = 0; i < 12; i += 1) {
      const s = sprite(0.06);
      s.position.copy(pos);
      s.userData = {
        v: scatter(dir, 0.4, tmp).clone().multiplyScalar(G.rand(10, 22)),
        life: G.rand(0.4, 0.75),
        ember: true,
      };
      objs.push(s);
      mats.push(s.material);
    }
    G.fx.spawn(objs, mats, 0.75, (e, f, dt) => {
      for (const o of e.objs) {
        const u = o.userData;
        const k = Math.min(1, e.t / u.life);
        o.visible = k < 1;
        if (!o.visible) continue;
        if (u.ember) {
          u.v.y -= 9 * dt;
          o.material.color.copy(HOT);
          o.material.opacity = 1 - k * k;
        } else {
          // Flames slow, swell and rise as they burn out.
          u.v.multiplyScalar(1 - Math.min(1, dt * 4));
          u.v.y += 2.5 * dt;
          o.scale.setScalar(0.15 + u.grow * k);
          o.material.opacity = 0.8 * (1 - k);
          o.material.color.copy(HOT).lerp(COOL, Math.min(1, k * 1.6));
        }
        o.position.addScaledVector(u.v, dt);
      }
    });
  }

  /**
   * One burning pellet flying from a to b, trailing flame. onArrive runs as
   * it lands, where it bursts into a small flare of fire.
   */
  function firePellet(a, b, onArrive) {
    const from = a.clone();
    const to = b.clone();
    const dist = from.distanceTo(to);
    const dir = to.clone().sub(from).normalize();
    const speed = G.rand(55, 70);
    const flight = Math.max(0.03, dist / speed);
    const objs = [];
    const mats = [];
    // Head and a tail of sprites strung out behind it, fading and shrinking.
    const TRAIL = 11;
    for (let i = 0; i <= TRAIL; i += 1) {
      const s = sprite(0.32 * (1 - i / (TRAIL + 2)));
      s.position.copy(from);
      s.userData = { i, flick: G.rand(0, 6) };
      objs.push(s);
      mats.push(s.material);
    }
    // The flare where it lands.
    const burst = [];
    for (let i = 0; i < 5; i += 1) {
      const s = sprite(0.1);
      s.visible = false;
      s.userData = { v: new THREE.Vector3(G.rand(-1.5, 1.5), G.rand(0.5, 2.5), G.rand(-1.5, 1.5)), burst: true };
      objs.push(s);
      mats.push(s.material);
      burst.push(s);
    }
    const spacing = 0.2;
    const burn = 0.35;
    G.fx.spawn(objs, mats, flight + burn, (e, f, dt) => {
      const travelled = Math.min(dist, (e.t / flight) * dist);
      const after = Math.max(0, e.t - flight);
      if (e.t >= flight && !e.arrived) {
        e.arrived = true;
        if (onArrive) onArrive();
        for (const s of burst) {
          s.visible = true;
          s.position.copy(to);
        }
      }
      for (const o of e.objs) {
        const u = o.userData;
        if (u.burst) {
          if (!o.visible) continue;
          const k = after / burn;
          o.position.addScaledVector(u.v, dt);
          o.scale.setScalar(0.1 + 0.4 * k);
          o.material.opacity = 1 - k;
          o.material.color.copy(HOT).lerp(COOL, k);
          continue;
        }
        // Strung out behind the head; the tail catches up once it lands.
        const back = Math.max(0, travelled - u.i * spacing - after * 12);
        o.position.copy(from).addScaledVector(dir, back);
        const fade = e.arrived ? Math.max(0, 1 - after / 0.12) : 1;
        const flicker = 0.85 + 0.3 * Math.sin(e.t * 60 + u.flick);
        o.material.opacity = 0.85 * fade * (1 - u.i / (TRAIL + 1)) * flicker;
        o.material.color.copy(HOT).lerp(COOL, u.i / TRAIL);
      }
    });
  }

  G.fx.fireBlast = fireBlast;
  G.fx.firePellet = firePellet;
})();

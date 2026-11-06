/**
 * Spireclash classic world: the original, lighter duelling ground used by
 * the default "Classic" graphics setting. Plain shaded shapes and a few
 * small canvas textures, with none of the painted terrain, sculpted trees,
 * textured castle or glass gems of the high-detail world (world.js).
 * There is no castle here, to keep it light. A wizard's tower stands to
 * the east, floating
 * islands drift overhead and a pine forest rings the arena.
 */
(function () {
  'use strict';
  const G = window.G;

  /* ---------------------------------------------------------------------- */
  /* Classic textures: small canvases, no painted or normal maps             */
  /* ---------------------------------------------------------------------- */

  const { canvas, texture, grain } = G.texKit;

  // A stone block with soft rounded corners, lit from above.
  function softBlock(x, px, py, w, h, rad, hue, sat, light) {
    const g = x.createLinearGradient(0, py, 0, py + h);
    g.addColorStop(0, `hsl(${hue}, ${sat}%, ${light + 9}%)`);
    g.addColorStop(0.55, `hsl(${hue}, ${sat}%, ${light}%)`);
    g.addColorStop(1, `hsl(${hue}, ${sat}%, ${light - 9}%)`);
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(px + rad, py);
    x.arcTo(px + w, py, px + w, py + h, rad);
    x.arcTo(px + w, py + h, px, py + h, rad);
    x.arcTo(px, py + h, px, py, rad);
    x.arcTo(px, py, px + w, py, rad);
    x.closePath();
    x.fill();
    // A thin highlight along the top edge gives each block a bevel.
    x.strokeStyle = 'rgba(255,255,255,0.12)';
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(px + rad, py + 1.5);
    x.lineTo(px + w - rad, py + 1.5);
    x.stroke();
  }

  // Large dressed stones in soft courses, with light mortar.
  function brick() {
    const s = 512;
    const c = canvas(s);
    const x = c.getContext('2d');
    x.fillStyle = '#7d7468';
    x.fillRect(0, 0, s, s);
    const rows = 4;
    const bh = s / rows;
    const bw = s / 2;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? bw / 2 : 0;
      for (let b = -1; b < 3; b++) {
        softBlock(x, b * bw + off + 4, r * bh + 4, bw - 8, bh - 8, 18, 32, 9 + Math.random() * 5, 52 + Math.random() * 9);
      }
    }
    grain(x, s, 8);
    return texture(c);
  }

  function flagstone() {
    const s = 512;
    const c = canvas(s);
    const x = c.getContext('2d');
    x.fillStyle = '#6e675d';
    x.fillRect(0, 0, s, s);
    for (let a = 0; a < 2; a++) {
      for (let b = 0; b < 2; b++) {
        softBlock(x, a * 256 + 5, b * 256 + 5, 246, 246, 26, 36, 8 + Math.random() * 4, 54 + Math.random() * 8);
      }
    }
    grain(x, s, 7);
    return texture(c);
  }

  function stairs() {
    const s = 512;
    const c = canvas(s);
    const x = c.getContext('2d');
    x.fillStyle = '#6e675d';
    x.fillRect(0, 0, s, s);
    const bands = 5;
    const bh = s / bands;
    for (let i = 0; i < bands; i++) {
      softBlock(x, 5, i * bh + 4, s - 10, bh - 8, 16, 33, 9, 52 + Math.random() * 7);
    }
    grain(x, s, 7);
    return texture(c);
  }

  // Overlapping rounded roof tiles.
  function slate() {
    const s = 512;
    const c = canvas(s);
    const x = c.getContext('2d');
    x.fillStyle = '#2a3145';
    x.fillRect(0, 0, s, s);
    const rows = 6;
    const rh = s / rows;
    const tw = s / 6;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? tw / 2 : 0;
      for (let b = -1; b < 7; b++) {
        const px = b * tw + off + 3;
        const py = r * rh;
        const g = x.createLinearGradient(0, py, 0, py + rh);
        const l = 34 + Math.random() * 8;
        g.addColorStop(0, `hsl(224, 22%, ${l - 6}%)`);
        g.addColorStop(1, `hsl(224, 22%, ${l + 6}%)`);
        x.fillStyle = g;
        x.beginPath();
        x.moveTo(px, py);
        x.lineTo(px + tw - 6, py);
        x.lineTo(px + tw - 6, py + rh * 0.55);
        x.quadraticCurveTo(px + tw - 6, py + rh + 6, px + (tw - 6) / 2, py + rh + 6);
        x.quadraticCurveTo(px, py + rh + 6, px, py + rh * 0.55);
        x.closePath();
        x.fill();
      }
    }
    grain(x, s, 6);
    return texture(c);
  }


  function grass() {
    const s = 512;
    const c = canvas(s);
    const x = c.getContext('2d');
    x.fillStyle = '#4a7a33';
    x.fillRect(0, 0, s, s);
    for (let i = 0; i < 9000; i++) {
      x.fillStyle = `hsl(${85 + Math.random() * 30}, ${35 + Math.random() * 25}%, ${22 + Math.random() * 22}%)`;
      x.fillRect(Math.random() * s, Math.random() * s, 1.5, 3 + Math.random() * 4);
    }
    grain(x, s, 18);
    return texture(c, 140, 140);
  }

  function arenaTile() {
    const s = 128;
    const c = canvas(s);
    const x = c.getContext('2d');
    x.fillStyle = '#8f8a7d';
    x.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i++) {
      x.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.06})`;
      x.fillRect(Math.random() * s, Math.random() * s, G.rand(8, 30), G.rand(8, 30));
    }
    x.strokeStyle = 'rgba(60,56,48,0.55)';
    x.lineWidth = 3;
    x.strokeRect(0, 0, s, s);
    x.strokeStyle = 'rgba(255,255,255,0.12)';
    x.lineWidth = 2;
    x.strokeRect(5, 5, s - 10, s - 10);
    grain(x, s, 22);
    return texture(c, 16, 16);
  }


  // The build pieces and the ground read these; runes and barrier come from core.js.
  G.classicTextures = function () {
    return {
      brick: brick(),
      flag: flagstone(),
      stairs: stairs(),
      slate: slate(),
      grass: grass(),
      tile: arenaTile(),
    };
  };

  function std(colour, extra) {
    return new THREE.MeshStandardMaterial(Object.assign({ color: colour, roughness: 0.85, metalness: 0.05 }, extra || {}));
  }

  function mesh(geo, mat, x, y, z, parent, shadow) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (shadow) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
    parent.add(m);
    return m;
  }

  function sky(scene, sunDir) {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        top: { value: new THREE.Color(0x1d2b6e) },
        mid: { value: new THREE.Color(0x6f92dc) },
        bottom: { value: new THREE.Color(0xf6c98e) },
        sun: { value: sunDir.clone() },
      },
      vertexShader:
        'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform vec3 sun; varying vec3 vP;',
        'void main(){',
        '  float h = vP.y;',
        '  vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h * 1.5, 0.0, 1.0), 0.8)) : mix(mid, bottom, clamp(-h * 3.0, 0.0, 1.0));',
        '  c = mix(c, bottom, pow(1.0 - abs(h), 10.0) * 0.75);',
        '  float s = max(dot(normalize(vP), sun), 0.0);',
        '  c += vec3(1.0, 0.82, 0.55) * (pow(s, 48.0) * 0.8 + pow(s, 6.0) * 0.12);',
        '  gl_FragColor = vec4(c, 1.0);',
        '}',
      ].join('\n'),
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), mat);
    dome.renderOrder = -10;
    scene.add(dome);
    const sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(20, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xfff1c9, fog: false })
    );
    sunMesh.position.copy(sunDir).multiplyScalar(700);
    scene.add(sunMesh);
  }

  function lights(scene, sunDir) {
    scene.add(new THREE.HemisphereLight(0xc4d8ff, 0x4d5b38, 0.75));
    const sun = new THREE.DirectionalLight(0xffe0b0, 1.35);
    sun.position.copy(sunDir).multiplyScalar(120);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = sun.shadow.camera;
    s.left = -50;
    s.right = 50;
    s.top = 50;
    s.bottom = -50;
    s.near = 10;
    s.far = 320;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    scene.add(sun);
    scene.add(sun.target);
  }

  function ground(scene) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), std(0xffffff, { map: G.tex.grass, roughness: 1 }));
    g.rotation.x = -Math.PI / 2;
    g.position.y = -0.06;
    g.receiveShadow = true;
    scene.add(g);
    const a = G.ARENA;
    const floorMat = std(0xffffff, { map: G.tex.tile, roughness: 0.95 });
    const tiles = new THREE.Mesh(new THREE.PlaneGeometry(a * 2, a * 2), floorMat);
    tiles.rotation.x = -Math.PI / 2;
    tiles.position.y = 0;
    tiles.receiveShadow = true;
    scene.add(tiles);
    // Low stone kerb around the duelling ground.
    const kerb = std(0x6e685c);
    const rim = new THREE.Group();
    for (const [w, d, x, z] of [
      [a * 2 + 2, 1, 0, a + 0.5],
      [a * 2 + 2, 1, 0, -a - 0.5],
      [1, a * 2, a + 0.5, 0],
      [1, a * 2, -a - 0.5, 0],
    ]) {
      mesh(G.roundedBox(w, 0.7, d, 0.3, 3), kerb, x, 0.35, z, rim, true);
    }
    scene.add(rim);
  }

  function barrier(scene) {
    const a = G.ARENA;
    const mat = new THREE.MeshBasicMaterial({
      map: G.tex.barrier,
      // Golden runes marking the arena's edge, blended normally (not added
      // as light) so they read as gold even against a bright sky.
      color: 0xffbf24,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const h = 60;
    const group = new THREE.Group();
    for (const [x, z, ry] of [
      [0, -a, 0],
      [0, a, Math.PI],
      [a, 0, -Math.PI / 2],
      [-a, 0, Math.PI / 2],
    ]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(a * 2, h), mat);
      p.position.set(x, h / 2, z);
      p.rotation.y = ry;
      group.add(p);
    }
    scene.add(group);
    return mat;
  }

  function pylons(scene) {
    const a = G.ARENA + 2.5;
    const stone = std(0x5c5750);
    const lightsOut = [];
    const crystals = [];
    const colours = [0x6fd8ff, 0xc26bff, 0x6fd8ff, 0xc26bff];
    [
      [a, a],
      [-a, a],
      [a, -a],
      [-a, -a],
    ].forEach(([x, z], n) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      mesh(new THREE.CylinderGeometry(1.6, 2, 1.2, 8), stone, 0, 0.6, 0, g, true);
      mesh(new THREE.CylinderGeometry(0.7, 1.1, 10, 4), stone, 0, 6, 0, g, true).rotation.y = Math.PI / 4;
      mesh(new THREE.CylinderGeometry(1.3, 0.9, 0.8, 8), std(0xb8913a, { metalness: 0.6, roughness: 0.4 }), 0, 11.3, 0, g, true);
      const cm = new THREE.MeshBasicMaterial({ color: colours[n] });
      const cr = mesh(new THREE.OctahedronGeometry(0.9, 0), cm, 0, 13.2, 0, g);
      cr.scale.y = 1.7;
      crystals.push(cr);
      const pl = new THREE.PointLight(colours[n], 1.2, 28, 2);
      pl.position.set(0, 13, 0);
      g.add(pl);
      lightsOut.push(pl);
      scene.add(g);
    });
    return { lights: lightsOut, crystals };
  }

  function forest(scene) {
    // Half the high-detail count, to keep Classic light.
    const count = 115;
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 4, 12);
    trunkGeo.translate(0, 2, 0);
    const lowGeo = new THREE.ConeGeometry(2.8, 5.5, 20);
    lowGeo.translate(0, 5.6, 0);
    const highGeo = new THREE.ConeGeometry(2, 4.2, 20);
    highGeo.translate(0, 8.4, 0);
    const trunks = new THREE.InstancedMesh(trunkGeo, std(0x5a3d24), count);
    const low = new THREE.InstancedMesh(lowGeo, std(0xffffff), count);
    const high = new THREE.InstancedMesh(highGeo, std(0xffffff), count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const p = new THREE.Vector3();
    const col = new THREE.Color();
    let n = 0;
    while (n < count) {
      const ang = Math.random() * Math.PI * 2;
      const r = G.rand(44, 170);
      const x = Math.cos(ang) * r;
      const z = Math.sin(ang) * r;
      if (Math.hypot(x - 150, z - 90) < 25) continue;
      const s = G.rand(0.8, 1.7);
      p.set(x, 0, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28);
      sc.set(s, s * G.rand(0.9, 1.25), s);
      m.compose(p, q, sc);
      trunks.setMatrixAt(n, m);
      low.setMatrixAt(n, m);
      high.setMatrixAt(n, m);
      col.setHSL(G.rand(0.28, 0.36), G.rand(0.35, 0.55), G.rand(0.16, 0.26));
      low.setColorAt(n, col);
      col.offsetHSL(0, 0, 0.04);
      high.setColorAt(n, col);
      n += 1;
    }
    for (const im of [trunks, low, high]) {
      im.castShadow = true;
      im.receiveShadow = true;
      scene.add(im);
    }
    const rockGeo = new THREE.IcosahedronGeometry(1, 2);
    const rocks = new THREE.InstancedMesh(rockGeo, std(0x7d786f), 70);
    for (let i = 0; i < 70; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = G.rand(38, 140);
      const s = G.rand(0.6, 2.6);
      p.set(Math.cos(ang) * r, s * 0.3, Math.sin(ang) * r);
      q.setFromEuler(new THREE.Euler(Math.random(), Math.random() * 6, Math.random()));
      sc.set(s, s * G.rand(0.5, 0.9), s * G.rand(0.8, 1.2));
      m.compose(p, q, sc);
      rocks.setMatrixAt(i, m);
    }
    rocks.castShadow = true;
    scene.add(rocks);
  }

  function mountains(scene) {
    const rock = std(0x5d6478, { roughness: 1 });
    const snow = std(0xeef3ff, { roughness: 0.9 });
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2 + G.rand(-0.1, 0.1);
      const r = G.rand(330, 430);
      const h = G.rand(90, 190);
      const rad = G.rand(60, 110);
      const g = new THREE.Group();
      g.position.set(Math.cos(ang) * r, 0, Math.sin(ang) * r);
      mesh(new THREE.ConeGeometry(rad, h, 24), rock, 0, h / 2, 0, g);
      mesh(new THREE.ConeGeometry(rad * 0.32, h * 0.32, 24), snow, 0, h * 0.84 + 0.5, 0, g);
      g.rotation.y = Math.random() * 3;
      scene.add(g);
    }
  }

  function wizardTower(scene) {
    const g = new THREE.Group();
    g.position.set(150, 0, 90);
    const stone = std(0x6b6f86);
    const trim = std(0xc9a14a, { metalness: 0.6, roughness: 0.4 });
    let y = 0;
    const tiers = [
      [9, 10, 18],
      [7.5, 9, 16],
      [6, 7.5, 14],
    ];
    for (const [rt, rb, h] of tiers) {
      mesh(new THREE.CylinderGeometry(rt, rb, h, 28), stone, 0, y + h / 2, 0, g);
      y += h;
      mesh(new THREE.TorusGeometry(rt + 0.2, 0.5, 12, 40), trim, 0, y, 0, g).rotation.x = Math.PI / 2;
    }
    mesh(new THREE.ConeGeometry(8, 22, 28), std(0x4b2a8a, { roughness: 0.6 }), 0, y + 11, 0, g);
    const orb = mesh(new THREE.SphereGeometry(2.6, 32, 20), new THREE.MeshBasicMaterial({ color: 0xc26bff }), 0, y + 27, 0, g);
    const stones = new THREE.Group();
    stones.position.y = y + 27;
    g.add(stones);
    for (let i = 0; i < 4; i++) {
      const s = mesh(G.roundedBox(1.4, 2.4, 0.6, 0.28, 3), new THREE.MeshBasicMaterial({ color: 0x8fe3ff }), 0, 0, 0, stones);
      const a = (i / 4) * Math.PI * 2;
      s.position.set(Math.cos(a) * 6, 0, Math.sin(a) * 6);
    }
    scene.add(g);
    return { orb, stones };
  }

  function islands(scene) {
    const list = [];
    const rock = std(0x6e6152);
    const turf = std(0x4f8a3a);
    const crystalMats = [new THREE.MeshBasicMaterial({ color: 0x7fe3ff }), new THREE.MeshBasicMaterial({ color: 0xd28bff })];
    const spots = [
      [-95, 58, -40, 13],
      [85, 70, -80, 10],
      [-60, 82, 95, 15],
      [110, 52, 30, 8],
      [-20, 95, -130, 12],
    ];
    for (const [x, y, z, r] of spots) {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      mesh(new THREE.ConeGeometry(r, r * 1.6, 24), rock, 0, -r * 0.8, 0, g).rotation.x = Math.PI;
      mesh(new THREE.CylinderGeometry(r, r * 0.95, 1.2, 24), turf, 0, 0.6, 0, g);
      for (let k = 0; k < 4; k++) {
        const c = mesh(
          new THREE.OctahedronGeometry(G.rand(0.8, 1.8), 0),
          crystalMats[k % 2],
          G.rand(-r * 0.5, r * 0.5),
          2,
          G.rand(-r * 0.5, r * 0.5),
          g
        );
        c.scale.y = 2.2;
      }
      mesh(new THREE.ConeGeometry(1.6, 5, 18), std(0x2d5a2a), r * 0.3, 3.5, -r * 0.2, g);
      scene.add(g);
      list.push({ g, baseY: y, phase: Math.random() * 6 });
    }
    return list;
  }

  function fireflies(scene) {
    const n = 220;
    const pos = new Float32Array(n * 3);
    const seeds = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = G.rand(34, 90);
      seeds.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, y: G.rand(0.5, 16), p: Math.random() * 6 });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xffc966,
        size: 0.16,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    pts.frustumCulled = false;
    scene.add(pts);
    return { geo, seeds };
  }

  function clouds(scene) {
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
    const group = new THREE.Group();
    const blob = new THREE.SphereGeometry(1, 10, 8);
    for (let i = 0; i < 14; i++) {
      const c = new THREE.Group();
      const a = Math.random() * Math.PI * 2;
      const r = G.rand(120, 380);
      c.position.set(Math.cos(a) * r, G.rand(110, 170), Math.sin(a) * r);
      for (let k = 0; k < 5; k++) {
        const s = mesh(blob, mat, G.rand(-14, 14), G.rand(-2, 3), G.rand(-6, 6), c);
        s.scale.set(G.rand(8, 15), G.rand(4, 7), G.rand(6, 10));
      }
      group.add(c);
    }
    scene.add(group);
    return group;
  }

  G.createClassicWorld = function () {
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xb7c8e6, 110, 520);
    const sunDir = new THREE.Vector3(0.45, 0.62, 0.62).normalize();
    sky(scene, sunDir);
    lights(scene, sunDir);
    ground(scene);
    const barrierMat = barrier(scene);
    const py = pylons(scene);
    forest(scene);
    mountains(scene);
    const tower = wizardTower(scene);
    const isl = islands(scene);
    const ff = fireflies(scene);
    const cl = clouds(scene);

    function update(dt, t) {
      G.tex.barrier.offset.y = (t * 0.04) % 1;
      barrierMat.opacity = 0.38 + Math.sin(t * 1.3) * 0.06;
      py.crystals.forEach((c, i) => {
        c.rotation.y = t * 0.8 + i;
        c.position.y = 13.2 + Math.sin(t * 1.5 + i) * 0.3;
      });
      py.lights.forEach((l, i) => {
        l.intensity = 1.1 + Math.sin(t * 7 + i * 2) * 0.12 + Math.sin(t * 13 + i) * 0.06;
      });
      tower.stones.rotation.y = t * 0.4;
      tower.orb.scale.setScalar(1 + Math.sin(t * 2) * 0.08);
      for (const it of isl) {
        it.g.position.y = it.baseY + Math.sin(t * 0.4 + it.phase) * 1.6;
        it.g.rotation.y = t * 0.02 + it.phase;
      }
      const arr = ff.geo.attributes.position.array;
      ff.seeds.forEach((s, i) => {
        arr[i * 3] = s.x + Math.sin(t * 0.3 + s.p) * 2;
        arr[i * 3 + 1] = s.y + Math.sin(t * 0.8 + s.p * 2) * 0.8;
        arr[i * 3 + 2] = s.z + Math.cos(t * 0.25 + s.p) * 2;
      });
      ff.geo.attributes.position.needsUpdate = true;
      cl.rotation.y = t * 0.004;
    }

    // Nothing here needs the renderer; kept so game.js treats both alike.
    return { scene, update, useRenderer() {} };
  };
})();

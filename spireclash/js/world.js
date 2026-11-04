/**
 * Spireclash world: a rune-warded duelling ground in a high-fantasy valley.
 * A castle stands to the north, a wizard's tower to the east and floating
 * islands drift overhead. The hills, woods and mountains live in land.js.
 */
(function () {
  'use strict';
  const G = window.G;

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
      // A gradient sky with a soft sun, a bank of billowing clouds along the
      // horizon (warmed on the sun's side) and faint high wisps above.
      fragmentShader: [
        'uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform vec3 sun; varying vec3 vP;',
        'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
        'float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);',
        '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }',
        'float fbm(vec2 p){ float s = 0.0; float a = 0.5; for (int k = 0; k < 5; k++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }',
        'void main(){',
        '  vec3 d = normalize(vP);',
        '  float h = d.y;',
        '  vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h * 1.5, 0.0, 1.0), 0.8)) : mix(mid, bottom, clamp(-h * 3.0, 0.0, 1.0));',
        '  c = mix(c, bottom, pow(1.0 - abs(h), 10.0) * 0.75);',
        '  float s = max(dot(d, sun), 0.0);',
        // Horizon cloud bank: noise sampled round a circle, so it never seams.
        '  vec2 ring = normalize(d.xz + vec2(1e-4));',
        '  float n = fbm(ring * (3.2 + h * 9.0) + vec2(h * 2.0, 0.0));',
        '  float bank = smoothstep(0.5, 0.62, n + 0.36 - h * 1.5) * smoothstep(-0.03, 0.01, h);',
        '  vec3 cloud = mix(vec3(0.74, 0.79, 0.9), vec3(1.0, 0.98, 0.95), clamp(h * 4.0 + 0.35, 0.0, 1.0));',
        '  cloud += vec3(1.0, 0.8, 0.55) * pow(s, 4.0) * 0.35;',
        '  c = mix(c, cloud, bank * 0.9);',
        // High wispy streaks, stretched across the sky.
        '  vec2 uv = d.xz / (h + 0.25);',
        '  float w = fbm(uv * vec2(1.2, 4.5) + 7.0);',
        '  c = mix(c, vec3(1.0), smoothstep(0.56, 0.8, w) * smoothstep(0.12, 0.35, h) * 0.45);',
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
    scene.add(new THREE.HemisphereLight(0xdde8ff, 0x5d6b3e, 0.85));
    const sun = new THREE.DirectionalLight(0xffe4b8, 1.3);
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
    G.land.terrain(scene);
    const a = G.ARENA;
    const floorMat = std(0xffffff, { map: G.tex.tile, roughness: 0.95 });
    const tiles = new THREE.Mesh(new THREE.PlaneGeometry(a * 2, a * 2), floorMat);
    tiles.rotation.x = -Math.PI / 2;
    tiles.position.y = 0;
    tiles.receiveShadow = true;
    scene.add(tiles);
    // Low stone kerb around the duelling ground.
    const kerb = std(0xd8d0c0, { map: G.tex.castle });
    const rim = new THREE.Group();
    for (const [w, d, x, z] of [
      [a * 2 + 2, 1, 0, a + 0.5],
      [a * 2 + 2, 1, 0, -a - 0.5],
      [1, a * 2, a + 0.5, 0],
      [1, a * 2, -a - 0.5, 0],
    ]) {
      const geo = G.land.tiled(G.roundedBox(w, 0.7, d, 0.3, 3).clone(), Math.max(w, d) / 3, 0.25);
      mesh(geo, kerb, x, 0.35, z, rim, true);
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

  // Gem materials, filled in with a reflection map once the renderer exists.
  const glassMats = [];

  // A cut gem: a pointed eight-sided pavilion below, a bevelled crown and a
  // flat table on top. Flat-shaded, so every facet catches its own glint.
  function gemGeometry() {
    const pts = [
      [0, -1.15],
      [0.82, 0.12],
      [0.6, 0.5],
      [0.001, 0.58],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    return new THREE.LatheGeometry(pts, 8);
  }

  // Clear glass with a Fresnel falloff: nearly invisible face-on, turning
  // bright, reflective and faintly aqua at grazing angles, as real glass does.
  function glassCoat(side) {
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xeafcff,
      metalness: 0,
      roughness: 0,
      transparent: true,
      side,
      clearcoat: 1,
      clearcoatRoughness: 0,
      specularIntensity: 1,
      envMapIntensity: 4,
      depthWrite: false,
    });
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <output_fragment>',
        [
          'float facing = abs( dot( normalize( normal ), normalize( vViewPosition ) ) );',
          'float fresnel = pow( 1.0 - facing, 2.5 );',
          'outgoingLight = mix( outgoingLight, outgoingLight * vec3( 0.75, 1.0, 1.0 ), fresnel * 0.5 );',
          'diffuseColor.a = mix( 0.04, 0.85, fresnel ) * ( gl_FrontFacing ? 1.0 : 0.6 );',
          '#include <output_fragment>',
        ].join('\n')
      );
    };
    glassMats.push(mat);
    return mat;
  }

  // A glass gem: a clear tinted shell reflecting the sky with a rainbow
  // sheen, crisp bright facet edges, and a small glowing heart.
  function glassCrystal(colour) {
    const gem = new THREE.Group();
    gem.scale.setScalar(1.25);
    const geo = gemGeometry();
    const shell = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(colour).lerp(new THREE.Color(0xffffff), 0.08),
      metalness: 0,
      roughness: 0.03,
      transparent: true,
      opacity: 0.62,
      flatShading: true,
      side: THREE.DoubleSide,
      clearcoat: 1,
      clearcoatRoughness: 0,
      iridescence: 0.8,
      iridescenceIOR: 1.45,
      specularIntensity: 1,
      envMapIntensity: 3,
      depthWrite: false,
    });
    glassMats.push(shell);
    const outer = new THREE.Mesh(geo, shell);
    outer.renderOrder = 2;
    gem.add(outer);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo, 10),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false })
    );
    edges.renderOrder = 3;
    gem.add(edges);
    // A casing of real-looking glass over the gem: the same cut, slightly
    // larger. Its far side is drawn first, then its near side, so the inner
    // surface shows through the outer one.
    for (const side of [THREE.BackSide, THREE.FrontSide]) {
      const casing = new THREE.Mesh(geo, glassCoat(side));
      casing.scale.setScalar(1.14);
      casing.renderOrder = side === THREE.BackSide ? 3 : 4;
      gem.add(casing);
    }
    // The heart: a small inner glow, deeper in colour than the shell.
    const heart = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), new THREE.MeshBasicMaterial({ color: colour }));
    heart.position.y = -0.1;
    gem.add(heart);
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 16, 12),
      new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    halo.position.y = -0.1;
    gem.add(halo);
    return gem;
  }

  // A small sky-and-meadow panorama, prefiltered for glossy reflections.
  function reflectionMap(renderer) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, '#2a3f8f');
    g.addColorStop(0.42, '#9fc0f0');
    g.addColorStop(0.5, '#fbe2b8');
    g.addColorStop(0.53, '#7aa04a');
    g.addColorStop(1, '#2f4a22');
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 128);
    // A bright sun and a few clouds to glint in the facets.
    x.fillStyle = '#fffbe8';
    x.beginPath();
    x.arc(60, 30, 7, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 9; i++) {
      x.beginPath();
      x.ellipse(Math.random() * 256, G.rand(18, 50), G.rand(8, 18), G.rand(3, 6), 0, 0, Math.PI * 2);
      x.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.encoding = THREE.sRGBEncoding;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
    tex.dispose();
    return env;
  }

  function pylons(scene) {
    const a = G.ARENA + 2.5;
    const stone = std(0xc9c1b2, { map: G.tex.castle });
    const gold = std(0xc89a3c, { metalness: 0.6, roughness: 0.4, map: G.tex.metal });
    const lightsOut = [];
    const crystals = [];
    const colours = [0x6fd8ff, 0xc26bff, 0x6fd8ff, 0xc26bff];
    const tiled = G.land.tiled;
    [
      [a, a],
      [-a, a],
      [a, -a],
      [-a, -a],
    ].forEach(([x, z], n) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      mesh(tiled(new THREE.CylinderGeometry(1.6, 2, 1.2, 20), 3, 0.4), stone, 0, 0.6, 0, g, true);
      mesh(tiled(new THREE.CylinderGeometry(0.75, 1.05, 10, 16), 1.5, 3), stone, 0, 6, 0, g, true);
      mesh(new THREE.CylinderGeometry(1.3, 0.9, 0.8, 20), gold, 0, 11.3, 0, g, true);
      const cr = glassCrystal(colours[n]);
      cr.position.set(0, 13.6, 0);
      g.add(cr);
      crystals.push(cr);
      const pl = new THREE.PointLight(colours[n], 1.2, 28, 2);
      pl.position.set(0, 13, 0);
      g.add(pl);
      lightsOut.push(pl);
      scene.add(g);
    });
    return { lights: lightsOut, crystals };
  }

  // Repeat counts so a 6-unit stone course reads the same on every surface.
  const ashlar = (geo, across, tall) => G.land.tiled(geo, across / 6, tall / 6);

  function wizardTower(scene) {
    const g = new THREE.Group();
    g.position.set(150, G.land.height(150, 90) + 0.06, 90);
    const stone = std(0x9a9cb8, { map: G.tex.castle });
    const trim = std(0xc9a14a, { metalness: 0.6, roughness: 0.4, map: G.tex.metal });
    let y = 0;
    const tiers = [
      [9, 10, 18],
      [7.5, 9, 16],
      [6, 7.5, 14],
    ];
    for (const [rt, rb, h] of tiers) {
      mesh(ashlar(new THREE.CylinderGeometry(rt, rb, h, 28), rb * 6, h), stone, 0, y + h / 2, 0, g);
      y += h;
      mesh(new THREE.TorusGeometry(rt + 0.2, 0.5, 12, 40), trim, 0, y, 0, g).rotation.x = Math.PI / 2;
    }
    mesh(G.land.tiled(new THREE.ConeGeometry(8, 22, 28), 8, 4), std(0xb48cf0, { map: G.tex.slate, roughness: 0.6 }), 0, y + 11, 0, g);
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
    const rock = std(0xc8b8a4, { map: G.tex.rock });
    const turf = std(0x8fc060, { map: G.tex.ground });
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
      mesh(new THREE.ConeGeometry(1.6, 5, 18), std(0xffffff, { map: G.tex.needles }), r * 0.3, 3.5, -r * 0.2, g);
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

  G.createWorld = function () {
    const scene = new THREE.Scene();
    // Thick, soft distance haze, as in the painted adventure games of old.
    scene.fog = new THREE.Fog(0xc9d5e6, 110, 680);
    const sunDir = new THREE.Vector3(0.45, 0.62, 0.62).normalize();
    sky(scene, sunDir);
    lights(scene, sunDir);
    ground(scene);
    const barrierMat = barrier(scene);
    const py = pylons(scene);
    G.land.forest(scene);
    G.land.boulders(scene);
    G.buildCastle(scene, 0, -215);
    const tower = wizardTower(scene);
    const isl = islands(scene);
    const ff = fireflies(scene);
    const cl = G.buildClouds(scene, sunDir);

    function update(dt, t) {
      G.tex.barrier.offset.y = (t * 0.04) % 1;
      barrierMat.opacity = 0.38 + Math.sin(t * 1.3) * 0.06;
      py.crystals.forEach((c, i) => {
        c.rotation.y = t * 0.8 + i;
        c.position.y = 13.6 + Math.sin(t * 1.5 + i) * 0.3;
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

    // Give the glass gems their reflections (needs the renderer).
    function useRenderer(renderer) {
      const env = reflectionMap(renderer);
      // Knights get a neutral reflection of their own, so steel stays grey.
      G.armourEnv = G.makeArmourEnv(renderer);
      for (const m of glassMats) {
        m.envMap = env;
        m.needsUpdate = true;
      }
    }

    return { scene, update, useRenderer };
  };
})();

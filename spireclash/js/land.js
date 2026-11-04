/**
 * Spireclash landscape: rolling hills around the duelling ground, a dirt
 * road to the castle, painted pines and round-crowned oaks, boulders and a
 * ring of craggy snow-capped mountains rising out of grassy foothills. It is
 * all one heightfield, so trees and rocks rest on the slopes and the
 * mountains blend into the meadow with no seam.
 */
(function () {
  'use strict';
  const G = window.G;

  const smooth = (a, b, v) => {
    const t = G.clamp((v - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  // Repeatable pseudo-random value for a point, so shared vertices move alike.
  function hash(x, y, z) {
    const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
    return s - Math.floor(s);
  }

  // Smooth value noise on a unit grid, from 0 to 1.
  function vnoise(x, z) {
    const xi = Math.floor(x);
    const zi = Math.floor(z);
    const xf = x - xi;
    const zf = z - zi;
    const u = xf * xf * (3 - 2 * xf);
    const v = zf * zf * (3 - 2 * zf);
    const a = hash(xi, zi, 7.1);
    const b = hash(xi + 1, zi, 7.1);
    const c = hash(xi, zi + 1, 7.1);
    const d = hash(xi + 1, zi + 1, 7.1);
    return G.lerp(G.lerp(a, b, u), G.lerp(c, d, u), v);
  }

  // Ridged noise: sharp crests and gullies, layered from coarse to fine.
  function ridged(x, z) {
    let sum = 0;
    let amp = 1;
    let freq = 1;
    let total = 0;
    for (let o = 0; o < 5; o++) {
      const n = 1 - Math.abs(vnoise(x * freq + o * 17.3, z * freq - o * 9.1) * 2 - 1);
      sum += n * n * amp;
      total += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum / total;
  }

  // The mountain ring: tall peaks behind a row of lower foothill peaks.
  const PEAKS = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + G.rand(-0.1, 0.1);
    const r = G.rand(370, 450);
    PEAKS.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, h: G.rand(130, 220), rad: G.rand(85, 130) });
  }
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + G.rand(-0.08, 0.08);
    const r = G.rand(290, 340);
    PEAKS.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, h: G.rand(35, 75), rad: G.rand(40, 65) });
  }

  // Height of the mountains alone at (x, z).
  function mountainHeight(x, z) {
    let best = 0;
    for (const p of PEAKS) {
      const dx = x - p.x;
      const dz = z - p.z;
      if (Math.abs(dx) > p.rad || Math.abs(dz) > p.rad) continue;
      const t = Math.hypot(dx, dz) / p.rad;
      if (t >= 1) continue;
      // Concave flanks rising to a sharp summit.
      const f = (1 - t) ** 1.7;
      if (f * p.h > best) best = f * p.h;
    }
    if (best <= 0) return 0;
    // Crags and gullies cut deeper the higher up the slope.
    const detail = ridged(x / 38, z / 38);
    return best * (0.62 + 0.55 * detail) + vnoise(x / 9, z / 9) * 3 * Math.min(1, best / 20);
  }

  // Ground height. Flat around the arena, the castle and the tower; hills in
  // between, rolling up into foothills and the mountains beyond.
  function height(x, z) {
    const r = Math.hypot(x, z);
    let h =
      7 +
      Math.sin(x * 0.021 + 1.3) * Math.cos(z * 0.017 - 0.4) * 8 +
      Math.sin(x * 0.047 - z * 0.033) * 3.5 +
      Math.sin(z * 0.061 + x * 0.013 + 2) * 1.6;
    h *= smooth(46, 100, r);
    h += smooth(230, 340, r) * 22;
    h *= smooth(52, 85, Math.hypot(x, z + 215));
    h *= smooth(20, 38, Math.hypot(x - 150, z - 90));
    if (r > 230) h += mountainHeight(x, z);
    return h - 0.06;
  }

  // How much of the castle road covers (x, z), from 0 to 1.
  function road(x, z) {
    if (z > -34 || z < -190) return 0;
    const centre = Math.sin(z * 0.045) * 5;
    return 1 - smooth(2.2, 4, Math.abs(x - centre));
  }

  // Multiply a geometry's UVs so a texture repeats across it.
  function tiled(geo, su, sv) {
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    return geo;
  }

  function std(colour, extra) {
    return new THREE.MeshStandardMaterial(Object.assign({ color: colour, roughness: 0.95, metalness: 0 }, extra || {}));
  }

  // Ground material that paints grass and rock with two textures, mixed per
  // vertex by the 'blend' attribute (0 grass, 1 bare rock), with snow laid
  // over the top by the 'snow' attribute.
  function groundMaterial() {
    const mat = std(0xffffff, { map: G.tex.ground, vertexColors: true, roughness: 1 });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.rockMap = { value: G.tex.rock };
      shader.uniforms.rockScale = { value: 0.025 };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float blend;\nattribute float snow;\nvarying float vBlend;\nvarying float vSnow;\nvarying vec3 vWPos;\nvarying vec3 vWNor;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvBlend = blend;\nvSnow = snow;\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNor = normalize(mat3(modelMatrix) * objectNormal);'
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nuniform sampler2D rockMap;\nuniform float rockScale;\nvarying float vBlend;\nvarying float vSnow;\nvarying vec3 vWPos;\nvarying vec3 vWNor;'
        )
        .replace(
          '#include <map_fragment>',
          [
            '#ifdef USE_MAP',
            '  vec4 grassTex = texture2D( map, vUv );',
            // Rock is projected from all three axes and blended by the slope,
            // so cliffs show horizontal strata instead of smeared streaks.
            '  vec3 bw = pow( abs( normalize( vWNor ) ), vec3( 4.0 ) );',
            '  bw /= bw.x + bw.y + bw.z;',
            '  vec4 rockTex = texture2D( rockMap, vWPos.zy * rockScale ) * bw.x',
            '    + texture2D( rockMap, vWPos.xz * rockScale ) * bw.y',
            '    + texture2D( rockMap, vWPos.xy * rockScale ) * bw.z;',
            '  vec4 groundTex = mix( grassTex, rockTex, vBlend );',
            // Snow: soft white with a ghost of the rock beneath.
            '  vec4 snowTex = mix( vec4( 1.0 ), rockTex * 1.7, 0.18 );',
            '  diffuseColor *= mix( groundTex, snowTex, vSnow );',
            '#endif',
          ].join('\n')
        );
    };
    return mat;
  }

  function terrain(scene) {
    const size = 1600;
    const geo = new THREE.PlaneGeometry(size, size, 260, 260);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();
    const nor = geo.attributes.normal;
    const colours = new Float32Array(pos.count * 3);
    const blend = new Float32Array(pos.count);
    const snowAmount = new Float32Array(pos.count);
    const grassA = new THREE.Color(0.36, 0.62, 0.2);
    const grassB = new THREE.Color(0.55, 0.74, 0.26);
    const alpine = new THREE.Color(0.42, 0.56, 0.24);
    const dirt = new THREE.Color(0.85, 0.66, 0.44);
    const rockA = new THREE.Color(0.66, 0.62, 0.58);
    const rockB = new THREE.Color(0.86, 0.82, 0.76);
    const snow = new THREE.Color(0.95, 0.97, 1.03);
    const c = new THREE.Color();
    const rc = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = pos.getY(i);
      const slope = 1 - nor.getY(i);
      const n = vnoise(x * 0.03, z * 0.03);
      // Grass, turning a cooler alpine green up the foothills.
      c.copy(grassA).lerp(grassB, G.clamp(n + h * 0.01, 0, 1));
      c.lerp(alpine, smooth(25, 70, h));
      c.lerp(dirt, road(x, z));
      // Bare rock on steep faces and high ground; grass holds on to ledges
      // and spills up the gullies, so the mountains grow out of the meadow.
      const rocky = Math.max(smooth(0.2, 0.42, slope + (n - 0.5) * 0.2), smooth(85, 130, h + (n - 0.5) * 50));
      rc.copy(rockA).lerp(rockB, vnoise(x * 0.08, z * 0.08));
      c.lerp(rc, rocky);
      // Snow settles on the summits, thinning only on the sheerest faces.
      const snowy = smooth(115, 140, h + (n - 0.5) * 45) * (1 - 0.6 * smooth(0.65, 0.9, slope));
      c.lerp(snow, snowy);
      colours[i * 3] = c.r;
      colours[i * 3 + 1] = c.g;
      colours[i * 3 + 2] = c.b;
      blend[i] = rocky;
      snowAmount[i] = snowy;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    geo.setAttribute('blend', new THREE.BufferAttribute(blend, 1));
    geo.setAttribute('snow', new THREE.BufferAttribute(snowAmount, 1));
    tiled(geo, size / 5, size / 5);
    const mesh = new THREE.Mesh(geo, groundMaterial());
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  function instanced(geo, mat, count) {
    const im = new THREE.InstancedMesh(geo, mat, count);
    im.castShadow = true;
    im.receiveShadow = true;
    return im;
  }

  // True where a tree or boulder would block the road, the castle or tower.
  function blocked(x, z) {
    return road(x, z) > 0 || Math.hypot(x, z + 215) < 60 || Math.hypot(x - 150, z - 90) < 26;
  }

  function forest(scene) {
    const pines = 220;
    // Pines past this count climb into the foothills, below the treeline.
    const valleyPines = 140;
    const oaks = 100;
    const kinds = G.trees();
    const make = (parts, count) =>
      parts.map((part) => {
        const im = instanced(part.geo, part.mat, count);
        if (part.depth) im.customDepthMaterial = part.depth;
        return { im, tint: part.tint };
      });
    const pineMeshes = make(kinds.pine, pines);
    const oakMeshes = make(kinds.oak, oaks);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    const place = (meshes, n) => {
      for (const { im, tint } of meshes) {
        im.setMatrixAt(n, m);
        if (tint) im.setColorAt(n, col);
      }
    };
    let nPine = 0;
    let nOak = 0;
    while (nPine < pines || nOak < oaks) {
      const ang = Math.random() * Math.PI * 2;
      const foothill = nPine >= valleyPines && nOak >= oaks;
      const r = foothill ? G.rand(200, 340) : G.rand(46, 190);
      const x = Math.cos(ang) * r;
      const z = Math.sin(ang) * r;
      if (blocked(x, z) || (foothill && height(x, z) > 55)) continue;
      const oak = !foothill && nOak < oaks && (nPine >= valleyPines || Math.random() < 0.45);
      const s = oak ? G.rand(0.8, 1.3) : G.rand(0.8, 1.5);
      p.set(x, height(x, z) - 0.2, z);
      q.setFromAxisAngle(up, Math.random() * 6.28);
      sc.set(s, s * G.rand(0.9, 1.15), s);
      m.compose(p, q, sc);
      // A slightly different green for every tree.
      col.setRGB(G.rand(0.82, 1.08), G.rand(0.88, 1.1), G.rand(0.75, 1));
      if (oak) {
        place(oakMeshes, nOak);
        nOak += 1;
      } else {
        place(pineMeshes, nPine);
        nPine += 1;
      }
    }
    for (const { im } of [...pineMeshes, ...oakMeshes]) scene.add(im);
  }

  function boulders(scene) {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const p = geo.attributes.position;
    const nor = geo.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const k = 1 + (hash(x, y, z) - 0.5) * 0.35;
      nor.setXYZ(i, x, y, z);
      p.setXYZ(i, x * k, y * k, z * k);
    }
    tiled(geo, 2, 2);
    const count = 80;
    const rocks = instanced(geo, std(0xffffff, { map: G.tex.rock }), count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const pos = new THREE.Vector3();
    let n = 0;
    while (n < count) {
      const ang = Math.random() * Math.PI * 2;
      const r = G.rand(40, 170);
      const x = Math.cos(ang) * r;
      const z = Math.sin(ang) * r;
      if (blocked(x, z)) continue;
      const s = G.rand(0.6, 2.8);
      pos.set(x, height(x, z) + s * 0.2, z);
      q.setFromEuler(new THREE.Euler(Math.random(), Math.random() * 6, Math.random()));
      sc.set(s, s * G.rand(0.5, 0.85), s * G.rand(0.8, 1.2));
      m.compose(pos, q, sc);
      rocks.setMatrixAt(n, m);
      n += 1;
    }
    scene.add(rocks);
  }

  G.land = { height, tiled, terrain, forest, boulders };
})();

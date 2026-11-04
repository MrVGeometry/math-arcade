/**
 * Spireclash clouds: cumulus drifting over the arena. Each cloud is one
 * smooth skin wrapped round a blended volume of puffs (a flat base with
 * billows piled highest in the middle), so the puffs melt into each other
 * with no seams. A cloud shader lights it softly, from bright crowns to
 * cool blue-grey shadows, breaks the light up with billowy noise, adds a
 * silver lining towards the sun, and fades the edges to wisps.
 */
(function () {
  'use strict';
  const G = window.G;

  // The blended volume: a sum of soft ellipsoidal puffs. Inside where the
  // sum passes THRESHOLD.
  const THRESHOLD = 0.5;

  function field(puffs, x, y, z) {
    let f = 0;
    for (const p of puffs) {
      const dx = (x - p[0]) / p[3];
      const dy = (y - p[1]) / p[4];
      const dz = (z - p[2]) / p[5];
      // Steep enough that each puff keeps its own rounded billow, soft
      // enough that neighbours melt together where they meet.
      f += Math.exp(-3 * (dx * dx + dy * dy + dz * dz));
    }
    return f;
  }

  // Height of the volume's top surface above (x, z), found by stepping down
  // from above until inside.
  function surface(puffs, x, z) {
    for (let y = 45; y > 0; y -= 0.4) {
      if (field(puffs, x, y, z) > THRESHOLD) return y;
    }
    return 2;
  }

  // A cloud's puffs, in cloud space with the flat base at y = 0.
  function layout(width) {
    const puffs = [];
    // Puff radii are scaled up to suit the steep blend in field().
    const grow = 1.32;
    const base = 8 + Math.floor(Math.random() * 4);
    for (let k = 0; k < base; k += 1) {
      const t = k / (base - 1) - 0.5;
      const s = G.rand(8, 12) * (1 - Math.abs(t) * 0.5);
      puffs.push([t * width, G.rand(1.5, 3), G.rand(-4, 4), s * grow, s * 0.55 * grow, s * 0.85 * grow]);
    }
    // Billows on top, larger towards the middle, each seated on the base
    // layer's actual surface so nothing floats free (or stacks into towers).
    const basePuffs = puffs.slice();
    const tops = 10 + Math.floor(Math.random() * 7);
    for (let k = 0; k < tops; k += 1) {
      const x = G.rand(-0.4, 0.4) * width;
      const z = G.rand(-4, 4);
      const mid = 1 - Math.abs(x) / (width * 0.5);
      const s = G.rand(5, 8.5) * (0.6 + mid * 0.7) * grow;
      puffs.push([x, surface(basePuffs, x, z) + s * G.rand(0.05, 0.3), z, s, s * 0.95, s * 0.9]);
    }
    // Small cauliflower knobs studding the crown.
    const crown = puffs.slice();
    for (let k = 0; k < 10; k += 1) {
      const x = G.rand(-0.35, 0.35) * width;
      const z = G.rand(-5, 5);
      const s = G.rand(2.5, 4.5) * grow;
      puffs.push([x, surface(crown, x, z) - s * 0.15, z, s, s, s]);
    }
    return puffs;
  }

  /**
   * Wrap a sphere's worth of vertices onto the volume's outer surface: march
   * in from outside along each direction until it enters the volume, then
   * refine. The base is pressed flat.
   */
  function skin(puffs, width) {
    const geo = new THREE.SphereGeometry(1, 72, 44);
    const pos = geo.attributes.position;
    // Rays start outside the whole cloud: centre and reach from its extent.
    const lo3 = [Infinity, Infinity, Infinity];
    const hi3 = [-Infinity, -Infinity, -Infinity];
    for (const p of puffs) {
      for (let a = 0; a < 3; a += 1) {
        lo3[a] = Math.min(lo3[a], p[a] - p[a + 3]);
        hi3[a] = Math.max(hi3[a], p[a] + p[a + 3]);
      }
    }
    const centre = new THREE.Vector3((lo3[0] + hi3[0]) / 2, Math.max(4, hi3[1] * 0.35), (lo3[2] + hi3[2]) / 2);
    const reach = new THREE.Vector3((hi3[0] - lo3[0]) * 0.62, (hi3[1] - centre.y) * 1.15, (hi3[2] - lo3[2]) * 0.62);
    reach.y = Math.max(reach.y, centre.y * 1.2);
    const dir = new THREE.Vector3();
    const at = (t) => [centre.x + dir.x * t, centre.y + dir.y * t, centre.z + dir.z * t];
    for (let i = 0; i < pos.count; i += 1) {
      dir.set(pos.getX(i) * reach.x, pos.getY(i) * reach.y, pos.getZ(i) * reach.z);
      let hi = 1;
      let lo = 1;
      let found = false;
      for (let t = 1; t > 0; t -= 0.025) {
        const [x, y, z] = at(t);
        if (field(puffs, x, y, z) > THRESHOLD) {
          lo = t;
          hi = t + 0.025;
          found = true;
          break;
        }
      }
      if (!found) lo = hi = 0.05;
      for (let k = 0; k < 6; k += 1) {
        const m = (lo + hi) / 2;
        const [x, y, z] = at(m);
        if (field(puffs, x, y, z) > THRESHOLD) lo = m;
        else hi = m;
      }
      const [x, y, z] = at((lo + hi) / 2);
      pos.setXYZ(i, x, Math.max(0, y), z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function cloudMaterial(sunDir, fog) {
    return new THREE.ShaderMaterial({
      uniforms: {
        sunDir: { value: sunDir.clone() },
        fogColor: { value: fog.color.clone() },
        fogNear: { value: fog.near },
        fogFar: { value: fog.far },
      },
      vertexShader: [
        'varying vec3 vWorld; varying vec3 vN; varying float vHeight;',
        'void main(){',
        '  vec4 w = modelMatrix * vec4(position, 1.0);',
        '  vWorld = w.xyz;',
        '  vN = normalize(mat3(modelMatrix) * normal);',
        '  vHeight = position.y;',
        '  gl_Position = projectionMatrix * viewMatrix * w;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 sunDir; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;',
        'varying vec3 vWorld; varying vec3 vN; varying float vHeight;',
        'float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }',
        'float noise(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);',
        '  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),',
        '             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z); }',
        'float fbm(vec3 p){ float s = 0.0; float a = 0.5; for (int k = 0; k < 4; k++) { s += a * noise(p); p *= 2.07; a *= 0.5; } return s; }',
        'void main(){',
        '  vec3 n = normalize(vN);',
        '  vec3 v = normalize(cameraPosition - vWorld);',
        // Billowy detail breaking up the light, large and small.
        '  float big = fbm(vWorld * 0.09);',
        '  float small = fbm(vWorld * 0.32 + 5.0);',
        '  float light = dot(n, sunDir) * 0.5 + 0.5;',
        '  light = clamp(light + (big - 0.5) * 0.55 + (small - 0.5) * 0.25, 0.0, 1.0);',
        '  vec3 shade = vec3(0.6, 0.66, 0.79);',
        '  vec3 lit = vec3(1.0, 0.985, 0.95);',
        '  vec3 c = mix(shade, lit, smoothstep(0.12, 0.95, light));',
        // A little darker towards the flat base, as real cumulus are.
        '  c *= mix(0.84, 1.03, clamp(vHeight / 14.0, 0.0, 1.0));',
        // Silver lining when looking towards the sun.
        '  float edge = 1.0 - max(dot(n, v), 0.0);',
        '  c += vec3(1.0, 0.9, 0.72) * pow(edge, 3.0) * pow(max(dot(-v, sunDir), 0.0), 2.0) * 0.7;',
        // Edges thin out into wisps instead of a hard outline.
        '  float a = smoothstep(0.02, 0.42, dot(n, v) + (small - 0.5) * 0.35);',
        '  float fogK = clamp((length(vWorld - cameraPosition) - fogNear) / (fogFar - fogNear), 0.0, 1.0);',
        '  c = mix(c, fogColor, fogK);',
        '  gl_FragColor = vec4(c, a);',
        '}',
      ].join('\n'),
      transparent: true,
      // The nearest surface hides anything behind it, so no inner layers
      // show through the soft edges.
      depthWrite: true,
    });
  }

  /** Scatter cumulus round the sky; returns the group (for slow drift). */
  G.buildClouds = function (scene, sunDir) {
    const mat = cloudMaterial(sunDir, scene.fog);
    const group = new THREE.Group();
    for (let i = 0; i < 14; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = G.rand(120, 380);
      const width = G.rand(30, 55);
      const cloud = new THREE.Mesh(skin(layout(width), width), mat);
      cloud.position.set(Math.cos(a) * r, G.rand(110, 170), Math.sin(a) * r);
      cloud.rotation.y = Math.random() * Math.PI * 2;
      group.add(cloud);
    }
    scene.add(group);
    return group;
  };
})();

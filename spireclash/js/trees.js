/**
 * Spireclash trees, built like real-time foliage: canopies of leaf-cluster
 * cards cut out with alpha (so the outline is made of real leaves) around a
 * dense inner core, branches reaching into the crown, drooping needle
 * sprays on the pines, furrowed bark, and foliage shaded darker inside and
 * underneath. Each tree is a few merged geometries, drawn instanced.
 */
(function () {
  'use strict';
  const G = window.G;

  /* Textures --------------------------------------------------------------- */

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h || w;
    return c;
  }

  function colourTex(c, wrap) {
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 8;
    if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  // One leaf: a pointed oval with a paler midrib, lit on one side.
  function leaf(x, cx, cy, len, ang, hue, light) {
    const { hsl } = G.paintKit;
    x.save();
    x.translate(cx, cy);
    x.rotate(ang);
    const w = len * 0.42;
    const g = x.createLinearGradient(0, -w, 0, w);
    g.addColorStop(0, hsl(hue, 45, light + 10));
    g.addColorStop(1, hsl(hue + 8, 50, light - 8));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(0, 0);
    x.quadraticCurveTo(len * 0.45, -w, len, 0);
    x.quadraticCurveTo(len * 0.45, w, 0, 0);
    x.fill();
    x.strokeStyle = hsl(hue - 10, 35, light + 18, 0.6);
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(1, 0);
    x.lineTo(len * 0.92, 0);
    x.stroke();
    x.restore();
  }

  // A spray of broad leaves on twigs, densest in the middle, on transparency.
  function leafCluster() {
    const s = 256;
    const c = canvas(s);
    const x = c.getContext('2d');
    const cx = s / 2;
    // Twigs radiating from the middle.
    x.strokeStyle = '#4a3220';
    x.lineCap = 'round';
    const tips = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + G.rand(-0.2, 0.2);
      const r = G.rand(70, 112);
      const tx = cx + Math.cos(a) * r;
      const ty = cx + Math.sin(a) * r;
      x.lineWidth = 3;
      x.beginPath();
      x.moveTo(cx, cx);
      x.quadraticCurveTo(cx + Math.cos(a + 0.3) * r * 0.5, cx + Math.sin(a + 0.3) * r * 0.5, tx, ty);
      x.stroke();
      tips.push([a, r]);
    }
    // Back leaves dark, front leaves lighter, so the cluster has depth.
    for (const [n, light] of [[70, 20], [80, 30], [60, 42]]) {
      for (let i = 0; i < n; i++) {
        const [a, r] = tips[Math.floor(Math.random() * tips.length)];
        const t = Math.sqrt(Math.random());
        const px = cx + Math.cos(a) * r * t + G.rand(-14, 14);
        const py = cx + Math.sin(a) * r * t + G.rand(-14, 14);
        if (Math.hypot(px - cx, py - cx) > 118) continue;
        leaf(x, px, py, G.rand(18, 30), a + G.rand(-1, 1), G.rand(88, 118), light + G.rand(-5, 5));
      }
    }
    return colourTex(c, false);
  }

  // A pine bough: a twig running from the trunk end (left) to the tip
  // (right), thick with needles angled forwards, thinning towards the tip.
  function needleSpray() {
    const { hsl } = G.paintKit;
    const w = 256;
    const h = 128;
    const c = canvas(w, h);
    const x = c.getContext('2d');
    const mid = h / 2;
    x.lineCap = 'round';
    // Side shoots so the bough is broad, not a single line.
    const shoots = [[0, 0]];
    for (let i = 0; i < 14; i++) {
      const sx = G.rand(10, 190);
      shoots.push([sx, (i % 2 ? -1 : 1) * G.rand(16, 42)]);
    }
    for (const pass of [0, 1]) {
      for (const [sx, off] of shoots) {
        const len = off === 0 ? w - 8 : G.rand(50, 90);
        for (let k = 0; k < len; k += 2.2) {
          const t = k / len;
          const bx = sx + k;
          const by = mid + off * t;
          const reach = (off === 0 ? 32 : 22) * (1 - (bx / w) * 0.5);
          for (const side of [-1, 1]) {
            const l = pass === 0 ? G.rand(14, 24) : G.rand(30, 46);
            x.strokeStyle = hsl(G.rand(135, 160), G.rand(30, 45), l, 0.9);
            x.lineWidth = pass === 0 ? 2 : 1.3;
            x.beginPath();
            x.moveTo(bx, by);
            x.lineTo(bx + reach * 0.55, by + side * reach * G.rand(0.75, 1));
            x.stroke();
          }
        }
      }
    }
    x.strokeStyle = '#4b3424';
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(0, mid);
    x.lineTo(w - 10, mid);
    x.stroke();
    return colourTex(c, false);
  }

  // Furrowed bark: ridged plates split by dark fissures, with lichen.
  function bark() {
    const { hsl, dabs, fbm } = G.paintKit;
    const s = 128;
    const c = canvas(s);
    const x = c.getContext('2d');
    const img = x.createImageData(s, s);
    for (let py = 0; py < s; py++) {
      for (let px = 0; px < s; px++) {
        // Noise stretched vertically gives long ridges and furrows.
        const ridge = fbm(px, py * 0.18, s, 10, 4, 41);
        const fissure = Math.abs(ridge - 0.5) < 0.05 ? 0.45 : 1;
        const v = (0.55 + (ridge - 0.5) * 0.9) * fissure;
        const i = (py * s + px) * 4;
        img.data[i] = G.clamp(v * 120, 0, 255);
        img.data[i + 1] = G.clamp(v * 86, 0, 255);
        img.data[i + 2] = G.clamp(v * 60, 0, 255);
        img.data[i + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    dabs(x, s, 8, 4, 10, () => hsl(80, 30, 55, 0.35));
    return colourTex(c, true);
  }

  /* Geometry helpers ------------------------------------------------------- */

  // Merge geometries into one non-indexed geometry with vertex colours.
  function merge(list) {
    const pos = [];
    const nor = [];
    const uv = [];
    const col = [];
    for (const src of list) {
      const g = src.index ? src.toNonIndexed() : src;
      const p = g.attributes.position;
      const n = g.attributes.normal;
      const u = g.attributes.uv;
      const c = g.attributes.color;
      for (let i = 0; i < p.count; i++) {
        pos.push(p.getX(i), p.getY(i), p.getZ(i));
        nor.push(n.getX(i), n.getY(i), n.getZ(i));
        uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
        if (c) col.push(c.getX(i), c.getY(i), c.getZ(i));
        else col.push(1, 1, 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return geo;
  }

  // Collects quads (as two triangles) with per-vertex normal and colour.
  function quadBuilder() {
    const pos = [];
    const nor = [];
    const uv = [];
    const col = [];
    return {
      // Corners a, b, c, d in order; n is the shading normal; k the shade.
      quad(a, b, c, d, n, k, uvs) {
        const [ua, ub, uc, ud] = uvs || [[0, 0], [1, 0], [1, 1], [0, 1]];
        for (const [p, t] of [[a, ua], [b, ub], [c, uc], [a, ua], [c, uc], [d, ud]]) {
          pos.push(p.x, p.y, p.z);
          nor.push(n.x, n.y, n.z);
          uv.push(t[0], t[1]);
          col.push(k, k, k);
        }
      },
      build() {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        return geo;
      },
    };
  }

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const UP = V(0, 1, 0);

  // A tapered cylinder from point a to point b.
  function limb(a, b, r0, r1, segs) {
    const dir = b.clone().sub(a);
    const geo = new THREE.CylinderGeometry(r1, r0, dir.length(), segs || 7, 1, true);
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
    geo.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, V(1, 1, 1)));
    return G.land.tiled(geo, 1, Math.max(1, dir.length() / 2));
  }

  /* Oak -------------------------------------------------------------------- */

  const OAK_BLOBS = [
    [0, 6.6, 0, 2.7],
    [1.8, 5.8, 0.6, 2],
    [-1.6, 6, -0.8, 2.1],
    [0.3, 5.7, -1.8, 1.9],
    [-0.4, 8.1, 0.4, 1.9],
    [-0.8, 5.6, 1.6, 1.8],
  ];

  function oakTrunk() {
    // Flared base where the roots spread.
    const pts = [[1.05, 0], [0.72, 0.35], [0.56, 1], [0.48, 2.6], [0.4, 4.4]].map(([r, y]) => new THREE.Vector2(r, y));
    const parts = [G.land.tiled(new THREE.LatheGeometry(pts, 10), 2, 2)];
    // Limbs forking up into the crown, each ending in a few twigs.
    for (const [bx, by, bz] of OAK_BLOBS.slice(1)) {
      const start = V(bx * 0.1, 3.8 + Math.random() * 0.4, bz * 0.1);
      const end = V(bx * 0.75, by - 0.4, bz * 0.75);
      parts.push(limb(start, end, 0.3, 0.13));
      for (let k = 0; k < 2; k++) {
        const tip = end.clone().add(V(G.rand(-1, 1), G.rand(0.3, 1), G.rand(-1, 1)));
        parts.push(limb(end, tip, 0.13, 0.05, 5));
      }
    }
    return merge(parts);
  }

  // Leaf cards scattered over the crown, facing outwards, darker inside and
  // underneath so the crown reads as a solid, sunlit mass.
  function oakLeaves() {
    const qb = quadBuilder();
    for (const [bx, by, bz, br] of OAK_BLOBS) {
      const centre = V(bx, by, bz);
      const n = Math.round(br * 16);
      for (let i = 0; i < n; i++) {
        const d = V(G.rand(-1, 1), G.rand(-0.7, 1), G.rand(-1, 1)).normalize();
        const depth = G.rand(0.5, 1);
        const c = centre.clone().addScaledVector(d, br * depth);
        const face = d.clone().add(V(G.rand(-0.5, 0.5), G.rand(-0.3, 0.5), G.rand(-0.5, 0.5))).normalize();
        const t = new THREE.Vector3().crossVectors(face, V(Math.random(), Math.random(), Math.random()).normalize()).normalize();
        const b = new THREE.Vector3().crossVectors(face, t);
        const half = br * G.rand(0.5, 0.72);
        const corner = (sx, sy) => c.clone().addScaledVector(t, sx * half).addScaledVector(b, sy * half);
        const shade = G.clamp(0.45 + 0.35 * (d.y * 0.5 + 0.5) + 0.25 * depth, 0.4, 1.05);
        qb.quad(corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1), d, shade);
      }
    }
    return qb.build();
  }

  // Lumpy inner mass behind the cards, so the crown has no see-through holes.
  function oakCore() {
    const parts = [];
    for (const [bx, by, bz, br] of OAK_BLOBS) {
      const g = new THREE.IcosahedronGeometry(br * 0.62, 1);
      const p = g.attributes.position;
      const n = g.attributes.normal;
      for (let i = 0; i < p.count; i++) {
        const v = V(p.getX(i), p.getY(i), p.getZ(i));
        n.setXYZ(i, v.x / v.length(), v.y / v.length(), v.z / v.length());
      }
      g.translate(bx, by, bz);
      parts.push(g);
    }
    return merge(parts);
  }

  /* Pine ------------------------------------------------------------------- */

  function pineTrunk() {
    const pts = [[0.55, 0], [0.38, 0.4], [0.32, 1.5], [0.06, 11.4]].map(([r, y]) => new THREE.Vector2(r, y));
    return merge([G.land.tiled(new THREE.LatheGeometry(pts, 8), 2, 5)]);
  }

  // One bough: a crossed pair of bent cards (one lying flat, one upright)
  // so it reads from any angle. lift tips the base upwards; droop bends the
  // tip down; t is the height up the tree (0 bottom, 1 top).
  function bough(qb, y, a, len, lift, droop, t) {
    const dir = V(Math.cos(a), 0, Math.sin(a));
    const side = V(-Math.sin(a), 0, Math.cos(a));
    const spine = [0, 0.5, 1].map((u) =>
      V(0, y, 0)
        .addScaledVector(dir, 0.1 + len * u)
        .addScaledVector(UP, len * (lift * u - droop * u * u))
    );
    const width = (0.95 + len * 0.48) / 2;
    const n = dir.clone().multiplyScalar(0.55).add(V(0, 0.85, 0)).normalize();
    for (let s = 0; s < 2; s++) {
      const u0 = s / 2;
      const u1 = (s + 1) / 2;
      const w0 = width * (1 - u0 * 0.4);
      const w1 = width * (1 - u1 * 0.4);
      const p0 = spine[s];
      const p1 = spine[s + 1];
      const shade = 0.55 + 0.45 * u1 * (0.75 + 0.25 * t);
      const uvs = [[u0, 0], [u1, 0], [u1, 1], [u0, 1]];
      qb.quad(p0.clone().addScaledVector(side, -w0), p1.clone().addScaledVector(side, -w1), p1.clone().addScaledVector(side, w1), p0.clone().addScaledVector(side, w0), n, shade, uvs);
      qb.quad(p0.clone().addScaledVector(UP, -w0 * 0.75), p1.clone().addScaledVector(UP, -w1 * 0.75), p1.clone().addScaledVector(UP, w1 * 0.75), p0.clone().addScaledVector(UP, w0 * 0.75), n, shade * 0.92, uvs);
    }
  }

  // Tiers of drooping boughs, a ring of shorter upswept boughs filling each
  // gap between tiers, and a tuft of upright sprays hiding the leader's tip.
  function pineBoughs() {
    const qb = quadBuilder();
    const tiers = 13;
    const spacing = 8.9 / (tiers - 1);
    for (let i = 0; i < tiers; i++) {
      const t = i / (tiers - 1);
      const y = 1.9 + t * 8.9;
      const reach = 3.2 * (1 - t) + 0.55 * t;
      const count = Math.round(12 - t * 5);
      const spin = Math.random() * Math.PI * 2;
      for (let k = 0; k < count; k++) {
        const a = spin + (k / count) * Math.PI * 2 + G.rand(-0.2, 0.2);
        bough(qb, y, a, reach * G.rand(0.85, 1.12), 0, 0.3 + 0.35 * (1 - t), t);
      }
      // Fillers, offset round the trunk so they sit in the gaps.
      if (i === tiers - 1) continue;
      const fills = Math.round(count * 0.75);
      for (let k = 0; k < fills; k++) {
        const a = spin + ((k + 0.5) / fills) * Math.PI * 2 + G.rand(-0.25, 0.25);
        bough(qb, y + spacing * 0.5, a, reach * G.rand(0.55, 0.8), 0.25, 0.4, t);
      }
    }
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + G.rand(-0.3, 0.3);
      bough(qb, 10.6, a, G.rand(0.6, 0.9), 1.6, 0.6, 1);
    }
    return qb.build();
  }

  // Slim dark cones inside the boughs, so the tree looks full from afar.
  function pineCore() {
    const parts = [
      [1.7, 6.5, 4.9],
      [1.05, 4.2, 8.6],
    ].map(([r, h, y]) => G.land.tiled(new THREE.ConeGeometry(r, h, 10).translate(0, y, 0), 3, 2));
    return merge(parts);
  }

  /* Materials -------------------------------------------------------------- */

  // Foliage cards: alpha-cut, double-sided, with a depth material that
  // honours the cut-out so shadows show leaves rather than squares.
  function foliage(map) {
    const mat = new THREE.MeshStandardMaterial({
      map,
      alphaTest: 0.45,
      side: THREE.DoubleSide,
      vertexColors: true,
      roughness: 0.9,
    });
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.45 });
    return { mat, depth };
  }

  // Each tree is a list of parts: { geo, mat, depth?, tint }. Tinted parts
  // take a per-tree colour, so no two trees are quite the same green.
  G.trees = function () {
    const barkTex = bark();
    const barkMat = new THREE.MeshStandardMaterial({ map: barkTex, roughness: 0.95, vertexColors: true });
    const leaves = foliage(leafCluster());
    const boughs = foliage(needleSpray());
    const oakCoreMat = new THREE.MeshStandardMaterial({ color: 0x78944e, map: G.tex.leaves, roughness: 1, vertexColors: true });
    const pineCoreMat = new THREE.MeshStandardMaterial({ color: 0x5f7766, map: G.tex.needles, roughness: 1, vertexColors: true });
    return {
      oak: [
        { geo: oakTrunk(), mat: barkMat },
        { geo: oakCore(), mat: oakCoreMat, tint: true },
        { geo: oakLeaves(), mat: leaves.mat, depth: leaves.depth, tint: true },
      ],
      pine: [
        { geo: pineTrunk(), mat: barkMat },
        { geo: pineCore(), mat: pineCoreMat, tint: true },
        { geo: pineBoughs(), mat: boughs.mat, depth: boughs.depth, tint: true },
      ],
    };
  };
})();

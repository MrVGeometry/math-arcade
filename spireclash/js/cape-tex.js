/**
 * Spireclash cape textures: a shared wrinkle height field (long creases
 * running from the shoulders to the hem, crumpled gathers under the collar
 * and small crinkles throughout), turned into a normal map for the lighting
 * and blended into each palette's painted cloth.
 */
(function () {
  'use strict';
  const G = window.G;

  const W = 256;
  const H = 512;
  const hex = (c) => '#' + c.toString(16).padStart(6, '0');
  const capeCache = {};
  let height = null;
  let normal = null;

  // One soft ridge (light) or valley (dark): a wide faint pass under a
  // narrow strong one, so each crease has a rounded profile.
  function crease(g, pts, light, width) {
    const col = light ? '255,255,255' : '0,0,0';
    for (const [w, a] of [[width * 3, 0.1], [width * 1.8, 0.16], [width, 0.28]]) {
      g.strokeStyle = `rgba(${col},${a})`;
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(pts[0], pts[1]);
      g.bezierCurveTo(pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]);
      g.stroke();
    }
  }

  // Box blur the height field (three passes approximate a Gaussian), so the
  // creases swell and sink smoothly instead of reading as scratches.
  function soften(g) {
    const img = g.getImageData(0, 0, W, H);
    const d = img.data;
    let a = new Float32Array(W * H);
    for (let i = 0; i < W * H; i += 1) a[i] = d[i * 4];
    let b = new Float32Array(W * H);
    const r = 3;
    for (let pass = 0; pass < 3; pass += 1) {
      for (const horiz of [true, false]) {
        for (let y = 0; y < H; y += 1) {
          for (let x = 0; x < W; x += 1) {
            let sum = 0;
            for (let k = -r; k <= r; k += 1) {
              const xx = horiz ? Math.min(W - 1, Math.max(0, x + k)) : x;
              const yy = horiz ? y : Math.min(H - 1, Math.max(0, y + k));
              sum += a[yy * W + xx];
            }
            b[y * W + x] = sum / (r * 2 + 1);
          }
        }
        [a, b] = [b, a];
      }
    }
    for (let i = 0; i < W * H; i += 1) {
      d[i * 4] = a[i];
      d[i * 4 + 1] = a[i];
      d[i * 4 + 2] = a[i];
    }
    g.putImageData(img, 0, 0);
  }

  function paintHeight() {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#808080';
    g.fillRect(0, 0, W, H);
    g.lineCap = 'round';
    // Long creases fanning out from the shoulders to the hem.
    for (let i = 0; i < 34; i += 1) {
      const x0 = W * (0.12 + Math.random() * 0.76);
      const x1 = W / 2 + (x0 - W / 2) * G.rand(1.1, 1.5) + G.rand(-20, 20);
      const y0 = G.rand(0, H * 0.25);
      const y1 = G.rand(H * 0.6, H);
      const pts = [x0, y0, x0 + G.rand(-14, 14), y0 + (y1 - y0) * 0.35, x1 + G.rand(-14, 14), y0 + (y1 - y0) * 0.7, x1, y1];
      crease(g, pts, i % 2 === 0, G.rand(3, 7));
    }
    // Crumpled gathers bunched under the collar.
    for (let i = 0; i < 34; i += 1) {
      const x = Math.random() * W;
      const y = G.rand(4, H * 0.22);
      const len = G.rand(14, 40);
      const tilt = G.rand(-0.5, 0.5);
      const pts = [x - len / 2, y - tilt * len, x - len / 6, y + G.rand(-6, 6), x + len / 6, y + G.rand(-6, 6), x + len / 2, y + tilt * len];
      crease(g, pts, Math.random() < 0.5, G.rand(2.5, 5));
    }
    // Small diagonal crinkles across the whole cloth.
    for (let i = 0; i < 50; i += 1) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const a = G.rand(-1.1, 1.1) + Math.PI / 2;
      const len = G.rand(10, 34);
      const dx = Math.cos(a) * len;
      const dy = Math.sin(a) * len;
      const pts = [x, y, x + dx * 0.33 + G.rand(-4, 4), y + dy * 0.33, x + dx * 0.66 + G.rand(-4, 4), y + dy * 0.66, x + dx, y + dy];
      crease(g, pts, Math.random() < 0.5, G.rand(1.8, 3.5));
    }
    // Stress wrinkles pulled taut near the hem.
    for (let i = 0; i < 24; i += 1) {
      const x = Math.random() * W;
      const y = G.rand(H * 0.8, H - 24);
      const pts = [x - 18, y, x - 6, y + G.rand(-3, 3), x + 6, y + G.rand(-3, 3), x + 18, y + G.rand(-4, 4)];
      crease(g, pts, Math.random() < 0.5, G.rand(2, 4));
    }
    soften(g);
    return c;
  }

  // Normal map from the height field: slopes become tilted normals.
  function paintNormal(src) {
    const h = src.getContext('2d').getImageData(0, 0, W, H).data;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const img = g.createImageData(W, H);
    const out = img.data;
    const at = (x, y) => h[(Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * 4] / 255;
    const strength = 6.5;
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        // Canvas rows run down while texture v runs up, hence the signs.
        const nx = -(at(x + 1, y) - at(x - 1, y)) * strength;
        const ny = (at(x, y + 1) - at(x, y - 1)) * strength;
        const len = Math.hypot(nx, ny, 1);
        const i = (y * W + x) * 4;
        out[i] = (nx / len * 0.5 + 0.5) * 255;
        out[i + 1] = (ny / len * 0.5 + 0.5) * 255;
        out[i + 2] = (1 / len * 0.5 + 0.5) * 255;
        out[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function ensureHeight() {
    if (height) return;
    height = paintHeight();
    normal = new THREE.CanvasTexture(paintNormal(height));
    normal.anisotropy = 4;
  }

  // Shared wrinkle normal map, linear (not colour) data.
  G.capeNormal = function () {
    ensureHeight();
    return normal;
  };

  // Painted cape face for a palette: heavy cloth with the wrinkles shaded
  // in, darker under the collar, with a gilded hem band and side edging.
  G.capeTexture = function (pal) {
    if (capeCache[pal.key]) return capeCache[pal.key];
    ensureHeight();
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = hex(pal.cloth);
    g.fillRect(0, 0, W, H);
    // Woven texture: faint horizontal threads and speckled grain.
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = 0; y < H; y += 2) g.fillRect(0, y, W, 1);
    G.texKit.grain(g, H, 8);
    // Wrinkles shaded into the colour so they read even in flat light.
    g.globalAlpha = 0.45;
    g.globalCompositeOperation = 'overlay';
    g.drawImage(height, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    const shade = g.createLinearGradient(0, 0, 0, H);
    shade.addColorStop(0, 'rgba(0,0,0,0.4)');
    shade.addColorStop(0.12, 'rgba(0,0,0,0)');
    shade.addColorStop(0.85, 'rgba(255,255,255,0.04)');
    shade.addColorStop(1, 'rgba(0,0,0,0.2)');
    g.fillStyle = shade;
    g.fillRect(0, 0, W, H);
    const trim = hex(pal.trim);
    g.fillStyle = trim;
    g.fillRect(0, H - 26, W, 16);
    g.fillRect(0, H - 40, W, 4);
    g.fillRect(0, 0, 7, H);
    g.fillRect(W - 7, 0, 7, H);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(0, H - 10, W, 10);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 4;
    capeCache[pal.key] = tex;
    return tex;
  };
})();

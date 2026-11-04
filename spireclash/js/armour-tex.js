/**
 * Spireclash armour textures, after the concept art: battle-worn plate
 * (hammer marks, dents, scratches and nicks, with grime in the low spots),
 * rubbed gilding for the trim, and stitched leather for belts and straps.
 * Each comes as a greyscale colour map (tinted by the palette) plus a
 * normal map, so the wear catches the light as well as being painted on.
 */
(function () {
  'use strict';
  const G = window.G;

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h || w;
    return c;
  }

  // Box blur in place on a single-channel buffer, wrapping at the edges so
  // the result still tiles.
  function blur(a, w, h, r, passes) {
    let src = a;
    let dst = new Float32Array(w * h);
    for (let p = 0; p < passes; p += 1) {
      for (const horiz of [true, false]) {
        for (let y = 0; y < h; y += 1) {
          for (let x = 0; x < w; x += 1) {
            let sum = 0;
            for (let k = -r; k <= r; k += 1) {
              const xx = horiz ? (x + k + w) % w : x;
              const yy = horiz ? y : (y + k + h) % h;
              sum += src[yy * w + xx];
            }
            dst[y * w + x] = sum / (r * 2 + 1);
          }
        }
        [src, dst] = [dst, src];
      }
    }
    return src;
  }

  function readGrey(c) {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const a = new Float32Array(c.width * c.height);
    for (let i = 0; i < a.length; i += 1) a[i] = d[i * 4] / 255;
    return a;
  }

  /**
   * Normal map canvas from a greyscale height canvas. `soften` blurs the
   * height first (pixels of radius), `wrap` treats the edges as tiling.
   */
  G.heightToNormal = function (src, strength, soften, wrap) {
    const w = src.width;
    const h = src.height;
    let a = readGrey(src);
    if (soften) a = blur(a, w, h, soften, 2);
    const at = (x, y) => {
      const xx = wrap ? (x + w) % w : Math.min(w - 1, Math.max(0, x));
      const yy = wrap ? (y + h) % h : Math.min(h - 1, Math.max(0, y));
      return a[yy * w + xx];
    };
    const c = canvas(w, h);
    const g = c.getContext('2d');
    const img = g.createImageData(w, h);
    const out = img.data;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        // Canvas rows run down while texture v runs up, hence the signs.
        const nx = -(at(x + 1, y) - at(x - 1, y)) * strength;
        const ny = (at(x, y + 1) - at(x, y - 1)) * strength;
        const len = Math.hypot(nx, ny, 1);
        const i = (y * w + x) * 4;
        out[i] = (nx / len * 0.5 + 0.5) * 255;
        out[i + 1] = (ny / len * 0.5 + 0.5) * 255;
        out[i + 2] = (1 / len * 0.5 + 0.5) * 255;
        out[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  };

  // Draw fn at (x, y) and at its wrapped copies so marks tile seamlessly.
  function tiled(s, x, y, fn) {
    for (const ox of [-s, 0, s]) {
      for (const oy of [-s, 0, s]) fn(x + ox, y + oy);
    }
  }

  function soft(g, x, y, r, col, a) {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${col},${a})`);
    grad.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // A scratch: a short gently curved stroke.
  function scratch(g, x, y, len, ang, width, style) {
    g.strokeStyle = style;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(x, y);
    const bend = G.rand(-0.25, 0.25);
    g.quadraticCurveTo(
      x + Math.cos(ang + bend) * len * 0.5,
      y + Math.sin(ang + bend) * len * 0.5,
      x + Math.cos(ang) * len,
      y + Math.sin(ang) * len
    );
    g.stroke();
  }

  // Shared wear layout, so the painted marks and the dents line up.
  function wearPlan(s) {
    const plan = { dents: [], hammer: [], scratches: [], nicks: [] };
    for (let i = 0; i < 9; i += 1) plan.dents.push([Math.random() * s, Math.random() * s, G.rand(10, 26)]);
    for (let i = 0; i < 70; i += 1) plan.hammer.push([Math.random() * s, Math.random() * s, G.rand(5, 11)]);
    for (let i = 0; i < 40; i += 1) {
      plan.scratches.push([Math.random() * s, Math.random() * s, G.rand(6, 26), G.rand(0, Math.PI * 2), G.rand(0.6, 1.2)]);
    }
    for (let i = 0; i < 10; i += 1) plan.nicks.push([Math.random() * s, Math.random() * s, G.rand(1.5, 3)]);
    return plan;
  }

  function steelHeight(s, plan) {
    const c = canvas(s);
    const g = c.getContext('2d');
    g.fillStyle = '#808080';
    g.fillRect(0, 0, s, s);
    for (const [x, y, r] of plan.hammer) tiled(s, x, y, (px, py) => soft(g, px, py, r, '0,0,0', 0.12));
    for (const [x, y, r] of plan.dents) tiled(s, x, y, (px, py) => soft(g, px, py, r, '0,0,0', 0.22));
    g.lineCap = 'round';
    for (const [x, y, len, ang, w] of plan.scratches) {
      tiled(s, x, y, (px, py) => scratch(g, px, py, len, ang, w, 'rgba(0,0,0,0.35)'));
    }
    for (const [x, y, r] of plan.nicks) tiled(s, x, y, (px, py) => soft(g, px, py, r * 1.6, '0,0,0', 0.4));
    return c;
  }

  function steelColour(s, plan) {
    const c = canvas(s);
    const g = c.getContext('2d');
    g.fillStyle = '#a2a2a2';
    g.fillRect(0, 0, s, s);
    // Broad worn mottling: polished patches and dull ones.
    for (let i = 0; i < 26; i += 1) {
      const light = Math.random() < 0.5;
      const x = Math.random() * s;
      const y = Math.random() * s;
      const r = G.rand(20, 60);
      tiled(s, x, y, (px, py) => soft(g, px, py, r, light ? '255,255,255' : '34,30,26', light ? 0.2 : 0.24));
    }
    // Fine brushed grain.
    for (let i = 0; i < 160; i += 1) {
      const y = Math.random() * s;
      g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
      g.fillRect(0, y, s, 1);
    }
    // Grime settles in the dents.
    for (const [x, y, r] of plan.dents) tiled(s, x, y, (px, py) => soft(g, px, py, r, '30,26,22', 0.12));
    g.lineCap = 'round';
    // Scratches cut through to bright metal, with a dark lip beside them.
    for (const [x, y, len, ang, w] of plan.scratches) {
      tiled(s, x, y, (px, py) => {
        scratch(g, px + 0.7, py + 0.7, len, ang, w, 'rgba(20,20,20,0.18)');
        scratch(g, px, py, len, ang, w * 0.7, 'rgba(255,255,255,0.4)');
      });
    }
    for (const [x, y, r] of plan.nicks) {
      tiled(s, x, y, (px, py) => {
        soft(g, px, py, r * 1.2, '15,15,15', 0.3);
        soft(g, px - r * 0.5, py - r * 0.5, r * 0.6, '255,255,255', 0.5);
      });
    }
    G.texKit.grain(g, s, 10);
    return c;
  }

  // Rubbed gilding: bright on the high spots, dirty in the recesses.
  function goldColour(s) {
    const c = canvas(s);
    const g = c.getContext('2d');
    g.fillStyle = '#d8d8d8';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 40; i += 1) {
      const light = Math.random() < 0.55;
      const x = Math.random() * s;
      const y = Math.random() * s;
      const r = G.rand(6, 26);
      tiled(s, x, y, (px, py) => soft(g, px, py, r, light ? '255,255,255' : '50,38,20', light ? 0.3 : 0.35));
    }
    g.lineCap = 'round';
    for (let i = 0; i < 30; i += 1) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const len = G.rand(6, 24);
      const ang = G.rand(0, Math.PI * 2);
      tiled(s, x, y, (px, py) => scratch(g, px, py, len, ang, 1, 'rgba(255,255,255,0.45)'));
    }
    G.texKit.grain(g, s, 14);
    return c;
  }

  // Leather: pebbled grain, creases and a stitched seam along both edges.
  function leatherColour(s) {
    const c = canvas(s);
    const g = c.getContext('2d');
    g.fillStyle = '#b8b8b8';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 400; i += 1) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      tiled(s, x, y, (px, py) => soft(g, px, py, G.rand(2, 5), Math.random() < 0.5 ? '0,0,0' : '255,255,255', 0.12));
    }
    g.lineCap = 'round';
    for (let i = 0; i < 20; i += 1) {
      const x = Math.random() * s;
      const y = Math.random() * s;
      const len = G.rand(10, 30);
      const ang = G.rand(-0.4, 0.4) + (Math.random() < 0.5 ? 0 : Math.PI / 2);
      tiled(s, x, y, (px, py) => scratch(g, px, py, len, ang, 1.5, 'rgba(0,0,0,0.25)'));
    }
    g.fillStyle = 'rgba(255,240,210,0.7)';
    for (let x = 2; x < s; x += 8) {
      g.fillRect(x, s * 0.1, 4, 1.5);
      g.fillRect(x, s * 0.88, 4, 1.5);
    }
    G.texKit.grain(g, s, 12);
    return c;
  }

  function tex(c, colour, rep) {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rep || 1, rep || 1);
    t.anisotropy = 8;
    if (colour) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  /**
   * A neutral studio-like panorama for the armour to reflect: dull sky, a
   * bright warm horizon that rims each facet, and a dark ground, so plate
   * reads as grey steel and gilding as gold whatever the scenery.
   */
  G.makeArmourEnv = function (renderer) {
    const c = canvas(256, 128);
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#4c525c');
    grad.addColorStop(0.38, '#a9aeb6');
    grad.addColorStop(0.49, '#e2d6bf');
    grad.addColorStop(0.54, '#6b5d4c');
    grad.addColorStop(1, '#221e1a');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 128);
    // Two soft lights to glint in the facets.
    soft(g, 70, 34, 16, '255,248,230', 0.95);
    soft(g, 190, 42, 12, '255,240,210', 0.7);
    const t = new THREE.CanvasTexture(c);
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.encoding = THREE.sRGBEncoding;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromEquirectangular(t).texture;
    pmrem.dispose();
    t.dispose();
    return env;
  };

  G.armourTextures = function () {
    const s = 256;
    const plan = wearPlan(s);
    const gold = goldColour(128);
    const height = steelHeight(s, plan);
    return {
      // Kept as a canvas so helm.js can paint it under its own detail.
      steelHeight: height,
      steel: tex(steelColour(s, plan), true, 2),
      steelNormal: tex(G.heightToNormal(height, 3, 1, true), false, 2),
      gold: tex(gold, true),
      goldNormal: tex(G.heightToNormal(gold, 1.5, 1, true), false),
      leather: tex(leatherColour(128), true),
    };
  };
})();

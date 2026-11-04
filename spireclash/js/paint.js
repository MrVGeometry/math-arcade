/**
 * Spireclash painted textures, in the soft hand-painted style of late-90s
 * console adventures: mottled colour, painted highlights and shadows, moss
 * and cracks instead of hard pixel edges. Every texture tiles seamlessly.
 */
(function () {
  'use strict';
  const G = window.G;

  const hsl = (h, s, l, a) => `hsla(${h}, ${s}%, ${l}%, ${a === undefined ? 1 : a})`;

  // A soft round dab of colour, repeated across the edges so the tile wraps.
  function dab(x, size, cx, cy, r, colour) {
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const px = cx + ox;
        const py = cy + oy;
        if (px + r < 0 || px - r > size || py + r < 0 || py - r > size) continue;
        const g = x.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, colour);
        g.addColorStop(1, colour.replace(/[\d.]+\)$/, '0)'));
        x.fillStyle = g;
        x.fillRect(px - r, py - r, r * 2, r * 2);
      }
    }
  }

  function dabs(x, size, n, rMin, rMax, colourFn) {
    for (let i = 0; i < n; i++) {
      dab(x, size, Math.random() * size, Math.random() * size, G.rand(rMin, rMax), colourFn());
    }
  }

  // A wobbly rounded stone, painted with its own mottling, a lit top edge, a
  // shaded base, the odd crack and moss creeping up from the bottom.
  function stone(x, px, py, w, h, o) {
    const j = () => G.rand(-o.jitter, o.jitter);
    const r = Math.min(w, h) * (o.round || 0.22);
    x.save();
    x.beginPath();
    x.moveTo(px + r + j(), py + j());
    x.quadraticCurveTo(px + w / 2, py + j(), px + w - r + j(), py + j());
    x.quadraticCurveTo(px + w + j(), py + j(), px + w + j(), py + r);
    x.quadraticCurveTo(px + w + j(), py + h / 2, px + w + j(), py + h - r);
    x.quadraticCurveTo(px + w + j(), py + h + j(), px + w - r, py + h + j());
    x.quadraticCurveTo(px + w / 2, py + h + j(), px + r, py + h + j());
    x.quadraticCurveTo(px + j(), py + h + j(), px + j(), py + h - r);
    x.quadraticCurveTo(px + j(), py + h / 2, px + j(), py + r);
    x.quadraticCurveTo(px + j(), py + j(), px + r + j(), py + j());
    x.closePath();
    const l = o.light + G.rand(-o.vary, o.vary);
    const hue = o.hue + G.rand(-6, 6);
    x.fillStyle = hsl(hue, o.sat, l);
    x.fill();
    x.clip();
    for (let i = 0; i < 7; i++) {
      const cx = px + Math.random() * w;
      const cy = py + Math.random() * h;
      const rr = G.rand(0.2, 0.5) * Math.max(w, h);
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
      const c = Math.random() < 0.5 ? hsl(hue, o.sat, l + 9, 0.45) : hsl(hue + 10, o.sat + 4, l - 10, 0.4);
      g.addColorStop(0, c);
      g.addColorStop(1, c.replace(/[\d.]+\)$/, '0)'));
      x.fillStyle = g;
      x.fillRect(px - rr, py - rr, w + rr * 2, h + rr * 2);
    }
    const shade = x.createLinearGradient(0, py, 0, py + h);
    shade.addColorStop(0, 'rgba(255,248,230,0.28)');
    shade.addColorStop(0.18, 'rgba(255,248,230,0)');
    shade.addColorStop(0.7, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(20,12,4,0.38)');
    x.fillStyle = shade;
    x.fillRect(px - 4, py - 4, w + 8, h + 8);
    if (o.moss && Math.random() < o.moss) {
      for (let i = 0; i < 5; i++) {
        const cx = px + Math.random() * w;
        const cy = py + h - Math.random() * h * 0.3;
        const rr = G.rand(6, 16);
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
        g.addColorStop(0, 'hsla(88, 38%, 34%, 0.55)');
        g.addColorStop(1, 'hsla(88, 38%, 34%, 0)');
        x.fillStyle = g;
        x.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
      }
    }
    if (Math.random() < 0.35) {
      x.strokeStyle = 'rgba(30,20,10,0.35)';
      x.lineWidth = 1.2;
      x.beginPath();
      let cx = px + G.rand(0.2, 0.8) * w;
      let cy = py;
      x.moveTo(cx, cy);
      while (cy < py + h * 0.7) {
        cx += G.rand(-6, 6);
        cy += G.rand(5, 11);
        x.lineTo(cx, cy);
      }
      x.stroke();
    }
    x.restore();
  }

  function mortar(x, s, colour) {
    x.fillStyle = colour;
    x.fillRect(0, 0, s, s);
    dabs(x, s, 30, 10, 30, () => (Math.random() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)'));
  }

  /* Conjured build pieces -------------------------------------------------- */

  function wallStone() {
    const { canvas, texture, grain } = G.texKit;
    const s = 256;
    const c = canvas(s);
    const x = c.getContext('2d');
    mortar(x, s, '#5d564c');
    const o = { hue: 34, sat: 14, light: 56, vary: 7, jitter: 3, moss: 0.4 };
    const bh = s / 4;
    for (let r = 0; r < 4; r++) {
      const off = r % 2 ? s / 4 : 0;
      for (let b = -1; b < 2; b++) stone(x, b * (s / 2) + off + 3, r * bh + 3, s / 2 - 6, bh - 6, o);
    }
    grain(x, s, 6);
    return texture(c);
  }

  function floorStone() {
    const { canvas, texture, grain } = G.texKit;
    const s = 256;
    const c = canvas(s);
    const x = c.getContext('2d');
    mortar(x, s, '#564f46');
    const o = { hue: 36, sat: 12, light: 55, vary: 6, jitter: 4, moss: 0.2 };
    stone(x, 4, 4, 150, 120, o);
    stone(x, 158, 4, 94, 120, o);
    stone(x, 4, 128, 96, 124, o);
    stone(x, 104, 128, 148, 124, o);
    grain(x, s, 6);
    return texture(c);
  }

  function stairStone() {
    const { canvas, texture, grain } = G.texKit;
    const s = 256;
    const c = canvas(s);
    const x = c.getContext('2d');
    mortar(x, s, '#4f483f');
    const o = { hue: 34, sat: 13, light: 57, vary: 5, jitter: 2, moss: 0.15 };
    const bh = s / 5;
    for (let i = 0; i < 5; i++) stone(x, 4, i * bh + 3, s - 8, bh - 6, o);
    grain(x, s, 6);
    return texture(c);
  }

  function roofSlate() {
    const { canvas, texture, grain } = G.texKit;
    const s = 256;
    const c = canvas(s);
    const x = c.getContext('2d');
    x.fillStyle = '#232a3b';
    x.fillRect(0, 0, s, s);
    const rows = 6;
    const rh = s / rows;
    const tw = s / 6;
    for (let r = 0; r < rows; r++) {
      const off = r % 2 ? tw / 2 : 0;
      for (let b = -1; b < 7; b++) {
        const px = b * tw + off + 2;
        const py = r * rh;
        const l = 36 + G.rand(-6, 6);
        const g = x.createLinearGradient(0, py, 0, py + rh);
        g.addColorStop(0, hsl(222, 24, l - 10));
        g.addColorStop(0.8, hsl(222, 24, l + 4));
        g.addColorStop(1, hsl(222, 24, l - 4));
        x.fillStyle = g;
        x.beginPath();
        x.moveTo(px, py);
        x.lineTo(px + tw - 4, py);
        x.lineTo(px + tw - 4, py + rh * 0.6);
        x.quadraticCurveTo(px + tw - 4, py + rh + 5, px + (tw - 4) / 2, py + rh + 5);
        x.quadraticCurveTo(px, py + rh + 5, px, py + rh * 0.6);
        x.closePath();
        x.fill();
      }
    }
    dabs(x, s, 20, 10, 26, () => 'rgba(255,255,255,0.06)');
    grain(x, s, 5);
    return texture(c);
  }

  /* Landscape -------------------------------------------------------------- */

  // Call draw(ox, oy) once per tile copy a shape near (px, py) overlaps, so
  // strokes that cross an edge carry on from the opposite side.
  function wrapped(size, px, py, margin, draw) {
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const qx = px + ox;
        const qy = py + oy;
        if (qx < -margin || qx > size + margin || qy < -margin || qy > size + margin) continue;
        draw(ox, oy);
      }
    }
  }

  // One tapered, gently curving blade of grass, rooted at (bx, by).
  function blade(x, bx, by, len, lean, width, colour) {
    const tipX = bx + lean;
    const tipY = by - len;
    x.fillStyle = colour;
    x.beginPath();
    x.moveTo(bx - width, by);
    x.quadraticCurveTo(bx - width * 0.6 + lean * 0.3, by - len * 0.55, tipX, tipY);
    x.quadraticCurveTo(bx + width * 0.6 + lean * 0.3, by - len * 0.55, bx + width, by);
    x.closePath();
    x.fill();
  }

  // Meadow grass: shady soil, then layer upon layer of blades, darker and
  // bluer underneath, lighter and yellower on top, with sunlit tips. The hue
  // is kept soft because the terrain's vertex colours tint it.
  function groundDetail() {
    const { canvas, texture, grain } = G.texKit;
    const s = 256;
    const c = canvas(s);
    const x = c.getContext('2d');
    x.fillStyle = hsl(85, 22, 30);
    x.fillRect(0, 0, s, s);
    // Clumps: patches where the grass grows thicker or thinner.
    dabs(x, s, 26, 18, 44, () => (Math.random() < 0.5 ? hsl(80, 25, 48, 0.5) : hsl(95, 25, 20, 0.45)));
    const layers = [
      { n: 1400, len: [7, 12], light: [30, 46], hue: [90, 110], w: [1, 1.6] },
      { n: 1500, len: [8, 15], light: [44, 62], hue: [78, 98], w: [0.9, 1.5] },
      { n: 900, len: [9, 16], light: [60, 78], hue: [68, 88], w: [0.8, 1.3] },
    ];
    for (const L of layers) {
      for (let i = 0; i < L.n; i++) {
        const bx = Math.random() * s;
        const by = Math.random() * s;
        const len = G.rand(L.len[0], L.len[1]);
        const lean = G.rand(-5, 5);
        const w = G.rand(L.w[0], L.w[1]);
        const col = hsl(G.rand(L.hue[0], L.hue[1]), G.rand(22, 38), G.rand(L.light[0], L.light[1]), 0.9);
        wrapped(s, bx, by, 18, (ox, oy) => blade(x, bx + ox, by + oy, len, lean, w, col));
      }
    }
    // Sunlit tips catching the light.
    x.strokeStyle = hsl(70, 40, 86, 0.55);
    x.lineWidth = 0.8;
    for (let i = 0; i < 500; i++) {
      const tx = Math.random() * s;
      const ty = Math.random() * s;
      const dx = G.rand(-1.5, 1.5);
      wrapped(s, tx, ty, 4, (ox, oy) => {
        x.beginPath();
        x.moveTo(tx + ox, ty + oy);
        x.lineTo(tx + ox + dx, ty + oy - 3);
        x.stroke();
      });
    }
    grain(x, s, 6);
    return texture(c, 1, 1);
  }

  // The duelling ground: one flagstone slab group per 4 x 4 grid cell.
  function arenaFlags() {
    const { canvas, texture, grain } = G.texKit;
    const s = 256;
    const c = canvas(s);
    const x = c.getContext('2d');
    mortar(x, s, '#5f584c');
    const o = { hue: 36, sat: 12, light: 52, vary: 9, jitter: 3, moss: 0.35, round: 0.1 };
    stone(x, 4, 4, 124, 100, o);
    stone(x, 132, 4, 120, 140, o);
    stone(x, 4, 108, 124, 144, o);
    stone(x, 132, 148, 120, 104, o);
    grain(x, s, 6);
    return texture(c, 16, 16);
  }

  // Cream castle ashlar, also used for the kerb, pylons and tower.
  function castleStone() {
    const { canvas, texture, grain } = G.texKit;
    const s = 256;
    const c = canvas(s);
    const x = c.getContext('2d');
    mortar(x, s, '#8d8374');
    const o = { hue: 40, sat: 16, light: 72, vary: 6, jitter: 2, moss: 0.25 };
    const bh = s / 5;
    for (let r = 0; r < 5; r++) {
      const off = r % 2 ? s / 6 : 0;
      for (let b = -1; b < 3; b++) stone(x, b * (s / 3) + off + 2, r * bh + 2, s / 3 - 4, bh - 4, o);
    }
    grain(x, s, 5);
    return texture(c);
  }

  // Tileable value noise on a lattice of the given period.
  function latticeNoise(px, py, period, seed) {
    const h = (i, j) => {
      const v = Math.sin((((i % period) + period) % period) * 127.1 + (((j % period) + period) % period) * 311.7 + seed * 74.7) * 43758.5453;
      return v - Math.floor(v);
    };
    const xi = Math.floor(px);
    const yi = Math.floor(py);
    const xf = px - xi;
    const yf = py - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    return G.lerp(G.lerp(h(xi, yi), h(xi + 1, yi), u), G.lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
  }

  function fbm(px, py, s, base, octaves, seed) {
    let sum = 0;
    let amp = 0.5;
    let period = base;
    for (let o = 0; o < octaves; o++) {
      sum += amp * latticeNoise((px / s) * period, (py / s) * period, period, seed + o);
      amp *= 0.5;
      period *= 2;
    }
    return sum;
  }

  // Craggy rock, built per pixel: broad broken planes (each lit at its own
  // angle, softly creased where they meet), fine grain, branching veins,
  // horizontal strata and ochre staining, then painted cracks with a lit lip.
  function rock() {
    const { canvas, texture, grain } = G.texKit;
    const s = 256;
    const c = canvas(s);
    const x = c.getContext('2d');
    const cells = [];
    for (let i = 0; i < 14; i++) {
      cells.push({ x: Math.random() * s, y: Math.random() * s, lit: Math.random() });
    }
    const img = x.createImageData(s, s);
    const d = img.data;
    for (let py = 0; py < s; py++) {
      for (let px = 0; px < s; px++) {
        let f1 = 1e9;
        let f2 = 1e9;
        let lit = 0;
        for (const p of cells) {
          // Squashed vertically, so facets read as layered ledges.
          let dx = Math.abs(px - p.x);
          let dy = Math.abs(py - p.y);
          dx = Math.min(dx, s - dx);
          dy = Math.min(dy, s - dy) * 1.7;
          const dist = dx * dx + dy * dy;
          if (dist < f1) {
            f2 = f1;
            f1 = dist;
            lit = p.lit;
          } else if (dist < f2) {
            f2 = dist;
          }
        }
        const crease = G.clamp((Math.sqrt(f2) - Math.sqrt(f1)) / 6, 0, 1);
        const grainN = fbm(px, py, s, 8, 5, 3);
        // Strata: wavy horizontal bands of lighter and darker stone.
        const band = Math.sin((py / s) * Math.PI * 2 * 6 + fbm(px, py, s, 4, 3, 9) * 6);
        const stain = fbm(px, py, s, 3, 3, 21);
        // Veins: thin, branching dark cracks where ridged noise peaks.
        const vein = (1 - Math.abs(fbm(px, py, s, 5, 4, 33) * 2 - 1)) ** 12;
        let v = 0.42 + lit * 0.18 + (grainN - 0.5) * 0.6 + band * 0.07;
        v *= 0.86 + 0.14 * crease;
        v *= 1 - vein * 0.55;
        const i4 = (py * s + px) * 4;
        const warm = G.clamp((stain - 0.45) * 3, 0, 1);
        d[i4] = G.clamp(v * (205 + warm * 30), 0, 255);
        d[i4 + 1] = G.clamp(v * (198 + warm * 8), 0, 255);
        d[i4 + 2] = G.clamp(v * (190 - warm * 30), 0, 255);
        d[i4 + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    // Cracks: mostly running along the strata, with the odd vertical joint.
    for (let i = 0; i < 9; i++) {
      const across = Math.random() < 0.7;
      let cx = Math.random() * s;
      let cy = Math.random() * s;
      const pts = [[cx, cy]];
      const steps = 4 + Math.floor(Math.random() * 6);
      for (let k = 0; k < steps; k++) {
        cx += across ? G.rand(6, 14) : G.rand(-4, 4);
        cy += across ? G.rand(-3, 3) : G.rand(6, 12);
        pts.push([cx, cy]);
      }
      for (const [ox, oy, colour, w] of [[0, 1.2, 'rgba(255,240,215,0.25)', 1.4], [0, 0, 'rgba(25,18,12,0.6)', 1.3]]) {
        wrapped(s, pts[0][0], pts[0][1], 120, (wx, wy) => {
          x.strokeStyle = colour;
          x.lineWidth = w;
          x.beginPath();
          pts.forEach(([qx, qy], n) => (n ? x.lineTo(qx + wx + ox, qy + wy + oy) : x.moveTo(qx + wx + ox, qy + wy + oy)));
          x.stroke();
        });
      }
    }
    grain(x, s, 8);
    return texture(c);
  }

  function bark() {
    const { canvas, texture, grain } = G.texKit;
    const s = 128;
    const c = canvas(s);
    const x = c.getContext('2d');
    x.fillStyle = hsl(26, 32, 30);
    x.fillRect(0, 0, s, s);
    for (let i = 0; i < 60; i++) {
      const px = Math.random() * s;
      x.strokeStyle = Math.random() < 0.5 ? hsl(26, 30, 20, 0.6) : hsl(30, 25, 42, 0.45);
      x.lineWidth = G.rand(1, 3);
      x.beginPath();
      x.moveTo(px, 0);
      x.bezierCurveTo(px + G.rand(-4, 4), s / 3, px + G.rand(-4, 4), (s * 2) / 3, px, s);
      x.stroke();
    }
    grain(x, s, 10);
    return texture(c);
  }

  // Broadleaf canopy: clusters of painted leaves with sunlit tips.
  function leaves() {
    const { canvas, texture, grain } = G.texKit;
    const s = 256;
    const c = canvas(s);
    const x = c.getContext('2d');
    x.fillStyle = hsl(105, 38, 24);
    x.fillRect(0, 0, s, s);
    dabs(x, s, 40, 14, 34, () => hsl(110, 40, 16, 0.5));
    for (let i = 0; i < 700; i++) {
      const lx = Math.random() * s;
      const ly = Math.random() * s;
      const l = G.rand(26, 50);
      x.fillStyle = hsl(G.rand(85, 115), G.rand(35, 50), l, 0.75);
      x.beginPath();
      x.ellipse(lx, ly, G.rand(3, 6), G.rand(1.6, 3), Math.random() * Math.PI, 0, Math.PI * 2);
      x.fill();
    }
    grain(x, s, 8);
    return texture(c);
  }

  // Conifer boughs: drooping strokes of dark needles.
  function needles() {
    const { canvas, texture, grain } = G.texKit;
    const s = 128;
    const c = canvas(s);
    const x = c.getContext('2d');
    x.fillStyle = hsl(150, 30, 18);
    x.fillRect(0, 0, s, s);
    x.lineCap = 'round';
    for (let i = 0; i < 500; i++) {
      const px = Math.random() * s;
      const py = Math.random() * s;
      x.strokeStyle = hsl(G.rand(130, 155), G.rand(25, 40), G.rand(20, 40), 0.7);
      x.lineWidth = G.rand(1, 2);
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(px + G.rand(-5, 5), py + G.rand(4, 9));
      x.stroke();
    }
    grain(x, s, 8);
    return texture(c);
  }

  /* Knights ---------------------------------------------------------------- */

  // Near-white brushed steel; each material tints it to its own colour.
  function metal() {
    const { canvas, texture, grain } = G.texKit;
    const s = 128;
    const c = canvas(s);
    const x = c.getContext('2d');
    x.fillStyle = '#d9d9d9';
    x.fillRect(0, 0, s, s);
    dabs(x, s, 24, 10, 30, () => (Math.random() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(90,90,90,0.25)'));
    for (let i = 0; i < 80; i++) {
      const px = Math.random() * s;
      x.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(60,60,60,0.12)';
      x.lineWidth = 1;
      x.beginPath();
      x.moveTo(px, 0);
      x.lineTo(px + G.rand(-2, 2), s);
      x.stroke();
    }
    grain(x, s, 6);
    return texture(c);
  }

  // Interlocking rings of chainmail.
  function mail() {
    const { canvas, texture } = G.texKit;
    const s = 64;
    const c = canvas(s);
    const x = c.getContext('2d');
    x.fillStyle = '#3a3a3a';
    x.fillRect(0, 0, s, s);
    const step = 8;
    for (let r = 0; r <= s / step * 2; r++) {
      for (let k = -1; k <= s / step; k++) {
        const cx = k * step + (r % 2 ? step / 2 : 0);
        const cy = (r * step) / 2;
        x.strokeStyle = '#bdbdbd';
        x.lineWidth = 1.6;
        x.beginPath();
        x.arc(cx, cy, step * 0.42, 0, Math.PI * 2);
        x.stroke();
        x.strokeStyle = 'rgba(255,255,255,0.5)';
        x.lineWidth = 1;
        x.beginPath();
        x.arc(cx, cy, step * 0.42, Math.PI * 1.1, Math.PI * 1.6);
        x.stroke();
      }
    }
    return texture(c, 4, 3);
  }

  // Woven cloth with soft vertical folds. The ragged version has a torn,
  // see-through hem for capes and tabards (drawn with alphaTest).
  function cloth(ragged) {
    const { canvas, texture, grain } = G.texKit;
    const s = 128;
    const c = canvas(s);
    const x = c.getContext('2d');
    x.fillStyle = '#d6d6d6';
    x.fillRect(0, 0, s, s);
    for (let i = 0; i < 8; i++) {
      const px = (i + 0.5) * (s / 8) + G.rand(-3, 3);
      const g = x.createLinearGradient(px - 9, 0, px + 9, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.22)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(px - 9, 0, 18, s);
    }
    x.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = 0; y < s; y += 2) x.fillRect(0, y, s, 1);
    grain(x, s, 10);
    if (ragged) {
      x.globalCompositeOperation = 'destination-out';
      x.beginPath();
      x.moveTo(0, s);
      for (let px = 0; px <= s; px += 4) x.lineTo(px, s - G.rand(2, 16) - (px % 16 === 0 ? G.rand(0, 10) : 0));
      x.lineTo(s, s);
      x.closePath();
      x.fill();
      for (let i = 0; i < 6; i++) {
        x.beginPath();
        x.ellipse(Math.random() * s, s - G.rand(18, 34), G.rand(1.5, 4), G.rand(2, 5), 0, 0, Math.PI * 2);
        x.fill();
      }
      x.globalCompositeOperation = 'source-over';
    }
    const t = texture(c);
    if (ragged) t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  }

  // Painting helpers shared with castle-tex.js.
  G.paintKit = { hsl, dab, dabs, wrapped, fbm };

  G.paintTextures = function () {
    return {
      brick: wallStone(),
      flag: floorStone(),
      stairs: stairStone(),
      slate: roofSlate(),
      ground: groundDetail(),
      tile: arenaFlags(),
      castle: castleStone(),
      rock: rock(),
      bark: bark(),
      leaves: leaves(),
      needles: needles(),
      metal: metal(),
      mail: mail(),
      cloth: cloth(false),
      clothRag: cloth(true),
    };
  };
})();

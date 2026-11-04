/**
 * Spireclash castle textures: smooth stucco and fish-scale roof shingles
 * (each with a normal map, so the surface catches the light), leaded window
 * glass, a stained-glass rose window and a strapped oak gate.
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

  function colourTex(c, wrap) {
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 8;
    if (wrap !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  // Turn a greyscale height canvas into a tangent-space normal map. The
  // canvas runs downwards while texture v runs upwards, hence the sign flip.
  function normalFrom(hc, strength) {
    const s = hc.width;
    const src = hc.getContext('2d').getImageData(0, 0, s, s).data;
    const out = canvas(s);
    const ctx = out.getContext('2d');
    const img = ctx.createImageData(s, s);
    const d = img.data;
    const h = (x, y) => src[((((y % s) + s) % s) * s + (((x % s) + s) % s)) * 4] / 255;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const du = (h(x + 1, y) - h(x - 1, y)) * strength;
        const dv = (h(x, y - 1) - h(x, y + 1)) * strength;
        const len = Math.hypot(du, dv, 1);
        const i = (y * s + x) * 4;
        d[i] = (-du / len) * 127.5 + 127.5;
        d[i + 1] = (-dv / len) * 127.5 + 127.5;
        d[i + 2] = (1 / len) * 127.5 + 127.5;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(out);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  // Hand-floated stucco: soft warm whites, gentle trowel swirls in the
  // relief, faint rain streaks.
  function stucco() {
    const { hsl, dabs, wrapped, fbm } = G.paintKit;
    const s = 256;
    const c = canvas(s);
    const x = c.getContext('2d');
    x.fillStyle = hsl(40, 32, 90);
    x.fillRect(0, 0, s, s);
    dabs(x, s, 46, 20, 64, () => (Math.random() < 0.5 ? hsl(44, 40, 97, 0.35) : hsl(34, 22, 76, 0.2)));
    for (let i = 0; i < 26; i++) {
      const px = Math.random() * s;
      const g = x.createLinearGradient(0, 0, 0, s);
      g.addColorStop(0, hsl(35, 15, 68, 0));
      g.addColorStop(0.5, hsl(35, 15, 68, 0.09));
      g.addColorStop(1, hsl(35, 15, 68, 0));
      x.fillStyle = g;
      wrapped(s, px, 0, 6, (ox) => x.fillRect(px + ox - 1.5, 0, G.rand(1, 3), s));
    }
    const hc = canvas(s);
    const hx = hc.getContext('2d');
    const img = hx.createImageData(s, s);
    for (let py = 0; py < s; py++) {
      for (let px = 0; px < s; px++) {
        // Broad trowel waves plus fine sandy grit.
        const v = fbm(px, py, s, 6, 3, 5) * 0.7 + fbm(px, py, s, 48, 2, 11) * 0.3;
        const i = (py * s + px) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v * 255;
        img.data[i + 3] = 255;
      }
    }
    hx.putImageData(img, 0, 0);
    return { map: colourTex(c), normal: normalFrom(hc, 2.2) };
  }

  // Fish-scale shingles: each scale shaded and slightly varied in tone,
  // with a matching height map so the rounded tips stand proud.
  function scales() {
    const { hsl } = G.paintKit;
    const s = 256;
    const c = canvas(s);
    const x = c.getContext('2d');
    const hc = canvas(s);
    const hx = hc.getContext('2d');
    x.fillStyle = '#7d8494';
    x.fillRect(0, 0, s, s);
    hx.fillStyle = '#000';
    hx.fillRect(0, 0, s, s);
    const rows = 16;
    const rh = s / rows;
    const tw = s / 16;
    const outline = (ctx, cx, top) => {
      ctx.beginPath();
      ctx.moveTo(cx - tw / 2, top);
      ctx.lineTo(cx + tw / 2, top);
      ctx.lineTo(cx + tw / 2, top + rh * 0.8);
      ctx.arc(cx, top + rh * 0.8, tw / 2, 0, Math.PI);
      ctx.closePath();
    };
    // Lower rows first, so each row overlaps the tops of the one beneath.
    for (let r = rows; r >= -1; r--) {
      const off = r % 2 ? tw / 2 : 0;
      for (let b = -1; b <= 16; b++) {
        const cx = b * tw + off + tw / 2;
        const top = r * rh;
        const l = 76 + G.rand(-9, 9);
        const g = x.createLinearGradient(0, top, 0, top + rh * 1.6);
        g.addColorStop(0, hsl(220, 10, l - 22));
        g.addColorStop(0.65, hsl(220, 10, l + 6));
        g.addColorStop(0.9, hsl(220, 10, l + 14));
        g.addColorStop(1, hsl(220, 10, l - 25));
        x.fillStyle = g;
        outline(x, cx, top);
        x.fill();
        const hg = hx.createRadialGradient(cx, top + rh * 0.9, 1, cx, top + rh * 0.6, tw * 0.75);
        hg.addColorStop(0, '#fff');
        hg.addColorStop(1, '#333');
        hx.fillStyle = hg;
        outline(hx, cx, top);
        hx.fill();
      }
    }
    return { map: colourTex(c), normal: normalFrom(hc, 3) };
  }

  // Leaded glass for an arched window, mapped across the whole pane: deep
  // blue panes with a sky reflection, diamond leading and a stone mullion.
  function leadedGlass() {
    const w = 128;
    const h = 256;
    const c = canvas(w, h);
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#6f8fc4');
    g.addColorStop(0.35, '#23365f');
    g.addColorStop(0.6, '#1a2748');
    g.addColorStop(1, '#2e4672');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    // A few panes catch the light more than others.
    for (let i = 0; i < 10; i++) {
      x.fillStyle = `rgba(190,215,255,${G.rand(0.04, 0.14)})`;
      x.fillRect(G.rand(0, w - 20), G.rand(0, h - 30), 20, 30);
    }
    x.strokeStyle = 'rgba(40,40,46,0.9)';
    x.lineWidth = 2;
    for (let k = -h; k < w + h; k += 20) {
      x.beginPath();
      x.moveTo(k, 0);
      x.lineTo(k + h * 0.6, h);
      x.moveTo(k + h * 0.6, 0);
      x.lineTo(k, h);
      x.stroke();
    }
    x.fillStyle = '#e8e0cf';
    x.fillRect(w / 2 - 5, 0, 10, h);
    x.fillRect(0, h * 0.42, w, 8);
    return colourTex(c, false);
  }

  // Stained-glass rose: rings of coloured petals between dark leading.
  function stainedGlass() {
    const s = 256;
    const c = canvas(s);
    const x = c.getContext('2d');
    const cx = s / 2;
    x.fillStyle = '#1a1a22';
    x.fillRect(0, 0, s, s);
    const rings = [
      { r0: 18, r1: 52, n: 8, cols: ['#d8343c', '#f2b632'] },
      { r0: 56, r1: 92, n: 12, cols: ['#2f5fd0', '#3aa35a', '#8a3cc8'] },
      { r0: 96, r1: 124, n: 16, cols: ['#f2b632', '#d8343c', '#2f5fd0'] },
    ];
    for (const ring of rings) {
      for (let k = 0; k < ring.n; k++) {
        const a0 = (k / ring.n) * Math.PI * 2 + 0.03;
        const a1 = ((k + 1) / ring.n) * Math.PI * 2 - 0.03;
        x.fillStyle = ring.cols[k % ring.cols.length];
        x.beginPath();
        x.arc(cx, cx, ring.r1, a0, a1);
        x.arc(cx, cx, ring.r0, a1, a0, true);
        x.closePath();
        x.fill();
        // A paler sheen in the middle of each petal.
        x.fillStyle = 'rgba(255,255,255,0.18)';
        x.beginPath();
        x.arc(cx, cx, (ring.r0 + ring.r1) / 2 + 4, a0 + 0.06, a1 - 0.06);
        x.arc(cx, cx, (ring.r0 + ring.r1) / 2 - 4, a1 - 0.06, a0 + 0.06, true);
        x.closePath();
        x.fill();
      }
    }
    x.fillStyle = '#f2d36b';
    x.beginPath();
    x.arc(cx, cx, 14, 0, Math.PI * 2);
    x.fill();
    return colourTex(c, false);
  }

  // Oak planks with grain, two black iron straps with rivets and a ring.
  function oakDoor() {
    const { hsl } = G.paintKit;
    const w = 128;
    const h = 256;
    const c = canvas(w, h);
    const x = c.getContext('2d');
    const planks = 6;
    const pw = w / planks;
    for (let p = 0; p < planks; p++) {
      x.fillStyle = hsl(26 + G.rand(-3, 3), 42, 24 + G.rand(-3, 3));
      x.fillRect(p * pw, 0, pw, h);
      for (let k = 0; k < 14; k++) {
        const gx = p * pw + G.rand(2, pw - 2);
        x.strokeStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(255,220,170,0.08)';
        x.lineWidth = 1;
        x.beginPath();
        x.moveTo(gx, 0);
        x.bezierCurveTo(gx + G.rand(-3, 3), h / 3, gx + G.rand(-3, 3), (h * 2) / 3, gx, h);
        x.stroke();
      }
      x.fillStyle = 'rgba(0,0,0,0.45)';
      x.fillRect(p * pw, 0, 1.5, h);
    }
    for (const y of [h * 0.28, h * 0.72]) {
      x.fillStyle = '#26262a';
      x.fillRect(0, y - 6, w, 12);
      x.fillStyle = 'rgba(255,255,255,0.15)';
      x.fillRect(0, y - 6, w, 2);
      x.fillStyle = '#4a4a50';
      for (let k = 6; k < w; k += 14) {
        x.beginPath();
        x.arc(k, y, 2, 0, Math.PI * 2);
        x.fill();
      }
    }
    x.strokeStyle = '#2c2c30';
    x.lineWidth = 3;
    x.beginPath();
    x.arc(w * 0.62, h * 0.52, 7, 0, Math.PI * 2);
    x.stroke();
    return colourTex(c, false);
  }

  // Heraldic banner: crimson cloth with soft folds, a gold border and a
  // crown, ending in a swallowtail (cut away, drawn with alphaTest).
  function banner() {
    const w = 128;
    const h = 256;
    const c = canvas(w, h);
    const x = c.getContext('2d');
    x.fillStyle = '#a3192b';
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 5; i++) {
      const px = (i + 0.5) * (w / 5);
      const g = x.createLinearGradient(px - 12, 0, px + 12, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.25)');
      g.addColorStop(1, 'rgba(255,255,255,0.06)');
      x.fillStyle = g;
      x.fillRect(px - 12, 0, 24, h);
    }
    // Swallowtail hem.
    const tail = (ctx) => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w, 0);
      ctx.lineTo(w, h);
      ctx.lineTo(w / 2, h * 0.84);
      ctx.lineTo(0, h);
      ctx.closePath();
    };
    x.strokeStyle = '#e8bd52';
    x.lineWidth = 8;
    tail(x);
    x.stroke();
    // A crown: band, three points with jewels.
    x.fillStyle = '#e8bd52';
    const cx = w / 2;
    const cy = h * 0.4;
    x.fillRect(cx - 30, cy + 10, 60, 14);
    x.beginPath();
    x.moveTo(cx - 30, cy + 10);
    x.lineTo(cx - 30, cy - 18);
    x.lineTo(cx - 15, cy - 2);
    x.lineTo(cx, cy - 26);
    x.lineTo(cx + 15, cy - 2);
    x.lineTo(cx + 30, cy - 18);
    x.lineTo(cx + 30, cy + 10);
    x.closePath();
    x.fill();
    x.fillStyle = '#3a7bdc';
    for (const [jx, jy] of [[cx - 30, cy - 20], [cx, cy - 28], [cx + 30, cy - 20], [cx, cy + 17]]) {
      x.beginPath();
      x.arc(jx, jy, 4, 0, Math.PI * 2);
      x.fill();
    }
    x.globalCompositeOperation = 'destination-in';
    tail(x);
    x.fill();
    x.globalCompositeOperation = 'source-over';
    return colourTex(c, false);
  }

  G.castleTextures = function () {
    return {
      stucco: stucco(),
      scales: scales(),
      glass: leadedGlass(),
      rose: stainedGlass(),
      door: oakDoor(),
      banner: banner(),
    };
  };
})();

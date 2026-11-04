/**
 * Spireclash core: shared constants, maths helpers, rune textures and
 * synthesised sound. Everything hangs off the global G namespace so the game
 * runs straight from file:// without a bundler or a local server.
 */
(function () {
  'use strict';
  const G = (window.G = window.G || {});

  // Grid. One cell is 4 x 4 units, one storey is 4 units tall.
  G.CELL = 4;
  G.LEVEL_H = 4;
  G.GRID_MIN = -8;
  G.GRID_MAX = 7;
  G.ARENA = 32;
  G.MAX_LEVEL = 12;
  G.STEP = 0.6;
  G.DIRS = [
    { x: 1, z: 0 },
    { x: 0, z: 1 },
    { x: -1, z: 0 },
    { x: 0, z: -1 },
  ];
  G.now = 0;

  G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.rand = (a, b) => a + Math.random() * (b - a);
  G.moveTowards = (v, target, maxDelta) => {
    if (Math.abs(target - v) <= maxDelta) return target;
    return v + Math.sign(target - v) * maxDelta;
  };
  G.angleDiff = (from, to) => {
    let d = (to - from) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  // Yaw 0 looks down -z, matching the three.js camera.
  G.forwardFromYaw = (yaw) => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });
  G.yawFromDir = (x, z) => Math.atan2(-x, -z);
  G.dirFromYawPitch = (yaw, pitch, out) => {
    const cp = Math.cos(pitch);
    return (out || new THREE.Vector3()).set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
  };
  G.cardinal = (x, z) => (Math.abs(x) > Math.abs(z) ? (x > 0 ? 0 : 2) : z > 0 ? 1 : 3);

  /* ---------------------------------------------------------------------- */
  /* Rounded boxes                                                           */
  /* ---------------------------------------------------------------------- */

  // BoxGeometry face layout: [u axis, v axis, u sign, v sign], in build order.
  const BOX_FACES = [
    ['z', 'y', -1, -1],
    ['z', 'y', 1, -1],
    ['x', 'z', 1, 1],
    ['x', 'z', 1, -1],
    ['x', 'y', 1, -1],
    ['x', 'y', -1, -1],
  ];
  const roundCache = new Map();

  // A box with softly rounded edges and corners. m is the number of segments
  // around each rounded edge. Geometry is cached, so share it, never dispose.
  G.roundedBox = function (w, h, d, radius, m) {
    const segs = m || 3;
    const r = Math.max(0.001, Math.min(radius, w / 2, h / 2, d / 2) * 0.999);
    const key = `${w},${h},${d},${r},${segs}`;
    if (roundCache.has(key)) return roundCache.get(key);
    const n = segs * 2 + 1;
    const geo = new THREE.BoxGeometry(w, h, d, n, n, n);
    const size = { x: w, y: h, z: d };
    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;
    const uv = geo.attributes.uv;
    // Squeeze the grid so the outer segments sit on the curve, spaced by
    // equal angles, and one wide segment spans the flat middle.
    const remap = (v, s) => {
      const k = Math.round((v / s + 0.5) * n);
      if (k <= segs) return -s / 2 + r - r * Math.tan((1 - k / segs) * (Math.PI / 4));
      return s / 2 - r + r * Math.tan((1 - (n - k) / segs) * (Math.PI / 4));
    };
    const perFace = (n + 1) * (n + 1);
    const p = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < pos.count; i++) {
      p.x = remap(pos.getX(i), w);
      p.y = remap(pos.getY(i), h);
      p.z = remap(pos.getZ(i), d);
      const [ua, va, us, vs] = BOX_FACES[Math.floor(i / perFace)];
      uv.setXY(i, (p[ua] * us) / size[ua] + 0.5, 0.5 - (p[va] * vs) / size[va]);
      const ix = G.clamp(p.x, -w / 2 + r, w / 2 - r);
      const iy = G.clamp(p.y, -h / 2 + r, h / 2 - r);
      const iz = G.clamp(p.z, -d / 2 + r, d / 2 - r);
      let dx = p.x - ix;
      let dy = p.y - iy;
      let dz = p.z - iz;
      const len = Math.hypot(dx, dy, dz) || 1;
      dx /= len;
      dy /= len;
      dz /= len;
      pos.setXYZ(i, ix + dx * r, iy + dy * r, iz + dz * r);
      nor.setXYZ(i, dx, dy, dz);
    }
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    roundCache.set(key, geo);
    return geo;
  };

  /* ---------------------------------------------------------------------- */
  /* Procedural textures                                                     */
  /* ---------------------------------------------------------------------- */

  function canvas(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
  }

  function texture(c, rx, ry, colour) {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx || 1, ry || 1);
    t.anisotropy = 8;
    if (colour !== false) t.encoding = THREE.sRGBEncoding;
    return t;
  }

  function grain(ctx, size, amount) {
    const img = ctx.getImageData(0, 0, size, size);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * amount;
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
  }

  function glyph(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    const strokes = 2 + Math.floor(Math.random() * 3);
    for (let s = 0; s < strokes; s++) {
      const y = cy + G.rand(-r, r);
      const side = Math.random() < 0.5 ? -1 : 1;
      ctx.moveTo(cx, y);
      ctx.lineTo(cx + side * r * G.rand(0.4, 0.8), y + G.rand(-r, r) * 0.6);
    }
    if (Math.random() < 0.5) {
      ctx.moveTo(cx + r * 0.6, cy - r * 0.2);
      ctx.arc(cx, cy - r * 0.2, r * 0.6, 0, Math.PI * 2);
    }
    ctx.stroke();
  }

  // Emissive map for conjured pieces: a glowing border plus a few runes.
  function runes() {
    const s = 256;
    const c = canvas(s);
    const x = c.getContext('2d');
    x.fillStyle = '#000';
    x.fillRect(0, 0, s, s);
    x.shadowColor = '#fff';
    x.shadowBlur = 10;
    x.strokeStyle = 'rgba(255,255,255,0.9)';
    x.lineWidth = 3;
    x.strokeRect(6, 6, s - 12, s - 12);
    x.lineWidth = 3;
    x.strokeStyle = 'rgba(255,255,255,0.75)';
    const spots = [
      [64, 70],
      [190, 64],
      [70, 190],
      [186, 186],
      [128, 128],
    ];
    for (const [cx, cy] of spots) {
      if (Math.random() < 0.8) glyph(x, cx, cy, 14);
    }
    return texture(c, 1, 1, false);
  }

  function barrier() {
    const s = 256;
    const c = canvas(s);
    const x = c.getContext('2d');
    x.clearRect(0, 0, s, s);
    x.shadowColor = '#fff';
    x.shadowBlur = 8;
    x.strokeStyle = 'rgba(255,255,255,0.8)';
    x.lineWidth = 2.5;
    for (let r = 0; r < 4; r++) {
      for (let k = 0; k < 4; k++) {
        if (Math.random() < 0.35) glyph(x, 32 + k * 64, 32 + r * 64, 10);
      }
    }
    x.strokeStyle = 'rgba(255,255,255,0.35)';
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(0, 1);
    x.lineTo(s, 1);
    x.stroke();
    return texture(c, 4, 3, false);
  }

  // Shared canvas helpers for paint.js, which draws the painted textures.
  G.texKit = { canvas, texture, grain, glyph };

  G.makeTextures = function () {
    G.tex = Object.assign({ runes: runes(), barrier: barrier() }, G.paintTextures(), G.armourTextures());
  };

  /* ---------------------------------------------------------------------- */
  /* Sound: tiny WebAudio synth, no audio files needed                       */
  /* ---------------------------------------------------------------------- */

  const Sound = {
    ctx: null,
    master: null,
    volume: 0.7,
    noiseBuf: null,
    last: {},

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    },

    setVolume(v) {
      this.volume = v;
      if (this.master) this.master.gain.value = v;
    },

    tone(f0, f1, dur, type, vol, delay) {
      const c = this.ctx;
      const t = c.currentTime + (delay || 0);
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    },

    noise(dur, vol, freq, ftype, delay) {
      const c = this.ctx;
      const t = c.currentTime + (delay || 0);
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = c.createBiquadFilter();
      f.type = ftype || 'lowpass';
      f.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start(t, Math.random() * 0.5);
      src.stop(t + dur + 0.02);
    },

    play(name, pos) {
      if (!this.ctx || this.volume <= 0) return;
      const nowT = this.ctx.currentTime;
      if (this.last[name] !== undefined && nowT - this.last[name] < 0.035) return;
      this.last[name] = nowT;
      let v = 1;
      if (pos && G.listener) {
        const d = Math.hypot(pos.x - G.listener.x, pos.y - G.listener.y, pos.z - G.listener.z);
        v = 1 / (1 + d * 0.06);
      }
      if (v < 0.03) return;
      switch (name) {
        case 'bow':
          this.noise(0.09, 0.35 * v, 2500, 'highpass');
          this.tone(1100, 260, 0.12, 'triangle', 0.22 * v);
          break;
        case 'scatter':
          this.noise(0.32, 0.7 * v, 900, 'lowpass');
          this.tone(140, 45, 0.28, 'sine', 0.55 * v);
          break;
        case 'build':
          this.tone(200, 90, 0.11, 'square', 0.08 * v);
          this.noise(0.06, 0.18 * v, 700, 'lowpass');
          break;
        case 'hit':
          this.tone(1500, 1500, 0.05, 'square', 0.1);
          break;
        case 'head':
          this.tone(1900, 1900, 0.1, 'sine', 0.25);
          this.tone(2700, 2700, 0.12, 'sine', 0.15, 0.03);
          break;
        case 'ward':
          this.tone(900, 1300, 0.08, 'sine', 0.14);
          break;
        case 'break':
          this.noise(0.4, 0.4 * v, 450, 'bandpass');
          this.tone(110, 50, 0.3, 'sawtooth', 0.08 * v);
          break;
        case 'hurt':
          this.tone(240, 110, 0.16, 'sawtooth', 0.14);
          break;
        case 'heal':
          this.tone(520, 1040, 0.35, 'sine', 0.14 * v);
          this.tone(780, 1560, 0.35, 'sine', 0.08 * v, 0.08);
          break;
        case 'drink':
          this.tone(300, 600, 0.2, 'sine', 0.08 * v);
          break;
        case 'reload':
          this.noise(0.05, 0.2 * v, 3000, 'highpass');
          this.tone(420, 420, 0.04, 'square', 0.05 * v, 0.06);
          break;
        case 'phase':
          this.tone(380, 1500, 0.32, 'sine', 0.16 * v);
          this.tone(570, 2200, 0.28, 'triangle', 0.07 * v, 0.04);
          break;
        case 'unphase':
          this.tone(1300, 330, 0.18, 'sine', 0.13 * v);
          this.noise(0.06, 0.12 * v, 900, 'lowpass');
          break;
        case 'land':
          this.noise(0.12, 0.25 * v, 300, 'lowpass');
          break;
        case 'beep':
          this.tone(620, 620, 0.12, 'sine', 0.2);
          break;
        case 'go':
          this.tone(880, 880, 0.3, 'triangle', 0.25);
          this.tone(1320, 1320, 0.3, 'triangle', 0.15, 0.05);
          break;
        case 'win':
          [523, 659, 784, 1046].forEach((f, i) => this.tone(f, f, 0.35, 'triangle', 0.2, i * 0.12));
          break;
        case 'lose':
          [392, 330, 262].forEach((f, i) => this.tone(f, f * 0.98, 0.4, 'sine', 0.2, i * 0.16));
          break;
        default:
          break;
      }
    },
  };

  G.sound = Sound;
})();

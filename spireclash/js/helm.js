/**
 * Spireclash helms. The great helm is a rounded barrel with a domed crown:
 * a curved face plate with a real eye slit and punched breaths cut through
 * it (dark inside, eyes glowing behind the slit), gilded bands at the rim
 * and brow, a gilded frame and a raised cross ending in an arrowhead.
 * The squire wears an open kettle hat instead.
 */
(function () {
  'use strict';
  const G = window.G;
  const { part, taper, glowPatch } = G.armour;

  // Helm heights (head space): the rim, where the face plate meets the
  // crown, and the top of the dome.
  const BASE = -0.02;
  const BROW = 0.27;
  const TOP = 0.385;
  // Half the face plate's width, in radians either side of the front.
  const FACE_HALF = 0.85;
  const AROUND = 40;
  // Openings, as fractions of the face texture (u across, v up).
  const SLIT_V = 0.66;
  const W = 256;
  const H = 256;

  // Radius at height y: a gentle barrel up to the brow, then a round dome.
  function radius(y) {
    if (y <= BROW) return 0.166 + 0.012 * Math.sin((Math.PI * (y - BASE)) / (BROW - BASE + 0.06));
    const q = Math.min(1, (y - BROW) / (TOP - BROW));
    return radius(BROW) * Math.sqrt(1 - q * q);
  }

  function profile(y0, y1, n, scale) {
    const pts = [];
    for (let i = 0; i <= n; i += 1) {
      const y = y0 + ((y1 - y0) * i) / n;
      pts.push(new THREE.Vector2(radius(y) * (scale || 1), y));
    }
    return pts;
  }

  // The holes in the face plate, in canvas pixels.
  function openings() {
    const slit = { x0: W * 0.13, x1: W * 0.87, y: H * (1 - SLIT_V), h: 15 };
    const breaths = [];
    for (const side of [-1, 1]) {
      for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          breaths.push([W / 2 + side * (30 + col * 19 + (row % 2) * 6), H * 0.47 + row * 20]);
        }
      }
    }
    return { slit, breaths, r: 5 };
  }

  function slitPath(g, s, grow) {
    const h = s.h + grow * 2;
    g.beginPath();
    g.moveTo(s.x0 + h / 2 - grow, s.y - h / 2);
    g.lineTo(s.x1 - h / 2 + grow, s.y - h / 2);
    g.arc(s.x1 - h / 2 + grow, s.y, h / 2, -Math.PI / 2, Math.PI / 2);
    g.lineTo(s.x0 + h / 2 - grow, s.y + h / 2);
    g.arc(s.x0 + h / 2 - grow, s.y, h / 2, Math.PI / 2, Math.PI * 1.5);
  }

  function rivets(g, fill, shade) {
    const spots = [];
    for (let i = 0; i < 6; i += 1) spots.push([10, 18 + i * 42], [W - 10, 18 + i * 42]);
    for (const [x, y] of spots) {
      g.fillStyle = shade;
      g.beginPath();
      g.arc(x + 1.5, y + 1.5, 5, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = fill;
      g.beginPath();
      g.arc(x, y, 4.5, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Raised and sunken detail for the face plate's normal map: the edges of
  // every opening are pressed in, rivets stand proud.
  function faceHeight(o) {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#808080';
    g.fillRect(0, 0, W, H);
    g.drawImage(G.tex.steelHeight, 0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    slitPath(g, o.slit, 3);
    g.fill();
    for (const [x, y] of o.breaths) {
      g.beginPath();
      g.arc(x, y, o.r + 3, 0, Math.PI * 2);
      g.fill();
    }
    rivets(g, '#ffffff', 'rgba(0,0,0,0)');
    return c;
  }

  // The face plate's colour: the palette's steel, worn, sooted round the
  // breaths with streaks running down, every opening lit along its lower
  // lip and shadowed along its upper one. Openings are cut to transparent.
  const faceCache = {};
  function faceTextures(pal) {
    if (faceCache[pal.key]) return faceCache[pal.key];
    const o = openings();
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    // Painted neutral and tinted by the material, exactly like the shell.
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'multiply';
    g.drawImage(G.tex.steel.image, 0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    // Soot round the openings, and streaks where breath and rain ran down.
    const soot = (x, y, r, a) => {
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(12,10,8,${a})`);
      grad.addColorStop(1, 'rgba(12,10,8,0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    };
    for (let x = o.slit.x0; x <= o.slit.x1; x += 12) soot(x, o.slit.y, 16, 0.1);
    for (const [x, y] of o.breaths) {
      soot(x, y, 12, 0.16);
      const len = G.rand(14, 40);
      const streak = g.createLinearGradient(0, y, 0, y + len);
      streak.addColorStop(0, 'rgba(20,16,12,0.2)');
      streak.addColorStop(1, 'rgba(20,16,12,0)');
      g.fillStyle = streak;
      g.fillRect(x - 2, y, G.rand(2, 4), len);
    }
    const shade = g.createLinearGradient(0, 0, 0, H);
    shade.addColorStop(0, 'rgba(255,255,255,0.1)');
    shade.addColorStop(0.6, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(10,8,6,0.18)');
    g.fillStyle = shade;
    g.fillRect(0, 0, W, H);
    // Bevelled lips: shadow above each opening, a bright edge below it.
    g.lineWidth = 2.5;
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.beginPath();
    g.moveTo(o.slit.x0 + 6, o.slit.y + o.slit.h / 2 + 2);
    g.lineTo(o.slit.x1 - 6, o.slit.y + o.slit.h / 2 + 2);
    g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.beginPath();
    g.moveTo(o.slit.x0 + 6, o.slit.y - o.slit.h / 2 - 2);
    g.lineTo(o.slit.x1 - 6, o.slit.y - o.slit.h / 2 - 2);
    g.stroke();
    g.lineWidth = 2;
    for (const [x, y] of o.breaths) {
      g.strokeStyle = 'rgba(255,255,255,0.5)';
      g.beginPath();
      g.arc(x, y, o.r + 1.5, 0.15 * Math.PI, 0.85 * Math.PI);
      g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.45)';
      g.beginPath();
      g.arc(x, y, o.r + 1.5, 1.15 * Math.PI, 1.85 * Math.PI);
      g.stroke();
    }
    rivets(g, 'rgba(235,235,235,0.75)', 'rgba(0,0,0,0.45)');
    // Cut the openings right through.
    g.globalCompositeOperation = 'destination-out';
    slitPath(g, o.slit, 0);
    g.fill();
    for (const [x, y] of o.breaths) {
      g.beginPath();
      g.arc(x, y, o.r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    const map = new THREE.CanvasTexture(c);
    map.encoding = THREE.sRGBEncoding;
    map.anisotropy = 8;
    const normal = new THREE.CanvasTexture(G.heightToNormal(faceHeight(o), 3, 1, false));
    faceCache[pal.key] = { map, normal };
    return faceCache[pal.key];
  }

  // Soft radial glow: white-hot centre fading to nothing.
  let glowTex = null;
  function eyeGlow() {
    if (glowTex) return glowTex;
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 32;
    const g = c.getContext('2d');
    g.translate(32, 16);
    g.scale(2, 1);
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.3)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(-16, -16, 32, 32);
    glowTex = new THREE.CanvasTexture(c);
    return glowTex;
  }

  // A thin gilded tube along a list of [x, y, z] points.
  function gildedLine(M, pts, r, sides, parent) {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    return part(new THREE.TubeGeometry(curve, pts.length * 3, r, sides, false), M.trimSmooth, 0, 0, 0, parent);
  }

  // A gilded ring hugging the helm at height y.
  function ring(M, y, h, parent) {
    const r = radius(Math.min(y, BROW));
    const t = 0.011;
    const pts = [[r - 0.003, -h / 2], [r + t, -h / 2], [r + t, h / 2], [r - 0.003, h / 2]];
    return part(new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), AROUND), M.trimSmooth, 0, y, 0, parent);
  }

  function buildGreatHelm(M, pal, head) {
    // Dark inside, seen through the slit and breaths.
    const inside = new THREE.MeshBasicMaterial({ color: 0x050505, side: THREE.DoubleSide });
    part(new THREE.LatheGeometry(profile(BASE, TOP, 16, 0.93), 24), inside, 0, 0, 0, head).castShadow = false;
    // Crown and the back and sides of the barrel.
    const crown = profile(BROW, TOP, 12);
    crown[crown.length - 1].x = 0;
    part(new THREE.LatheGeometry(crown, AROUND), M.armourSmooth, 0, 0, 0, head);
    const back = new THREE.LatheGeometry(profile(BASE, BROW, 14), AROUND, Math.PI + FACE_HALF, Math.PI * 2 - FACE_HALF * 2);
    part(back, M.armourSmooth, 0, 0, 0, head);
    // The curved face plate with its openings cut through.
    const tex = faceTextures(pal);
    const faceMat = new THREE.MeshStandardMaterial({
      color: pal.armour,
      map: tex.map,
      normalMap: tex.normal,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      envMap: G.armourEnv || null,
      envMapIntensity: 0.9,
      metalness: 0.68,
      roughness: 0.42,
    });
    const face = new THREE.LatheGeometry(profile(BASE, BROW, 14), 18, Math.PI - FACE_HALF, FACE_HALF * 2);
    part(face, faceMat, 0, 0, 0, head);
    // Gilded rim and brow bands, a frame down each edge of the face, and
    // the raised cross running up over the crown to an arrowhead.
    ring(M, BASE + 0.012, 0.03, head);
    ring(M, BROW, 0.024, head);
    for (const s of [-1, 1]) {
      const a = Math.PI + s * FACE_HALF;
      const pts = [];
      for (let i = 0; i <= 6; i += 1) {
        const y = BASE + ((BROW - BASE) * i) / 6;
        const r = radius(y) + 0.004;
        pts.push([Math.sin(a) * r, y, Math.cos(a) * r]);
      }
      gildedLine(M, pts, 0.01, 6, head);
    }
    const cross = [];
    for (let i = 0; i <= 10; i += 1) {
      const y = BASE + 0.01 + ((0.35 - BASE - 0.01) * i) / 10;
      cross.push([0, y, -(radius(y) + 0.006)]);
    }
    gildedLine(M, cross, 0.017, 4, head).scale.x = 1.3;
    const tipGeo = new THREE.ConeGeometry(0.048, 0.09, 4);
    tipGeo.rotateY(Math.PI / 4);
    tipGeo.scale(1, 1, 0.4);
    const tip = part(tipGeo, M.trimSmooth, 0, 0.36, -(radius(0.36) + 0.012), head);
    tip.rotation.x = 0.75;
    // Steel rivets studding the rim band.
    const rivet = new THREE.SphereGeometry(0.008, 8, 6);
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2 + Math.PI / 16;
      const r = radius(BASE) + 0.013;
      part(rivet, M.plate, Math.sin(a) * r, BASE + 0.012, Math.cos(a) * r, head);
    }
    // Eyes glowing in the dark behind the slit: a hot core fading out, so
    // the slit's edges crop a soft spill of light rather than a flat patch.
    const slitY = BASE + SLIT_V * (BROW - BASE);
    const eyeMat = new THREE.MeshBasicMaterial({
      color: pal.glow,
      map: eyeGlow(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const eyes = pal.bothEyes ? [-1, 1] : [-1];
    for (const s of eyes) {
      const z = -(radius(slitY) - 0.007);
      const eye = part(new THREE.PlaneGeometry(0.075, 0.04), eyeMat, s * 0.055, slitY, z, head);
      eye.rotation.y = Math.PI + Math.atan2(s * 0.055, -z);
      eye.castShadow = false;
      eye.renderOrder = 1;
    }
  }

  function buildKettle(M, head) {
    // Open kettle hat over a mail coif, the face lost in shadow.
    part(new THREE.SphereGeometry(0.15, 10, 8), M.mail, 0, 0.1, 0, head).scale.set(1, 1.12, 1);
    part(new THREE.SphereGeometry(0.115, 10, 8), new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 1 }), 0, 0.1, -0.05, head);
    for (const s of [-1, 1]) glowPatch(M, 0.035, 0.02, s * 0.045, 0.13, -0.162, head);
    part(new THREE.CylinderGeometry(0.17, 0.28, 0.05, 10), M.armour, 0, 0.24, 0, head);
    const dome = new THREE.SphereGeometry(0.165, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    part(dome, M.armour, 0, 0.25, 0, head).scale.set(1, 0.9, 1);
    part(new THREE.TorusGeometry(0.28, 0.012, 4, 10), M.trim, 0, 0.217, 0, head).rotation.x = Math.PI / 2;
    const ridge = part(new THREE.TorusGeometry(0.165, 0.014, 4, 10, Math.PI), M.trim, 0, 0.25, 0, head);
    ridge.rotation.y = Math.PI / 2;
    ridge.scale.y = 0.9;
  }

  function buildHorns(M, head) {
    for (const side of [-1, 1]) {
      let joint = new THREE.Group();
      joint.position.set(side * 0.15, 0.26, 0);
      joint.rotation.z = side * -1.0;
      head.add(joint);
      let r = 0.055;
      // Each segment narrows and bends a little further upwards.
      for (let k = 0; k < 4; k += 1) {
        part(taper(r * 0.75, r, 0.13, 8), M.trim, 0, 0.065, 0, joint);
        const next = new THREE.Group();
        next.position.y = 0.13;
        next.rotation.z = side * 0.35;
        joint.add(next);
        joint = next;
        r *= 0.75;
      }
      part(new THREE.ConeGeometry(r, 0.12, 8), M.trim, 0, 0.06, 0, joint);
    }
    part(new THREE.ConeGeometry(0.04, 0.22, 6), M.glow, 0, 0.46, -0.05, head);
  }

  G.buildHelm = function (M, pal, root) {
    const head = new THREE.Group();
    head.position.y = 1.55;
    root.add(head);
    if (pal.helm === 'kettle') {
      buildKettle(M, head);
      return head;
    }
    buildGreatHelm(M, pal, head);
    if (pal.plume) {
      const pm = new THREE.MeshStandardMaterial({ color: pal.plume, map: G.tex.cloth, roughness: 0.9, flatShading: true });
      for (let i = 0; i < 6; i += 1) {
        const t = i / 5;
        const b = part(new THREE.SphereGeometry(0.05, 8, 6), pm, 0, 0.42 + Math.sin(t * Math.PI) * 0.08 - t * 0.12, -0.06 + t * 0.32, head);
        b.scale.set(0.7, 1.1 - t * 0.3, 1.5);
      }
    }
    if (pal.horns) buildHorns(M, head);
    return head;
  };
})();

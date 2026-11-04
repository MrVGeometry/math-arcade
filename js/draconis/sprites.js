// Pixel art for Deus Draconis. Each sprite is a grid of palette characters;
// "." is transparent.
export const art = {
  cloud: [
    ".....wwww.......",
    "...wwwwwwww.ww..",
    "..wwwwwwwwwwwww.",
    ".wwwwwwwwwwwwwww",
    "wwwwwwwwwwwwwwww",
    ".ssssssssssssss.",
  ],
  dragon: [
    ".......dd.......",
    "......drrd......",
    "......ryyr......",
    ".......rr.......",
    "..w....rr....w..",
    ".ww...roor...ww.",
    "www..rroorr..www",
    "wwwwrrroorrrwwww",
    ".wwwwrroorrwwww.",
    "..ww.rroorr.ww..",
    "......roor......",
    ".......rr.......",
    ".......rr.......",
    "......d..d......",
  ],
  fireball: [
    "..rr..",
    ".royr.",
    "royyor",
    "ryyyyr",
    ".ryyr.",
    "..rr..",
  ],
  monster: [
    ".g..........g.",
    ".gg........gg.",
    "..pppppppppp..",
    ".pppppppppppp.",
    "ppwkwppppwkwpp",
    "pppwppppppwppp",
    "pppppppppppppp",
    "ppkkkkkkkkkkpp",
    "ppkwkwkwkwkwpp",
    "pppppppppppppp",
    ".pp.pp..pp.pp.",
    ".p..p....p..p.",
  ],
  slime: [
    ".gg.",
    "glgg",
    "gggg",
    ".gd.",
  ],
};

const palettes = {
  cloud: { s: "#d6e6f5", w: "#ffffff" },
  dragon: {
    d: "#5a0d18",
    o: "#ff9a3c",
    r: "#d62f2f",
    w: "#a81e2a",
    y: "#ffd400",
  },
  dragonHit: {
    d: "#ffffff",
    o: "#ffffff",
    r: "#ffd0d0",
    w: "#ffb0b0",
    y: "#000000",
  },
  fireball: { o: "#ff9a3c", r: "#e8381f", y: "#fff27a" },
  monster: {
    g: "#34992c",
    k: "#1a0b1f",
    p: "#7d317a",
    w: "#ffffff",
  },
  monsterDead: {
    g: "#6d6d6d",
    k: "#2b2b2b",
    p: "#8c8c8c",
    w: "#d0d0d0",
  },
  slime: { d: "#0f6344", g: "#34b04a", l: "#93cb9d" },
};

function makeSprite(rows, palette, scale) {
  const canvas = document.createElement("canvas");
  canvas.width = rows[0].length * scale;
  canvas.height = rows.length * scale;
  const ctx = canvas.getContext("2d");
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (!palette[ch]) return;
      ctx.fillStyle = palette[ch];
      ctx.fillRect(x * scale, y * scale, scale, scale);
    });
  });
  return canvas;
}

export function buildSprites() {
  return {
    cloud: [2, 3, 4, 5, 6].map((s) => makeSprite(art.cloud, palettes.cloud, s)),
    dragon: makeSprite(art.dragon, palettes.dragon, 3),
    dragonHit: makeSprite(art.dragon, palettes.dragonHit, 3),
    fireball: makeSprite(art.fireball, palettes.fireball, 2),
    fireballIcon: makeSprite(art.fireball, palettes.fireball, 3),
    life: makeSprite(art.dragon, palettes.dragon, 2),
    monster: makeSprite(art.monster, palettes.monster, 3),
    monsterDead: makeSprite(art.monster, palettes.monsterDead, 3),
    slime: makeSprite(art.slime, palettes.slime, 3),
  };
}

// Draws the dragon at a given scale onto any canvas (used by the arcade menu).
export function drawDragonIcon(canvas) {
  const ctx = canvas.getContext("2d");
  const scale = Math.floor(canvas.width / art.dragon[0].length);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(makeSprite(art.dragon, palettes.dragon, scale), 0, 0);
}

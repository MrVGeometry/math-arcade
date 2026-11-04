// Loads the Astro Stomp images and draws the tiles for each planet.
import { tile } from "./levels.js";

const folder = "img/astro/";
export const astronautCell = { count: 8, h: 84, w: 45 };

const files = {
  astronaut: "astronaut.png",
  "bg-mars": "bg-mars.jpg",
  "bg-saturn": "bg-saturn.jpg",
  "bg-venus": "bg-venus.jpg",
  blade: "blade.png",
  brain: "brain.png",
  brute: "brute.png",
  fly: "fly.png",
  ravager: "ravager.png",
  stalker: "stalker.png",
};

const palettes = {
  mars: { dark: "#4f1d10", fill: "#86391f", speck: "#a8502c", top: "#d07040" },
  saturn: { dark: "#3e3a56", fill: "#6f6a88", speck: "#9a94b0", top: "#e4dccb" },
  venus: { dark: "#1c1712", fill: "#3a3025", speck: "#ff7a1a", top: "#7a6440" },
};

function loadImage(name) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve([name, image]);
    image.onerror = () => reject(new Error(`Couldn't load ${files[name]}`));
    image.src = folder + files[name];
  });
}

function canvasOf(w, h, paint) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  paint(canvas.getContext("2d"));
  return canvas;
}

// Same speckles every time, so tiles don't shimmer.
function speckle(ctx, colour, seed, top) {
  let n = seed;
  ctx.fillStyle = colour;
  for (let i = 0; i < 9; i += 1) {
    n = (n * 9301 + 49297) % 233280;
    const x = Math.floor((n / 233280) * (tile - 6));
    n = (n * 9301 + 49297) % 233280;
    const y = top + Math.floor((n / 233280) * (tile - top - 6));
    ctx.fillRect(x, y, 3 + (i % 3) * 2, 3);
  }
}

function buildTiles(palette) {
  const p = palettes[palette];
  const block = (withTop) => {
    return canvasOf(tile, tile, (ctx) => {
      ctx.fillStyle = p.fill;
      ctx.fillRect(0, 0, tile, tile);
      ctx.fillStyle = p.dark;
      ctx.fillRect(0, tile - 3, tile, 3);
      ctx.fillRect(tile - 3, 0, 3, tile);
      speckle(ctx, p.speck, withTop ? 11 : 37, withTop ? 12 : 0);
      if (!withTop) return;
      ctx.fillStyle = p.top;
      ctx.fillRect(0, 0, tile, 9);
      ctx.fillStyle = p.dark;
      ctx.fillRect(0, 9, tile, 3);
    });
  };
  const ledge = canvasOf(tile, 20, (ctx) => {
    ctx.fillStyle = p.dark;
    ctx.fillRect(0, 0, tile, 20);
    ctx.fillStyle = p.top;
    ctx.fillRect(0, 0, tile, 8);
    ctx.fillStyle = p.fill;
    ctx.fillRect(3, 8, tile - 6, 8);
  });
  return { ledge, solid: block(false), surface: block(true) };
}

export async function loadArt(paletteNames) {
  const loaded = await Promise.all(Object.keys(files).map(loadImage));
  const images = Object.fromEntries(loaded);
  const tiles = Object.fromEntries(
    paletteNames.map((name) => [name, buildTiles(name)]),
  );
  return { images, tiles };
}

// Draws a mirrored copy of the astronaut sheet so left-facing frames are
// a plain drawImage call.
export function mirrorSheet(image) {
  return canvasOf(image.width, image.height, (ctx) => {
    const { count, w } = astronautCell;
    for (let i = 0; i < count; i += 1) {
      ctx.save();
      ctx.translate(i * w + w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(image, i * w, 0, w, image.height, 0, 0, w, image.height);
      ctx.restore();
    }
  });
}

// Arcade menu card: the standing astronaut.
export function drawAstronautIcon(canvas) {
  const image = new Image();
  image.onload = () => {
    const ctx = canvas.getContext("2d");
    const { h, w } = astronautCell;
    const scale = canvas.height / h;
    const x = (canvas.width - w * scale) / 2;
    ctx.drawImage(image, 0, 0, w, h, x, 0, w * scale, canvas.height);
  };
  image.src = folder + files.astronaut;
}

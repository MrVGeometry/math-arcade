// Stage layouts for Astro Stomp. Each stage is described in tile columns
// (45px each) on a 12-row grid: row 0 is the top, rows 10 and 11 are the
// floor. Gaps between floor ranges are pits (or lava, on Venus).
export const tile = 45;
export const rows = 12;

export const stages = [
  {
    background: "bg-mars",
    blocks: [[14, 9, 2, 1], [44, 8, 2, 2], [70, 9, 3, 1], [100, 8, 2, 2]],
    enemies: [
      ["stalker", 11], ["brain", 34, 6], ["brute", 48], ["stalker", 66],
      ["brain", 78, 6], ["brute", 95], ["stalker", 108],
    ],
    floor: [[0, 24], [28, 52], [56, 80], [85, 119]],
    length: 120,
    name: "MARS",
    palette: "mars",
    platforms: [[7, 30, 35], [4, 37, 41], [7, 60, 64], [7, 88, 93]],
    rocket: 115,
    start: 2,
    tagline: "THE RED DESERT",
  },
  {
    background: "bg-venus",
    blocks: [[33, 9, 2, 1], [52, 8, 3, 2], [88, 9, 2, 1], [107, 9, 2, 1]],
    enemies: [
      ["ravager", 15], ["fly", 30, 2], ["blade", 37], ["ravager", 50],
      ["fly", 68, 2], ["blade", 72], ["blade", 90], ["fly", 92, 2],
      ["ravager", 110], ["fly", 120, 2],
    ],
    floor: [
      [0, 20], [24, 40], [45, 58], [63, 75], [80, 96], [101, 112], [116, 129],
    ],
    lava: true,
    length: 130,
    name: "VENUS",
    palette: "venus",
    platforms: [[7, 41, 45], [7, 58, 63], [6, 82, 86], [7, 96, 101]],
    rocket: 125,
    start: 2,
    tagline: "THE TOXIC VOLCANOES",
  },
  {
    background: "bg-saturn",
    blocks: [[27, 9, 2, 1], [62, 8, 2, 2], [84, 9, 3, 1], [122, 9, 2, 1]],
    enemies: [
      ["stalker", 10], ["brain", 24, 5], ["fly", 30, 2], ["blade", 45],
      ["brute", 60], ["ravager", 66], ["fly", 80, 2], ["brain", 88, 5],
      ["stalker", 103], ["ravager", 107], ["blade", 120], ["brute", 125],
      ["fly", 138, 2], ["brain", 140, 5],
    ],
    floor: [
      [0, 16], [21, 34], [39, 50], [56, 70], [76, 92], [98, 110], [116, 128],
      [134, 149],
    ],
    length: 150,
    name: "SATURN",
    palette: "saturn",
    platforms: [
      [7, 17, 20], [6, 35, 38], [7, 51, 55], [7, 71, 75], [7, 93, 97],
      [4, 100, 104], [7, 111, 115], [7, 129, 133],
    ],
    rocket: 145,
    start: 2,
    tagline: "THE RINGED GIANT",
  },
];

// Builds the tile grid: "#" solid, "=" one-way platform, "L" lava, "." air.
export function buildLevel(stage) {
  const grid = Array.from({ length: rows }, () => {
    return Array(stage.length).fill(".");
  });
  const fill = (col, row, ch) => {
    if (grid[row] && col >= 0 && col < stage.length) grid[row][col] = ch;
  };
  stage.floor.forEach(([from, to]) => {
    for (let col = from; col <= to; col += 1) {
      fill(col, 10, "#");
      fill(col, 11, "#");
    }
  });
  if (stage.lava) {
    for (let col = 0; col < stage.length; col += 1) {
      if (grid[11][col] === ".") fill(col, 11, "L");
    }
  }
  stage.blocks.forEach(([col, row, w, h]) => {
    for (let dx = 0; dx < w; dx += 1) {
      for (let dy = 0; dy < h; dy += 1) fill(col + dx, row + dy, "#");
    }
  });
  stage.platforms.forEach(([row, from, to]) => {
    for (let col = from; col <= to; col += 1) fill(col, row, "=");
  });
  return {
    cols: stage.length,
    grid,
    height: rows * tile,
    width: stage.length * tile,
  };
}

export function tileAt(level, col, row) {
  if (col < 0 || col >= level.cols) return "#";
  if (row < 0 || row >= rows) return ".";
  return level.grid[row][col];
}

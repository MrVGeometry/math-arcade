// Builds triangle congruence questions, each with a figure of two congruent
// triangles and exactly three pairs of markings. Runs in the browser (the
// teacher page's Generate button) and in Node (to build questions.json).
//
// Figure format, stored in the question as `figure`:
//   triangles: two of { labels: "QMR", points: [[x, y], [x, y], [x, y]] }
//     in a 400 x 210 box. Vertex i of one triangle matches vertex i of the
//     other, so the markings below apply to both.
//   marks: { side: [i, j], ticks }, { angle: i, arcs } or { right: i }

// No I or O: they look like 1 and 0.
const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("");
export const methods = ["SSS", "SAS", "ASA", "AAS", "HL"];

function shuffle(list, rng) {
  const items = [...list];
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function between(min, max, rng) {
  return min + rng() * (max - min);
}

function pick(list, rng) {
  return list[Math.floor(rng() * list.length)];
}

const degrees = Math.PI / 180;

// A clearly scalene, clearly not-right triangle, so no marking is
// ambiguous. For HL, a right triangle with the right angle at vertex 0.
function baseTriangle(right, rng) {
  if (right) {
    return [[0, 0], [between(1.35, 1.7, rng), 0], [0, -1]];
  }
  for (;;) {
    const a = between(38, 82, rng);
    const b = between(38, 82, rng);
    const c = 180 - a - b;
    const angles = [a, b, c];
    const scalene =
      Math.abs(a - b) >= 12 && Math.abs(b - c) >= 12 && Math.abs(a - c) >= 12;
    const notRight = angles.every((x) => x >= 35 && Math.abs(x - 90) >= 12);
    if (scalene && notRight) {
      const sideB = Math.sin(b * degrees);
      return [
        [0, 0],
        [Math.sin(c * degrees), 0],
        [sideB * Math.cos(a * degrees), -sideB * Math.sin(a * degrees)],
      ];
    }
  }
}

function rotate(points, turn) {
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  return points.map(([x, y]) => [x * cos - y * sin, x * sin + y * cos]);
}

function bounds(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    height: Math.max(...ys) - Math.min(...ys),
    midX: (Math.max(...xs) + Math.min(...xs)) / 2,
    midY: (Math.max(...ys) + Math.min(...ys)) / 2,
    width: Math.max(...xs) - Math.min(...xs),
  };
}

// One scale for both triangles keeps them the same size on screen.
function layOut(first, second) {
  const boxes = [bounds(first), bounds(second)];
  const scale = Math.min(...boxes.map((b) => Math.min(138 / b.width, 140 / b.height)));
  return [first, second].map((points, i) => {
    const { midX, midY } = boxes[i];
    const centreX = i === 0 ? 92 : 308;
    return points.map(([x, y]) => [
      Math.round((centreX + (x - midX) * scale) * 10) / 10,
      Math.round((105 + (y - midY) * scale) * 10) / 10,
    ]);
  });
}

function marksFor(method, rng) {
  const [p, q, r] = shuffle([0, 1, 2], rng);
  const [one, two] = shuffle([1, 2], rng);
  if (method === "SSS") {
    const [t1, t2, t3] = shuffle([1, 2, 3], rng);
    return [
      { side: [p, q], ticks: t1 },
      { side: [q, r], ticks: t2 },
      { side: [p, r], ticks: t3 },
    ];
  }
  if (method === "SAS") {
    return [
      { side: [p, q], ticks: one },
      { side: [p, r], ticks: two },
      { angle: p, arcs: 1 },
    ];
  }
  if (method === "ASA") {
    return [
      { angle: p, arcs: one },
      { angle: q, arcs: two },
      { side: [p, q], ticks: 1 },
    ];
  }
  if (method === "AAS") {
    return [
      { angle: p, arcs: one },
      { angle: q, arcs: two },
      { side: [q, r], ticks: 1 },
    ];
  }
  // HL: the right angle is vertex 0, so the hypotenuse is side 1-2.
  return [
    { right: 0 },
    { side: [1, 2], ticks: one },
    { side: [0, pick([1, 2], rng)], ticks: two },
  ];
}

// Two congruent triangles in different positions (one may be flipped),
// with random letters, and the markings for the given method.
export function makeFigure(method, rng = Math.random) {
  const base = baseTriangle(method === "HL", rng);
  const flipped = rng() < 0.5 ? base.map(([x, y]) => [-x, y]) : base;
  const [first, second] = layOut(
    rotate(base, between(0, 2 * Math.PI, rng)),
    rotate(flipped, between(0, 2 * Math.PI, rng)),
  );
  const six = shuffle(letters, rng).slice(0, 6);
  return {
    marks: marksFor(method, rng),
    triangles: [
      { labels: six.slice(0, 3).join(""), points: first },
      { labels: six.slice(3).join(""), points: second },
    ],
  };
}

// Names both triangles in the same random vertex order, e.g. QMR and YXZ.
function matchingNames(figure, rng) {
  const order = shuffle([0, 1, 2], rng);
  return figure.triangles.map((t) => order.map((i) => t.labels[i]).join(""));
}

export function shortcutQuestion(method, rng = Math.random) {
  const figure = makeFigure(method, rng);
  const [first, second] = figure.triangles.map((t) => t.labels);
  return {
    accept: method === "AAS" ? ["SAA"] : [],
    answer: method,
    figure,
    prompt: `△${first} and △${second}: which shortcut proves they're congruent? Type SSS, SAS, ASA, AAS or HL.`,
  };
}

export function statementQuestion(rng = Math.random) {
  const figure = makeFigure(pick(methods, rng), rng);
  const [first, second] = matchingNames(figure, rng);
  return {
    accept: [],
    answer: `△${second}`,
    figure,
    prompt: `Complete the statement: △${first} ≅ △___ Type the 3 letters.`,
  };
}

// Given a statement, find the part matching an angle or a side. Asks
// about either triangle.
export function matchingQuestion(rng = Math.random) {
  const figure = makeFigure(pick(methods, rng), rng);
  const names = matchingNames(figure, rng);
  const [from, to] = rng() < 0.5 ? names : [names[1], names[0]];
  const statement = `△${names[0]} ≅ △${names[1]}`;
  if (rng() < 0.5) {
    const i = Math.floor(rng() * 3);
    const others = [0, 1, 2].filter((j) => j !== i).map((j) => to[j]);
    return {
      accept: [`${others[0]}${to[i]}${others[1]}`, `${others[1]}${to[i]}${others[0]}`],
      answer: `∠${to[i]}`,
      figure,
      prompt: `${statement}. Which angle is congruent to ∠${from[i]}? Type its letter.`,
    };
  }
  const [i, j] = shuffle([0, 1, 2], rng).slice(0, 2);
  return {
    accept: [`${to[j]}${to[i]}`],
    answer: `[[${to[i]}${to[j]}]]`,
    figure,
    prompt: `${statement}. Which side is congruent to [[${from[i]}${from[j]}]]? Type its 2 letters.`,
  };
}

export const questionKinds = {
  matching: { label: "Match a part", make: matchingQuestion },
  shortcut: {
    label: "Name the shortcut",
    make: (rng = Math.random) => shortcutQuestion(pick(methods, rng), rng),
  },
  statement: { label: "Complete the statement", make: statementQuestion },
};

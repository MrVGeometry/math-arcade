// Draws a question's figure (see js/congruence.js for the format) as SVG,
// and shows question text with [[AB]] drawn as segment AB (overlined).
const svgNs = "http://www.w3.org/2000/svg";

function svg(tag, attributes) {
  const node = document.createElementNS(svgNs, tag);
  Object.entries(attributes).forEach(([key, value]) => {
    node.setAttribute(key, String(value));
  });
  return node;
}

function unit([x1, y1], [x2, y2]) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  return [(x2 - x1) / length, (y2 - y1) / length];
}

function round(value) {
  return Math.round(value * 10) / 10;
}

// Tick marks across the middle of a side, spaced along it.
function ticks(a, b, count) {
  const [dx, dy] = unit(a, b);
  const midX = (a[0] + b[0]) / 2;
  const midY = (a[1] + b[1]) / 2;
  const lines = [];
  for (let k = 0; k < count; k += 1) {
    const offset = (k - (count - 1) / 2) * 6;
    const cx = midX + dx * offset;
    const cy = midY + dy * offset;
    lines.push(
      svg("line", {
        x1: round(cx - dy * 7),
        x2: round(cx + dy * 7),
        y1: round(cy + dx * 7),
        y2: round(cy - dx * 7),
      }),
    );
  }
  return lines;
}

// Concentric arcs inside the angle at vertex p, between its two sides.
function arcs(p, q, r, count) {
  const u = unit(p, q);
  const v = unit(p, r);
  const sweep = u[0] * v[1] - u[1] * v[0] > 0 ? 1 : 0;
  const paths = [];
  for (let k = 0; k < count; k += 1) {
    const radius = 17 + k * 5;
    const start = [p[0] + u[0] * radius, p[1] + u[1] * radius].map(round);
    const end = [p[0] + v[0] * radius, p[1] + v[1] * radius].map(round);
    paths.push(
      svg("path", {
        d: `M${start} A${radius},${radius} 0 0 ${sweep} ${end}`,
        fill: "none",
      }),
    );
  }
  return paths;
}

// The little square in a right angle.
function rightBox(p, q, r) {
  const u = unit(p, q);
  const v = unit(p, r);
  const size = 12;
  const corner = (a, b) => {
    return [p[0] + u[0] * a + v[0] * b, p[1] + u[1] * a + v[1] * b].map(round);
  };
  return [
    svg("path", {
      d: `M${corner(size, 0)} L${corner(size, size)} L${corner(0, size)}`,
      fill: "none",
    }),
  ];
}

function marksOn(points, marks) {
  return marks.flatMap((mark) => {
    if (mark.side) {
      const [i, j] = mark.side;
      return ticks(points[i], points[j], mark.ticks);
    }
    const i = mark.angle ?? mark.right;
    const [j, k] = [0, 1, 2].filter((n) => n !== i);
    return mark.right === undefined
      ? arcs(points[i], points[j], points[k], mark.arcs)
      : rightBox(points[i], points[j], points[k]);
  });
}

// Each label sits just outside its corner, pushed away from the centre.
function labelsOn(points, labels) {
  const cx = (points[0][0] + points[1][0] + points[2][0]) / 3;
  const cy = (points[0][1] + points[1][1] + points[2][1]) / 3;
  return points.map(([x, y], i) => {
    const [dx, dy] = unit([cx, cy], [x, y]);
    const text = svg("text", {
      x: round(x + dx * 15),
      y: round(y + dy * 15),
    });
    text.textContent = labels[i];
    return text;
  });
}

export function renderFigure(figure) {
  const root = svg("svg", {
    class: "figure",
    role: "img",
    viewBox: "-20 -10 440 230",
  });
  const names = figure.triangles.map((t) => `triangle ${t.labels}`);
  root.setAttribute("aria-label", `${names.join(" and ")}, with markings`);
  figure.triangles.forEach(({ labels, points }) => {
    root.append(
      svg("polygon", { class: "fig-shape", points: points.join(" ") }),
    );
    const marks = svg("g", { class: "fig-marks" });
    marks.append(...marksOn(points, figure.marks));
    const text = svg("g", { class: "fig-labels" });
    text.append(...labelsOn(points, labels));
    root.append(marks, text);
  });
  return root;
}

// The pixel font has no △ ∠ ≅, so they'd fall back tiny. Draw them in a
// system font at a readable size.
function withSymbols(text) {
  return text.split(/([△∠≅])/).filter(Boolean).map((part) => {
    if (!/^[△∠≅]$/.test(part)) return part;
    const symbol = document.createElement("span");
    symbol.className = "math-symbol";
    symbol.textContent = part;
    return symbol;
  });
}

// Text with [[AB]] shown as segment AB, i.e. AB with a bar over it.
export function renderMathText(text) {
  const fragment = document.createDocumentFragment();
  String(text)
    .split(/\[\[(.+?)\]\]/)
    .forEach((part, i) => {
      if (!part) return;
      if (i % 2 === 0) {
        fragment.append(...withSymbols(part));
        return;
      }
      const segment = document.createElement("span");
      segment.className = "segment";
      segment.textContent = part;
      fragment.append(segment);
    });
  return fragment;
}

/**
 * Decorative hand-drawn doodles for the login screen, in Excalidraw's style:
 * wobbly double strokes, hachure / cross-hatch fills, its pastel palette.
 * Pure SVG generated from a seeded RNG, so it looks the same on every load.
 */

const C = {
  blue: "#74c0fc",
  green: "#b2f2bb",
  yellow: "#ffd43b",
  red: "#ffc9c9",
  violet: "#b197fc",
  orange: "#ffa94d",
  pink: "#fcc2d7",
  teal: "#96f2d7",
};
const STROKE = {
  blue: "#1971c2",
  green: "#2f9e44",
  red: "#e03131",
  violet: "#6741d9",
  orange: "#e8590c",
};

// ---------- tiny "rough" generator ----------
type Pt = [number, number];

function rng(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const jit = (r: () => number, a: number) => (r() - 0.5) * 2 * a;

function roughSeg(a: Pt, b: Pt, r: () => number, amt = 1.6) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const bow = Math.min(amt * 2, len * 0.02 + amt);
  const mx = (a[0] + b[0]) / 2 + jit(r, bow);
  const my = (a[1] + b[1]) / 2 + jit(r, bow);
  return `M${a[0] + jit(r, amt)} ${a[1] + jit(r, amt)} Q${mx} ${my} ${b[0] + jit(r, amt)} ${b[1] + jit(r, amt)}`;
}

/** Outline of a polygon drawn twice with jitter, like Excalidraw's roughness=1. */
function roughPoly(points: Pt[], seed: number, closed = true) {
  const r = rng(seed);
  let d = "";
  for (let pass = 0; pass < 2; pass++) {
    const n = closed ? points.length : points.length - 1;
    for (let i = 0; i < n; i++) d += roughSeg(points[i], points[(i + 1) % points.length], r) + " ";
  }
  return d;
}

function ellipsePoints(cx: number, cy: number, rx: number, ry: number, r: () => number, steps = 28): Pt[] {
  const start = r() * Math.PI * 2;
  const pts: Pt[] = [];
  for (let i = 0; i <= steps + 2; i++) {
    const t = start + (i / steps) * Math.PI * 2;
    pts.push([cx + Math.cos(t) * (rx + jit(r, 1.8)), cy + Math.sin(t) * (ry + jit(r, 1.8))]);
  }
  return pts;
}

function smooth(pts: Pt[]) {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q${pts[i][0]} ${pts[i][1]} ${mx} ${my}`;
  }
  return d;
}

function roughEllipse(cx: number, cy: number, rx: number, ry: number, seed: number) {
  const r = rng(seed);
  return smooth(ellipsePoints(cx, cy, rx, ry, r)) + " " + smooth(ellipsePoints(cx, cy, rx * 1.01, ry * 0.99, r));
}

const rectPts = (x: number, y: number, w: number, h: number): Pt[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];
const polyFill = (pts: Pt[]) => "M" + pts.map((p) => p.join(" ")).join(" L") + " Z";

/** Curved arrow with an Excalidraw-style open arrowhead. */
function arrow(from: Pt, ctrl: Pt, to: Pt, seed: number) {
  const r = rng(seed);
  const body =
    `M${from[0]} ${from[1]} Q${ctrl[0] + jit(r, 3)} ${ctrl[1] + jit(r, 3)} ${to[0]} ${to[1]} ` +
    `M${from[0] + jit(r, 1.5)} ${from[1] + jit(r, 1.5)} Q${ctrl[0] + jit(r, 4)} ${ctrl[1] + jit(r, 4)} ${to[0] + jit(r, 1)} ${to[1] + jit(r, 1)}`;
  const ang = Math.atan2(to[1] - ctrl[1], to[0] - ctrl[0]);
  const head = (da: number): Pt => [to[0] - 16 * Math.cos(ang + da), to[1] - 16 * Math.sin(ang + da)];
  const h1 = head(0.45);
  const h2 = head(-0.45);
  return `${body} M${h1[0]} ${h1[1]} L${to[0]} ${to[1]} L${h2[0]} ${h2[1]}`;
}

/** Wavy "handwriting" line used inside notes. */
function scribble(x: number, y: number, w: number, seed: number) {
  const r = rng(seed);
  let d = `M${x} ${y}`;
  for (let i = 1; i <= Math.round(w / 14); i++) d += ` q7 ${jit(r, 4) - 3} 14 ${jit(r, 2)}`;
  return d;
}

// ---------- shapes ----------
function Shape({ outline, fill, fillPaint, stroke = "currentColor", width = 1.6 }: {
  outline: string;
  fill?: string; // clean path to fill
  fillPaint?: string;
  stroke?: string;
  width?: number;
}) {
  return (
    <g>
      {fill && fillPaint && <path d={fill} fill={fillPaint} stroke="none" />}
      <path d={outline} fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function Hatch({ id, color, gap = 9, angle = -41, cross = false }: { id: string; color: string; gap?: number; angle?: number; cross?: boolean }) {
  return (
    <pattern id={id} width={gap} height={gap} patternUnits="userSpaceOnUse" patternTransform={`rotate(${angle})`}>
      <line x1="0" y1="0" x2="0" y2={gap} stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      {cross && <line x1="0" y1="0" x2={gap} y2="0" stroke={color} strokeWidth="2.2" strokeLinecap="round" />}
    </pattern>
  );
}

function ellipseFill(cx: number, cy: number, rx: number, ry: number) {
  return `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${rx * 2} 0 a${rx} ${ry} 0 1 0 ${-rx * 2} 0`;
}

export function LoginBackground() {
  // Flowchart (top-left)
  const box = rectPts(90, 92, 170, 88);
  const diamond: Pt[] = [
    [430, 108],
    [500, 170],
    [430, 232],
    [360, 170],
  ];
  // Folder (bottom-left)
  const folder: Pt[] = [
    [110, 640],
    [190, 640],
    [210, 662],
    [340, 662],
    [340, 790],
    [110, 790],
  ];
  const paper = rectPts(140, 610, 150, 120);
  // Sticky note (top-right)
  const note1 = rectPts(1120, 86, 160, 150);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden text-neutral-800 dark:text-neutral-300"
      style={{
        maskImage: "radial-gradient(ellipse 22% 38% at 50% 50%, transparent 85%, #000 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 22% 38% at 50% 50%, transparent 85%, #000 100%)",
      }}
    >
      <svg className="h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <Hatch id="h-blue" color={C.blue} />
          <Hatch id="x-violet" color={STROKE.violet} cross gap={12} />
        </defs>

        <g className="dark:opacity-85">
          {/* top-left: box -> diamond */}
          <g className="doodle-float" style={{ animationDelay: "0s" }}>
            <Shape outline={roughPoly(box, 11)} fill={polyFill(box)} fillPaint={C.blue} stroke={STROKE.blue} width={2} />
            <path d={arrow([264, 136], [310, 120], [354, 162], 21)} stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            <Shape outline={roughPoly(diamond, 31)} fill={polyFill(diamond)} fillPaint={C.green} stroke={STROKE.green} width={2} />
          </g>

          {/* top-right: sticky note */}
          <g className="doodle-float" style={{ animationDelay: "-3s" }}>
            <g transform="rotate(5 1200 160)">
              <Shape outline={roughPoly(note1, 61)} fill={polyFill(note1)} fillPaint={C.yellow} stroke="#e67700" width={2} />
              {[120, 145, 170].map((y, i) => (
                <path key={y} d={scribble(1138, y, i === 2 ? 70 : 118, 70 + i)} stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity=".5" />
              ))}
            </g>
          </g>

          {/* bottom-left: folder */}
          <g className="doodle-float" style={{ animationDelay: "-4s" }}>
            <g transform="rotate(-4 215 670)">
              <Shape outline={roughPoly(paper, 111)} fill={polyFill(paper)} fillPaint="var(--card)" width={1.4} />
            </g>
            <Shape outline={roughPoly(folder, 121)} fill={polyFill(folder)} fillPaint={C.orange} stroke={STROKE.orange} width={2} />
          </g>

          {/* bottom-right: circle */}
          <g className="doodle-float" style={{ animationDelay: "-2s" }}>
            <path d={ellipseFill(1250, 720, 64, 64)} fill={C.pink} />
            <Shape outline={roughEllipse(1250, 720, 64, 64, 91)} fill={ellipseFill(1250, 720, 64, 64)} fillPaint="url(#x-violet)" stroke={STROKE.violet} width={2} />
          </g>
        </g>
      </svg>
    </div>
  );
}

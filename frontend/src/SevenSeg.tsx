// Seven-segment LED readout, drawn like a pabellón scoreboard: unlit
// segments stay faintly visible, and sizes snap to whole pixels.
const W = 12;
const H = 22;
const T = 2.4;
const G = 0.5;
const COLON = 5;
const SPACE = 6;
const STEP = W + 3;

const h = (y: number) => {
  const x1 = T / 2 + G;
  const x2 = W - T / 2 - G;
  return `${x1},${y} ${x1 + T / 2},${y - T / 2} ${x2 - T / 2},${y - T / 2} ${x2},${y} ${x2 - T / 2},${y + T / 2} ${x1 + T / 2},${y + T / 2}`;
};
const v = (x: number, y1: number, y2: number) => {
  const a = y1 + G;
  const b = y2 - G;
  return `${x},${a} ${x + T / 2},${a + T / 2} ${x + T / 2},${b - T / 2} ${x},${b} ${x - T / 2},${b - T / 2} ${x - T / 2},${a + T / 2}`;
};
const L = T / 2;
const R = W - T / 2;
const SEGMENTS = {
  a: h(T / 2),
  b: v(R, T / 2, H / 2),
  c: v(R, H / 2, H - T / 2),
  d: h(H - T / 2),
  e: v(L, H / 2, H - T / 2),
  f: v(L, T / 2, H / 2),
  g: h(H / 2),
};
const GLYPHS: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abged",
  "3": "abgcd",
  "4": "fgbc",
  "5": "afgcd",
  "6": "afgedc",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
  "-": "g",
};

export default function SevenSeg({
  value,
  label,
  size = "md",
}: {
  value: string;
  label: string;
  size?: "sm" | "md" | "lg";
}) {
  let x = 0;
  const parts = [...value].map((ch, i) => {
    const at = x;
    if (ch === ":" || ch === "." ) {
      x += COLON;
      return (
        <g key={i} className="seg-on">
          {ch === ":" && <rect x={at + 1.2} y={H * 0.3 - 1.3} width={2.6} height={2.6} />}
          <rect x={at + 1.2} y={H * 0.7 - 1.3} width={2.6} height={2.6} />
        </g>
      );
    }
    if (ch === " ") {
      x += SPACE;
      return null;
    }
    x += STEP;
    const lit = GLYPHS[ch] ?? "";
    return (
      <g key={i} transform={`translate(${at} 0)`}>
        {Object.entries(SEGMENTS).map(([name, points]) => (
          <polygon
            key={name}
            points={points}
            className={lit.includes(name) ? "seg-on" : "seg-off"}
          />
        ))}
      </g>
    );
  });
  const width = Math.max(1, x - 3);
  return (
    <span className={`seg seg-${size}`} role="img" aria-label={label}>
      <svg
        viewBox={`-1 -1 ${width + 3} ${H + 2}`}
        style={{ aspectRatio: `${width + 3} / ${H + 2}` }}
        aria-hidden="true"
      >
        <g transform="skewX(-6) translate(1.4 0)">{parts}</g>
      </svg>
    </span>
  );
}

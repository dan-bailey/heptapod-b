import React, { useMemo, useRef, useState } from "react";

// --- Utility: seeded RNG (mulberry32) and simple hash for strings ---
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToInt(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1;
}

// --- Types for UI state ---
interface SemagramParams {
  proposition: string;
  certainty: number; // 0..1 thickness & solidity
  modality: number; // 0..1 obligation/possibility curve bias
  temporality: number; // 0..1: 0 linear, 1 non-linear (more recursion)
  agency: number; // 0..1: 0 external, 1 internal
  perspective: "1st" | "2nd" | "3rd";
  negation: boolean;
  hypothetical: boolean;
  emphasis: number; // 0..1 overall scale
  seed: string;
}

const defaultParams: SemagramParams = {
  proposition: "She was always there even before I knew her",
  certainty: 0.68,
  modality: 0.4,
  temporality: 0.82,
  agency: 0.55,
  perspective: "1st",
  negation: false,
  hypothetical: false,
  emphasis: 0.9,
  seed: "arrival",
};

// --- Geometry helpers ---
const TAU = Math.PI * 2;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function polar(cx: number, cy: number, r: number, ang: number) {
  return { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) };
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const start = polar(cx, cy, r, a0);
  const end = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 ${large} ${sweep} ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

// Choose a prime-ish spoke count based on content words
function chooseSpokes(wordCount: number) {
  const candidates = [7, 9, 11, 13, 17, 19];
  const idx = clamp(Math.floor((wordCount - 3) / 3), 0, candidates.length - 1);
  return candidates[idx];
}

function splitContentWords(text: string) {
  return (text.toLowerCase().match(/[a-z0-9']+/g) || []).filter(
    (w) => !["the", "a", "an", "and", "or", "but", "is", "was", "am", "are"].includes(w)
  );
}

// --- Core generator ---
function generateSegments(p: SemagramParams) {
  const baseSeed = hashStringToInt(p.seed + "|" + p.proposition);
  const rnd = mulberry32(baseSeed);

  const words = splitContentWords(p.proposition);
  const cx = 0;
  const cy = 0;
  const rings = clamp(3 + Math.floor(p.temporality * 3 + rnd() * 2), 3, 7);
  const spokes = chooseSpokes(words.length || 1);
  const radiusBase = 100;
  const ringGap = 28 + rnd() * 6;

  const segments: Array<{ d: string; w: number; dash?: string; opacity: number }[]> = [];

  for (let i = 0; i < rings; i++) {
    const r = radiusBase + i * ringGap;
    const segs: Array<{ d: string; w: number; dash?: string; opacity: number }> = [];

    // ring sweep bias encodes modality (obligation vs possibility)
    const bias = lerp(-0.6, 0.6, p.modality) + (rnd() - 0.5) * 0.2;

    for (let s = 0; s < spokes; s++) {
      // start & end angles per segment
      const a0 = (TAU * s) / spokes + bias * 0.2;
      const jitter = (rnd() - 0.5) * (0.25 + p.temporality * 0.35);
      const span = lerp(0.7, 1.55, p.temporality) + jitter;
      const direction = rnd() > 0.5 ? 1 : -1;
      const a1 = a0 + span * direction;

      // stroke width encodes certainty & emphasis, slight inward taper with i
      const w = clamp(lerp(1.2, 5.5, p.certainty) * lerp(0.8, 1.15, p.emphasis) * (1 - i * 0.03), 0.8, 7);

      // dashed pattern toggles: negation & hypothetical
      let dash: string | undefined = undefined;
      if (p.negation && p.hypothetical) dash = `${lerp(2, 6, p.certainty).toFixed(1)} ${lerp(1, 3, 1 - p.certainty).toFixed(1)}`;
      else if (p.negation) dash = `${lerp(4, 9, 1 - p.certainty).toFixed(1)} ${lerp(2, 4, p.certainty).toFixed(1)}`;
      else if (p.hypothetical) dash = `${lerp(1.5, 4, 1 - p.certainty).toFixed(1)} ${lerp(1, 3, p.certainty).toFixed(1)}`;

      // perspective subtly rotates the ring
      const perspRot = p.perspective === "1st" ? 0.0 : p.perspective === "2nd" ? 0.12 : -0.12;

      const d = arcPath(cx, cy, r, a0 + perspRot, a1 + perspRot);
      const opacity = 0.7 + (rnd() - 0.5) * 0.1 + (p.agency - 0.5) * 0.1; // internal agency = more opaque

      segs.push({ d, w, dash, opacity: clamp(opacity, 0.45, 1) });
    }

    segments.push(segs);
  }

  // Anchor spokes (radial joints) tie rings together
  const connectors: Array<{ x1: number; y1: number; x2: number; y2: number; w: number; opacity: number }>[] = [];
  for (let i = 0; i < rings - 1; i++) {
    const r0 = radiusBase + i * ringGap;
    const r1 = radiusBase + (i + 1) * ringGap;
    const conns: Array<{ x1: number; y1: number; x2: number; y2: number; w: number; opacity: number }> = [];
    for (let s = 0; s < spokes; s++) {
      const a = (TAU * s) / spokes + (rnd() - 0.5) * 0.03;
      const p0 = polar(0, 0, r0, a);
      const p1 = polar(0, 0, r1, a);
      conns.push({ x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y, w: lerp(0.6, 2.2, p.certainty), opacity: 0.25 + p.temporality * 0.25 });
    }
    connectors.push(conns);
  }

  return { segments, connectors, rings, spokes, radiusBase, ringGap };
}

// --- Download helpers ---
function downloadSVG(svgRef: React.RefObject<SVGSVGElement>, name = "semagram.svg") {
  if (!svgRef.current) return;
  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svgRef.current);
  if (!source.match(/^<svg[^>]+xmlns=\"http:\/\/www.w3.org\/2000\/svg\"/)) {
    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  source = '<?xml version="1.0" standalone="no"?>
' + source;
  const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function copySVG(svgRef: React.RefObject<SVGSVGElement>) {
  if (!svgRef.current) return;
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svgRef.current);
  navigator.clipboard.writeText(source);
}

function randomSeed() {
  return Math.random().toString(36).slice(2, 10);
}

// --- UI Component ---
export default function HeptapodSemagramLab() {
  const [mode, setMode] = useState<"single" | "composite" | "blend">("single");
  const [p, setP] = useState<SemagramParams>(defaultParams);
  const [p2, setP2] = useState<SemagramParams>({ ...defaultParams, proposition: "I only recognized her when time curved back", seed: "return" });
  const [blend, setBlend] = useState(0.5);

  const svgRef = useRef<SVGSVGElement>(null);

  const clauses = useMemo(() => {
    if (mode !== "composite") return [] as string[];
    return p.proposition
      .split(/
+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [mode, p.proposition]);

  const glyphSingle = useMemo(() => generateSegments(p), [p]);
  const glyphBlendA = useMemo(() => generateSegments(p), [p]);
  const glyphBlendB = useMemo(() => generateSegments(p2), [p2]);

  const size = 640;
  const margin = 36;

  // Palette used to distinguish composite layers subtly
  const palette = ["#fafafa", "#d1d5db", "#a3a3a3", "#e5e7eb", "#cbd5e1"]; // light grays

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 p-6 flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Heptapod B Semagram Lab</h1>
        <div className="flex gap-2">
          <button
            onClick={() => downloadSVG(svgRef)}
            className="px-4 py-2 rounded-2xl bg-neutral-800 hover:bg-neutral-700 shadow-md"
          >
            Download SVG
          </button>
          <button
            onClick={() => copySVG(svgRef)}
            className="px-4 py-2 rounded-2xl bg-neutral-800 hover:bg-neutral-700 shadow-md"
          >
            Copy SVG
          </button>
          <button
            onClick={() => {
              setP((old) => ({ ...old, seed: randomSeed() }));
              setP2((old) => ({ ...old, seed: randomSeed() }));
            }}
            className="px-4 py-2 rounded-2xl bg-neutral-800 hover:bg-neutral-700 shadow-md"
          >
            Randomize Seeds
          </button>
          <button
            onClick={() => {
              setP({ ...defaultParams });
              setP2({ ...defaultParams, proposition: "I only recognized her when time curved back", seed: "return" });
              setBlend(0.5);
              setMode("single");
            }}
            className="px-4 py-2 rounded-2xl bg-neutral-800 hover:bg-neutral-700 shadow-md"
          >
            Reset
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls */}
        <section className="lg:col-span-5 xl:col-span-4 bg-neutral-900/60 rounded-2xl p-4 shadow-lg space-y-4">
          {/* Mode Tabs */}
          <div className="flex gap-2 mb-2">
            {(["single", "composite", "blend"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-2 rounded-xl text-sm ${mode === m ? "bg-neutral-700" : "bg-neutral-800 hover:bg-neutral-700"}`}
              >
                {m[0].toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          {/* Proposition Inputs */}
          {mode === "single" && (
            <div>
              <label className="block text-sm mb-1">Proposition</label>
              <textarea
                value={p.proposition}
                onChange={(e) => setP({ ...p, proposition: e.target.value })}
                className="w-full h-24 rounded-xl bg-neutral-800 p-3 focus:outline-none"
              />
            </div>
          )}

          {mode === "composite" && (
            <div>
              <label className="block text-sm mb-1">Composite (one clause per line)</label>
              <textarea
                value={p.proposition}
                onChange={(e) => setP({ ...p, proposition: e.target.value })}
                placeholder={"Clause A
Clause B
Clause C"}
                className="w-full h-28 rounded-xl bg-neutral-800 p-3 focus:outline-none"
              />
              <p className="text-xs mt-1 text-neutral-400">Each line becomes a layered semagram with subtle rotation/scale offsets.</p>
            </div>
          )}

          {mode === "blend" && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1">Proposition A</label>
                <textarea
                  value={p.proposition}
                  onChange={(e) => setP({ ...p, proposition: e.target.value })}
                  className="w-full h-20 rounded-xl bg-neutral-800 p-3 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Proposition B</label>
                <textarea
                  value={p2.proposition}
                  onChange={(e) => setP2({ ...p2, proposition: e.target.value })}
                  className="w-full h-20 rounded-xl bg-neutral-800 p-3 focus:outline-none"
                />
              </div>
              <Slider label={`Blend (${(blend * 100).toFixed(0)}%)`} value={blend} onChange={setBlend} />
            </div>
          )}

          {/* Shared controls */}
          <div className="grid grid-cols-2 gap-4 mt-2">
            <Slider label="Certainty" value={p.certainty} onChange={(v) => setP({ ...p, certainty: v })} />
            <Slider label="Modality" value={p.modality} onChange={(v) => setP({ ...p, modality: v })} />
            <Slider label="Temporality" value={p.temporality} onChange={(v) => setP({ ...p, temporality: v })} />
            <Slider label="Agency" value={p.agency} onChange={(v) => setP({ ...p, agency: v })} />
            <Slider label="Emphasis" value={p.emphasis} onChange={(v) => setP({ ...p, emphasis: v })} />
          </div>

          <div className="grid grid-cols-2 gap-4 items-center">
            <div>
              <label className="block text-sm mb-1">Perspective</label>
              <select
                value={p.perspective}
                onChange={(e) => setP({ ...p, perspective: e.target.value as SemagramParams["perspective"] })}
                className="w-full rounded-xl bg-neutral-800 p-2"
              >
                <option value="1st">1st</option>
                <option value="2nd">2nd</option>
                <option value="3rd">3rd</option>
              </select>
            </div>
            <div>
              <label className="block text-sm mb-1">Seed</label>
              <input
                value={p.seed}
                onChange={(e) => setP({ ...p, seed: e.target.value })}
                className="w-full rounded-xl bg-neutral-800 p-2"
              />
            </div>
          </div>

          <div className="flex gap-4 items-center">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={p.negation}
                onChange={(e) => setP({ ...p, negation: e.target.checked })}
              />
              <span>Negation</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={p.hypothetical}
                onChange={(e) => setP({ ...p, hypothetical: e.target.checked })}
              />
              <span>Hypothetical</span>
            </label>
          </div>

          {/* Legend */}
          <Legend />
        </section>

        {/* Canvas */}
        <section className="lg:col-span-7 xl:col-span-8 bg-neutral-900/60 rounded-2xl p-4 shadow-lg flex items-center justify-center">
          <svg
            ref={svgRef}
            viewBox={`-${size / 2 + margin} -${size / 2 + margin} ${size + margin * 2} ${size + margin * 2}`}
            width={size}
            height={size}
          >
            {/* Background */}
            <circle cx={0} cy={0} r={320} fill="#0a0a0a" />

            {/* Render according to mode */}
            {mode === "single" && (
              <SemagramSVG glyph={glyphSingle} params={p} color="#fafafa" />
            )}

            {mode === "composite" && (
              <>
                {clauses.map((clause, i) => {
                  const tParams: SemagramParams = { ...p, proposition: clause, seed: p.seed + ':' + i };
                  const g = generateSegments(tParams);
                  const rot = (i * TAU) / (clauses.length * 7);
                  const scale = 1 - i * 0.06;
                  const col = palette[i % palette.length];
                  return (
                    <g key={`comp-${i}`} transform={`rotate(${(rot * 180) / Math.PI}) scale(${scale})`} opacity={1 - i * 0.07}>
                      <SemagramSVG glyph={g} params={tParams} color={col} />
                    </g>
                  );
                })}
              </>
            )}

            {mode === "blend" && (
              <>
                {/* A and B with opposing rotations and alpha weights */}
                <g transform={`rotate(${-15})`} opacity={1 - blend * 0.65}>
                  <SemagramSVG glyph={glyphBlendA} params={p} color="#e5e7eb" />
                </g>
                <g transform={`rotate(${15})`} opacity={0.35 + blend * 0.65}>
                  <SemagramSVG glyph={glyphBlendB} params={p2} color="#cbd5e1" />
                </g>
                {/* Center node indicates blend state */}
                <circle cx={0} cy={0} r={lerp(8, 18, (p.agency + p2.agency) / 2)} fill="#fafafa" opacity={0.25 + blend * 0.35} />
              </>
            )}
          </svg>
        </section>
      </div>

      <footer className="text-xs text-neutral-400 space-y-1">
        <p>
          This is a creative system inspired by the circular aesthetics of Heptapod B from *Story of Your Life* / *Arrival*. It does not claim to reproduce any official script.
        </p>
        <p>Modes: <strong>Single</strong> renders one proposition. <strong>Composite</strong> layers multiple clauses (one per line). <strong>Blend</strong> fuses two propositions by overlay.</p>
      </footer>
    </div>
  );
}

function SemagramSVG({ glyph, params, color }: { glyph: ReturnType<typeof generateSegments>; params: SemagramParams; color: string }) {
  return (
    <g>
      {/* Connectors */}
      {glyph.connectors.map((ring, i) => (
        <g key={`conn-${i}`} opacity={ring[0]?.opacity ?? 0.3}>
          {ring.map((c, j) => (
            <line
              key={`c-${i}-${j}`}
              x1={c.x1}
              y1={c.y1}
              x2={c.x2}
              y2={c.y2}
              stroke={color}
              strokeWidth={c.w}
              strokeLinecap="round"
              opacity={c.opacity}
            />
          ))}
        </g>
      ))}

      {/* Segments */}
      {glyph.segments.map((ring, i) => (
        <g key={`ring-${i}`}>
          {ring.map((seg, j) => (
            <path
              key={`seg-${i}-${j}`}
              d={seg.d}
              fill="none"
              stroke={color}
              strokeWidth={seg.w}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={seg.dash}
              opacity={seg.opacity}
            />
          ))}
        </g>
      ))}

      {/* Center node encodes agency & perspective */}
      <g>
        <circle cx={0} cy={0} r={lerp(6, 16, params.agency)} fill={color} opacity={0.28 + params.agency * 0.35} />
        {params.perspective !== "1st" && (
          <circle cx={0} cy={0} r={lerp(12, 22, params.agency)} fill="none" stroke={color} opacity={0.18} />
        )}
      </g>
    </g>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-sm mb-1">{label}: <span className="tabular-nums">{typeof value === 'number' ? value.toFixed(2) : value}</span></label>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-4 rounded-xl bg-neutral-800/60 p-3 text-xs leading-relaxed space-y-2">
      <div className="font-semibold text-neutral-200">Legend (design mapping)</div>
      <ul className="list-disc ml-4 space-y-1 text-neutral-300">
        <li><span className="font-medium">Certainty</span>: thicker strokes, higher opacity.</li>
        <li><span className="font-medium">Modality</span>: arc sweep bias (obligation vs. possibility) shifts segment angles.</li>
        <li><span className="font-medium">Temporality</span>: more rings & irregular spans (non-linearity).</li>
        <li><span className="font-medium">Agency</span>: brighter/denser center node and overall opacity.</li>
        <li><span className="font-medium">Perspective</span>: subtle global rotation per ring (1st none, 2nd +, 3rd −).</li>
        <li><span className="font-medium">Negation</span>: dashed segments with longer gaps; <span className="font-medium">Hypothetical</span>: finer dash arrays.</li>
        <li><span className="font-medium">Emphasis</span>: overall scale and stroke presence.</li>
        <li><span className="font-medium">Composite</span>: each clause is layered with a slight rotation & scale change.</li>
        <li><span className="font-medium">Blend</span>: A and B overlay with opposing rotations; slider adjusts dominance.</li>
      </ul>
    </div>
  );
}

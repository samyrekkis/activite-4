// Copies the cut rhythm of a reference edit (analyze_ref.py JSON) onto library clips:
// shot i lasts exactly as long as the reference's shot i, so the edit lands on the
// same song beats. The client then adds the same song (from the same start) on Instagram.
//   node scripts/library/ref-plan.mjs <spec.json>
// Spec: { out, restaurant, ref: "analysis/refs/X.json", from: 0, to: 14.5, minShot: 0.1,
//   curve, brief, version, shots: ["MON-1", { id: "MON-2", speed: 0.5, at: 1.2, reframe }, ...] }
// Cuts closer than minShot are merged. A shot list shorter than the cuts is an error.
import fs from "node:fs";
import path from "node:path";

const spec = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const ref = JSON.parse(fs.readFileSync(spec.ref, "utf8"));
const from = spec.from ?? 0;
const to = spec.to ?? ref.duration;
const minShot = spec.minShot ?? 0.1;

const bounds = [from];
for (const c of ref.cuts) if (c > from + minShot && c < to - minShot && c - bounds.at(-1) >= minShot) bounds.push(c);
bounds.push(to);
const n = bounds.length - 1;
if (spec.shots.length < n) {
  console.error(`${n} shots needed, ${spec.shots.length} given. Shot lengths: ${bounds.slice(1).map((b, i) => (b - bounds[i]).toFixed(2)).join(" ")}`);
  process.exit(1);
}

const cats = {};
const find = (id) => {
  const resto = id.startsWith("SAM") ? "samourai" : "monegasque";
  cats[resto] ??= (() => { const j = JSON.parse(fs.readFileSync(`public/library/${resto}/catalogue.json`, "utf8")); return j.clips || j; })();
  const m = cats[resto].find((x) => x.id === id);
  if (!m) throw new Error(`unknown clip ${id}`);
  return { ...m, src: `library/${resto}/clips/${id}.mp4` };
};
const r2 = (x) => +x.toFixed(3);
const pick = (m, span, preferred) => {
  const max = Math.max(0, m.duration - 0.05 - span);
  const clean = (st) => !(m.wm || []).some(([a, b]) => st < b && st + span > a);
  const p = Math.min(max, Math.max(0, preferred));
  if (clean(p)) return r2(p);
  let best = null;
  for (let st = 0; st <= max + 1e-6; st += 0.02) if (clean(st) && (best == null || Math.abs(st - p) < Math.abs(best - p))) best = st;
  return r2(best ?? p);
};

const used = new Set();
const clips = [];
for (let i = 0; i < n; i++) {
  const s = typeof spec.shots[i] === "string" ? { id: spec.shots[i] } : spec.shots[i];
  if (used.has(s.id) && !s.again) console.warn(`! ${s.id} used twice`);
  used.add(s.id);
  const m = find(s.id);
  const on = bounds[i + 1] - bounds[i];
  const speed = s.speed ?? spec.speed ?? 1;
  const span = Math.min(m.duration - 0.05, on * speed);
  const sp = +(span / on).toFixed(3);
  // Fast shots take the most active middle of the clip by default.
  const st = pick(m, span, s.at ?? (m.duration - span) / 2);
  const c = { label: `#${i + 1} ${m.name}`, src: m.src, start: st, end: r2(st + span), ...(sp !== 1 ? { speed: sp } : {}),
    grade: { curve: s.curve || spec.curve, brightness: s.b ?? 1 } };
  if (s.reframe) c.reframe = s.reframe;
  if (s.letterbox ?? spec.letterbox) c.letterbox = true;
  clips.push(c);
}
const plan = { restaurant: spec.restaurant, format: "vertical", fps: 30, version: spec.version || 1, brief: spec.brief,
  handle: spec.restaurant === "samourai" ? "@samourai_restaurant" : "@lemonegasquedz", clips,
  refAudio: { src: ref.src, from } };
fs.mkdirSync(path.dirname(spec.out), { recursive: true });
fs.writeFileSync(spec.out, JSON.stringify(plan, null, 2));
console.log(`${spec.out}: ${n} plans, ${(to - from).toFixed(2)} s (ref ${path.basename(ref.src)} ${from}-${to})`);

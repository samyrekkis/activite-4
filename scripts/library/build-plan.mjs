// Turns a short spec into an edit plan, with every shot timed on the beat grid.
//   node scripts/library/build-plan.mjs <spec.json>
// Spec: { out, restaurant, bpm, version, brief, handle, curve, letterbox, shots: [
//   { id: "MON-215", beats: 4, speed: 0.8, b: 1.02, sat: 1, at: 0.5, reframe, letterbox,
//     ramp: [2, 3, 0.4],                      // speed ramp: 2 beats at speed 1, then 3 beats at 0.4
//     panels: ["MON-1", "MON-2"], layout }    // split screen
// ] }
// "at" is the in point (default: centred in the clip). Durations are capped by the clip length.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const spec = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const beat = 60 / (spec.bpm || 100);
const cats = {};
const catalogue = (resto) =>
  (cats[resto] ??= (() => {
    const j = JSON.parse(fs.readFileSync(`public/library/${resto}/catalogue.json`, "utf8"));
    return j.clips || j;
  })());
// reverse: plays the clip backwards (a camera pulling back becomes a push in).
// The reversed copy is made once with ffmpeg in public/library/<resto>/rev/.
const reversed = (m) => {
  const resto = m.src.split("/")[1];
  const out = `public/library/${resto}/rev/${m.id}.mp4`;
  if (!fs.existsSync(out)) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", `public/${m.src}`, "-vf", "reverse", "-an", "-c:v", "libx264", "-crf", "17", "-preset", "fast", "-pix_fmt", "yuv420p", out]);
  }
  // Watermark spans mirror in time too.
  return { ...m, src: `library/${resto}/rev/${m.id}.mp4`, wm: (m.wm || []).map(([a, b]) => [r2(m.duration - b), r2(m.duration - a)]) };
};
const find = (id) => {
  const resto = id.startsWith("SAM") ? "samourai" : "monegasque";
  const m = catalogue(resto).find((x) => x.id === id);
  if (!m) throw new Error(`unknown clip ${id}`);
  return { ...m, src: `library/${resto}/clips/${id}.mp4` };
};
const r2 = (x) => +x.toFixed(2);
// In point closest to the preferred one whose [start, start + span] avoids the
// Instagram watermark spans found by scan_watermark.py ("wm" in the catalogue).
const pick = (m, span, preferred) => {
  const max = Math.max(0, m.duration - 0.05 - span);
  const clean = (st) => !(m.wm || []).some(([a, b]) => st < b && st + span > a);
  if (clean(preferred)) return r2(preferred);
  let best = null;
  for (let st = 0; st <= max + 1e-6; st += 0.02) if (clean(st) && (best == null || Math.abs(st - preferred) < Math.abs(best - preferred))) best = st;
  if (best == null) { console.warn(`! ${m.id} watermark in every ${span.toFixed(2)} s window`); return r2(preferred); }
  return r2(best);
};

// autoMirror: flip shots whose sideways camera move goes against the edit main direction
// (never shots with readable signs or letters).
const TEXTY = /néon|lettres|birthday|love|happy|chevalet|enseigne|calligraph|kanji|logo/i;
let mainDir = 0;
const flipIt = (m, s) => {
  if (s.mirror != null) return s.mirror;
  if (!spec.autoMirror || !m.motion) return false;
  const [mx, my] = m.motion;
  if (Math.abs(mx) < 0.12 || Math.abs(mx) < Math.abs(my)) return false;
  if (!mainDir) { mainDir = Math.sign(mx); return false; }
  return Math.sign(mx) !== mainDir && !TEXTY.test(m.name);
};
const clips = [];
let total = 0;
for (const s of spec.shots) {
  const m = s.reverse ? reversed(find(s.id)) : find(s.id);
  const grade = { curve: s.curve || spec.curve, brightness: s.b ?? 1 };
  if (s.sat) grade.saturate = s.sat;
  const base = { grade, ...(s.b ? { gradeAdjust: s.b } : {}) };
  if (s.reframe) base.reframe = s.reframe;
  if (!s.panels && flipIt(m, s)) base.mirror = true;
  if (s.motion) base.motion = s.motion;
  if (s.letterbox ?? spec.letterbox) base.letterbox = true;
  if (s.ramp) {
    const [b1, b2, slow] = s.ramp;
    const span1 = b1 * beat;
    const span2 = b2 * beat * slow;
    const st = pick(m, span1 + span2, s.at ?? Math.max(0, (m.duration - 0.05 - span1 - span2) / 2));
    if (st + span1 + span2 > m.duration - 0.03) console.warn(`! ${s.id} too short for ramp`);
    clips.push({ label: `${m.name} (vitesse réelle)`, src: m.src, start: st, end: r2(st + span1), ...base });
    clips.push({ label: `${m.name} (ralenti)`, src: m.src, start: r2(st + span1), end: r2(st + span1 + span2), speed: slow, ...base });
    total += (b1 + b2) * beat;
    continue;
  }
  const on = s.beats * beat;
  const speed = s.speed ?? 1;
  const span = Math.min(m.duration - 0.05, on * speed);
  const sp = +(span / on).toFixed(3);
  if (sp < speed - 0.02) console.warn(`! ${s.id} short: speed ${speed} -> ${sp}`);
  const st = pick(m, span, s.at ?? (m.duration - span) / 2);
  const clip = { label: m.name, src: m.src, start: st, end: r2(st + span), ...(sp !== 1 ? { speed: sp } : {}), ...base };
  if (s.panels) {
    clip.panels = [s.id, ...s.panels].map((p) => {
      const id = typeof p === "string" ? p : p.id;
      const pm = find(id);
      const pspan = on * sp;
      if (pm.duration - 0.05 < pspan) console.warn(`! panel ${id} short`);
      const pst = pick(pm, pspan, typeof p === "object" && p.at != null ? p.at : Math.max(0, (pm.duration - pspan) / 2));
      return { src: pm.src, start: pst, ...(sp !== 1 ? { speed: sp } : {}), ...(p.position ? { position: p.position } : {}) };
    });
    clip.layout = s.layout || "rows";
    clip.stagger = s.stagger ?? 0;
    clip.label = `split : ${[m.name, ...s.panels.map((p) => find(typeof p === "string" ? p : p.id).name)].join(" / ")}`;
  }
  clips.push(clip);
  total += on;
}
clips.forEach((c, i) => (c.label = `#${i + 1}${i === 0 ? " HOOK" : ""} ${c.label}`));
const plan = {
  restaurant: spec.restaurant,
  format: "vertical",
  fps: 30,
  version: spec.version || 1,
  brief: spec.brief,
  handle: spec.handle || (spec.restaurant === "samourai" ? "@samourai_restaurant" : "@lemonegasquedz"),
  clips,
};
fs.mkdirSync(path.dirname(spec.out), { recursive: true });
fs.writeFileSync(spec.out, JSON.stringify(plan, null, 2));
console.log(`${spec.out}: ${clips.length} plans, ${total.toFixed(1)} s`);

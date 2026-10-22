// Spec for ref-plan.mjs that follows a reference's cuts with shots chosen from the whole
// library in the order of a visit (arrival, room, people and tradition, table and kitchen,
// dishes, a last wide shot), so the edit tells something instead of jumping around.
// Shots already taken by this batch (TAKEN file) are never reused; shots seen in kept
// videos (KEEP = plan names) are only used when nothing else fits.
//   node scripts/library/story_plan.mjs <name> <restaurant> <ref.json> <from> <to> <minShot> <curve> <letterbox 0|1>
import fs from "node:fs";
const [name, resto, ref, from, to, minShot, curve, letterbox] = process.argv.slice(2);
const r = JSON.parse(fs.readFileSync(ref, "utf8"));
const bounds = [+from];
for (const x of r.cuts) if (x > +from + +minShot && x < +to - +minShot && x - bounds.at(-1) >= +minShot) bounds.push(x);
bounds.push(+to);
const n = bounds.length - 1;
const cat = JSON.parse(fs.readFileSync(`public/library/${resto}/catalogue.json`, "utf8")).clips;
// Logos, children and shots the client rejected.
const LOGOS = ["SAM-003", "SAM-005", "SAM-055", "SAM-070", "SAM-039", "SAM-112", "SAM-101", "SAM-243", "SAM-255", "SAM-049",
  "SAM-030", "SAM-032", "SAM-033", "SAM-038", "SAM-050", "SAM-069", "SAM-071", "SAM-068", "SAM-048", "SAM-051", "SAM-052",
  "MON-092", "MON-096", "MON-233", "MON-278", "MON-156", "MON-269", "MON-244", "MON-236", "MON-237", "MON-238", "MON-214", "MON-253"];
const takenFile = process.env.TAKEN || `out/taken-${resto}.json`;
const taken = new Set(fs.existsSync(takenFile) ? JSON.parse(fs.readFileSync(takenFile, "utf8")) : []);
const seen = new Set();
for (const k of (process.env.KEEP || "").split(",").filter(Boolean)) {
  const p = `edits/copies/${k}.json`;
  if (fs.existsSync(p)) for (const c of JSON.parse(fs.readFileSync(p, "utf8")).clips) { const id = /(MON|SAM)-\d+/.exec(c.src)?.[0]; if (id) seen.add(id); }
}
const stage = (p) => p < 0.08 ? ["exterieur", "salle"] : p < 0.3 ? ["salle", "deco"] : p < 0.45 ? ["personnes", "deco"]
  : p < 0.65 ? ["table", "cuisine", "geste"] : p < 0.92 ? ["plat", "dessert", "boisson", "geste"] : ["salle", "plat", "table"];
// Stable pseudo-random order per video, so two videos don't pick the same "best" shots.
let seed = [...name].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
const pool = cat.filter((m) => (m.quality ?? 2) >= 2 && !LOGOS.includes(m.id) && !/noir et blanc/.test(m.name)).map((m) => ({ m, k: rnd() }));
const shots = [];
for (let i = 0; i < n; i++) {
  const len = bounds[i + 1] - bounds[i];
  const want = stage((i + 0.5) / n);
  const fits = (m) => !taken.has(m.id) && m.duration >= len + 0.15;
  const score = (x) => (want.indexOf(x.m.category) >= 0 ? 10 - want.indexOf(x.m.category) * 2 : 0) + (x.m.quality ?? 2) * 2 - (seen.has(x.m.id) ? 6 : 0) + x.k * 3;
  const best = pool.filter((x) => fits(x.m)).sort((a, b) => score(b) - score(a))[0];
  if (!best) throw new Error(`${name}: no shot left for slot ${i} (${len.toFixed(2)} s)`);
  taken.add(best.m.id);
  const room = Math.max(0, best.m.duration - len - 0.08);
  shots.push({ id: best.m.id, at: +(room * (0.2 + 0.6 * rnd())).toFixed(2) });
}
fs.writeFileSync(takenFile, JSON.stringify([...taken]));
const spec = {
  out: `edits/copies/${name}.json`, restaurant: resto, ref, from: +from, to: +to, minShot: +minShot, curve, version: 1, copyZoom: true,
  ...(letterbox === "1" ? { letterbox: true } : {}),
  brief: `Montage sur les coupes et la chanson de ${ref.split("/").pop()}, plans dans l'ordre d'une visite (arrivée, salle, ambiance, table, plats, fin). Aucun texte.`,
  shots,
};
fs.writeFileSync(`edits/specs/copies/${name}.json`, JSON.stringify(spec, null, 1));
console.log(`${name}: ${n} plans -> ${shots.map((s) => s.id).join(" ")}`);

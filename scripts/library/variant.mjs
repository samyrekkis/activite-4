// Builds a "variant" of already delivered copies: the same shots, recut on another
// reference (other rhythm, other song), shown from another part of each clip, with
// another look (cinema bars, other curve). Followers see a new video.
//   node scripts/library/variant.mjs <name> <ref.json> <from> <to> <minShot> <refCrop|-> <curve> <letterbox 0|1> <source plan>...
// Writes edits/specs/copies/<name>.json for ref-plan.mjs.
import fs from "node:fs";

const [name, ref, from, to, minShot, refCrop, curve, letterbox, ...sources] = process.argv.slice(2);
const r = JSON.parse(fs.readFileSync(ref, "utf8"));
const bounds = [+from];
for (const x of r.cuts) if (x > +from + +minShot && x < +to - +minShot && x - bounds.at(-1) >= +minShot) bounds.push(x);
bounds.push(+to);
const n = bounds.length - 1;

// Logo table sets the client rejected.
const EXCLUDE = ["SAM-003", "SAM-005", "SAM-055", "SAM-070", "SAM-039", "SAM-112", "SAM-101", "SAM-243"];
// Shots of the source videos, in their (logical) order, without the mosaic placeholder.
const ids = [];
for (const s of sources) {
  const j = JSON.parse(fs.readFileSync(s, "utf8"));
  for (const c of j.clips) {
    if (c.mosaic) continue;
    const id = /(MON|SAM)-\d+/.exec(c.src)?.[0];
    if (id && !ids.includes(id) && !EXCLUDE.includes(id)) ids.push(id);
  }
}
if (ids.length < n) throw new Error(`${name}: ${n} shots needed, ${ids.length} available`);
// Spread the pick over the whole list so the variant keeps the visit order.
const step = ids.length / n;
const shots = Array.from({ length: n }, (_, i) => ids[Math.floor(i * step)]);
const restaurant = shots[0].startsWith("SAM") ? "samourai" : "monegasque";
const cat = JSON.parse(fs.readFileSync(`public/library/${restaurant}/catalogue.json`, "utf8")).clips;
const spec = {
  out: `edits/copies/${name}.json`, restaurant, ref, from: +from, to: +to, minShot: +minShot, curve, version: 1, copyZoom: true,
  ...(refCrop !== "-" ? { refCrop } : {}), ...(letterbox === "1" ? { letterbox: true } : {}),
  brief: `Variante cinéma : mêmes lieux que des vidéos déjà publiées, recoupés sur un autre edit de référence (${ref.split("/").pop()}), autre chanson, autre moment de chaque plan, look ${curve}${letterbox === "1" ? " avec bandes cinéma" : ""}. Aucun texte, aucune carte de fin.`,
  // Show the end of each clip (the first copies showed its middle).
  shots: shots.map((id, i) => {
    const m = cat.find((x) => x.id === id);
    const len = bounds[i + 1] - bounds[i];
    // The OYUA reference is a sped-up tour: keep its accelerations.
    const sp = /OYUA/.test(ref) ? [1.88, 2.12, 2.12, 2.2, 1.08, 1.04, 1.04, 1.1, 1.1, 1.31][i] : 1;
    // AT=start shows the beginning of each clip instead (a third, different moment).
    const at = process.env.AT === "start" ? 0.1 : Math.max(0, +(m.duration - len * sp - 0.08).toFixed(2));
    return { id, ...(sp !== 1 ? { speed: sp } : {}), at };
  }),
};
fs.writeFileSync(`edits/specs/copies/${name}.json`, JSON.stringify(spec, null, 1));
console.log(`${name}: ${n} plans from ${ids.length} (${sources.map((s) => s.split("/").pop()).join(", ")})`);

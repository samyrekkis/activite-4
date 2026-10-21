// Removes a rejected shot (child, logo…) from a plan without changing its length: the
// previous shot plays longer (or the next one starts earlier if the clip is too short).
//   node scripts/library/drop_shot.mjs <plan.json> <clip id>
import fs from "node:fs";
const [p, id] = process.argv.slice(2);
const j = JSON.parse(fs.readFileSync(p, "utf8"));
const cat = JSON.parse(fs.readFileSync(`public/library/${j.restaurant}/catalogue.json`, "utf8")).clips;
const dur = (c) => cat.find((m) => c.src.endsWith(`${m.id}.mp4`)).duration;
let i;
while ((i = j.clips.findIndex((c) => c.src.endsWith(`${id}.mp4`))) >= 0) {
  const c = j.clips[i], d = (c.end - c.start) / (c.speed ?? 1);
  const prev = j.clips[i - 1], next = j.clips[i + 1];
  if (prev && !prev.mosaic && prev.end + d * (prev.speed ?? 1) <= dur(prev) - 0.05) prev.end = +(prev.end + d * (prev.speed ?? 1)).toFixed(3);
  else if (next && next.start - d * (next.speed ?? 1) >= 0) next.start = +(next.start - d * (next.speed ?? 1)).toFixed(3);
  else if (prev && !prev.mosaic) { prev.speed = +((prev.end - prev.start) / ((prev.end - prev.start) / (prev.speed ?? 1) + d)).toFixed(3); }
  else throw new Error(`${p}: cannot fill ${id}`);
  j.clips.splice(i, 1);
  console.log(`${p}: ${id} removed`);
}
j.clips.forEach((c, k) => (c.label = c.label.replace(/^#\d+/, `#${k + 1}`)));
j.version++;
fs.writeFileSync(p, JSON.stringify(j, null, 2));

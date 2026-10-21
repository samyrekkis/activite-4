// Replaces the grade of every shot of a plan with one look chosen with the client
// (e.g. Samouraï "lumiere": brighter, softer reds). Keeps black-and-white flashes.
//   node scripts/library/regrade.mjs <plan.json> <curve> <brightness> <contrast> <saturate>
import fs from "node:fs";
const [p, curve, b, c, s] = process.argv.slice(2);
const j = JSON.parse(fs.readFileSync(p, "utf8"));
for (const clip of j.clips) {
  const bw = clip.grade?.saturate === 0;
  clip.grade = { curve, brightness: +b, contrast: +c, saturate: bw ? 0 : +s };
}
j.version = Math.max(j.version + 1, 300);
fs.writeFileSync(p, JSON.stringify(j, null, 2));
console.log(`${p}: ${curve} v${j.version}`);

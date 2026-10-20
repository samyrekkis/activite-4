// Shot matching, like a colourist's first pass: brings every clip of a plan to
// the same exposure (catalogue brightness), so no shot looks darker or paler
// than its neighbours. Writes grade.brightness on each clip (theme value x factor).
//   node scripts/library/match-shots.mjs edits/models/<plan>.json [--strength 0.35]
import { readFileSync, writeFileSync } from "node:fs";

const [planPath, ...rest] = process.argv.slice(2);
const strength = rest.includes("--strength") ? Number(rest[rest.indexOf("--strength") + 1]) : 0.35;
const plan = JSON.parse(readFileSync(planPath, "utf8"));
const catalogue = JSON.parse(readFileSync(`public/library/${plan.restaurant}/catalogue.json`, "utf8")).clips;
const bySrc = new Map(catalogue.map((c) => [c.src, c]));
const themeBrightness = plan.restaurant === "monegasque" ? 1.04 : 1.0; // src/themes.ts

const levels = plan.clips.map((c) => (c.panels ? null : bySrc.get(c.src.replace("/rev/", "/clips/"))?.brightness ?? null));
const known = levels.filter((b) => b !== null).sort((a, b) => a - b);
const target = known[Math.floor(known.length / 2)];
plan.clips.forEach((c, i) => {
  const b = levels[i];
  if (b === null) return;
  // Partial correction (strength) and limits: matching, not flattening.
  const factor = Math.min(1.25, Math.max(0.85, Math.pow(target / b, strength)));
  // gradeAdjust: a deliberate trim from the spec (build-plan.mjs "b"), kept on top of the matching.
  c.grade = { ...c.grade, brightness: Math.round(themeBrightness * factor * (c.gradeAdjust ?? 1) * 100) / 100 };
});
writeFileSync(planPath, JSON.stringify(plan, null, 2) + "\n");
console.log(plan.clips.map((c, i) => `${c.label.slice(0, 40).padEnd(40)} ${levels[i] ?? "-"} -> ${c.grade?.brightness ?? "-"}`).join("\n"));

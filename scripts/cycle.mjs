// Usage: npm run cycle -- edits/plan.json [--ref public/refs/exemple.mp4] [--preview]
// One quality cycle: render the current version of the plan, then have Gemini
// critique it. Claude reads reviews/<plan>-vN.json, writes version N+1, repeats
// (3 cycles by default, see CLAUDE.md).
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const planPath = args.find((a) => a.endsWith(".json"));
if (!planPath) {
  console.error("Usage: npm run cycle -- edits/plan.json [--ref public/refs/exemple.mp4] [--preview]");
  process.exit(1);
}
const plan = JSON.parse(readFileSync(planPath, "utf8"));
const preview = args.includes("--preview");
const video = `out/${basename(planPath, ".json")}-v${plan.version ?? 1}${preview ? "-preview" : ""}.mp4`;
const refIdx = args.indexOf("--ref");

const step = (script, scriptArgs) => {
  const r = spawnSync("node", [script, ...scriptArgs], { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

console.log(`=== Cycle v${plan.version ?? 1} : ${planPath} ===\n`);
step("scripts/render.mjs", [planPath, ...(preview ? ["--preview"] : [])]);
step("scripts/gemini-review.mjs", [video, planPath, ...(refIdx >= 0 ? ["--ref", args[refIdx + 1]] : [])]);

// Gemini watches every rendered plan of a restaurant and gives it a mark.
//   npm run edits:review -- --resto monegasque [--only 03,07]
// Writes reviews/<plan>-vN.json (see scripts/gemini-review.mjs) and prints one line per plan.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const flag = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const resto = flag("--resto");
const only = flag("--only");
if (!resto) {
  console.error("Usage: npm run edits:review -- --resto monegasque|samourai [--only 03,07]");
  process.exit(1);
}
const plans = readdirSync("edits/auto")
  .filter((f) => f.startsWith(`${resto}-`) && f.endsWith(".json"))
  .filter((f) => !only || only.split(",").includes(f.split("-")[1]))
  .sort();
for (const file of plans) {
  const name = file.replace(/\.json$/, "");
  const version = JSON.parse(readFileSync(`edits/auto/${file}`, "utf8")).version ?? 1;
  const video = `out/${name}-v${version}.mp4`;
  if (!existsSync(video)) {
    console.log(`${name} : pas de rendu, ignoré`);
    continue;
  }
  spawnSync(process.execPath, ["scripts/gemini-review.mjs", video, `edits/auto/${file}`], { stdio: "ignore" });
  const review = `reviews/${name}-v${version}.json`;
  if (!existsSync(review)) {
    console.log(`${name} : ÉCHEC de la critique`);
    continue;
  }
  const r = JSON.parse(readFileSync(review, "utf8"));
  const issues = (r.problemes ?? r.issues ?? []).filter((p) => /bloquant|important/.test(p.gravite ?? p.severity ?? ""));
  console.log(`${name} : ${r.note ?? r.score}/10, fluidité ${r.fluidityScore ?? "?"}/10 (${r.verdict ?? ""}), ${issues.length} problèmes importants`);
}

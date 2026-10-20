// Renders every generated plan of a restaurant and files the videos for the user.
//   npm run edits:render -- --resto monegasque [--dest "C:/Users/moi/OneDrive/Bureau/Studio Resto/Montages"] [--preview] [--force]
// Output: <dest>/<Resto>/<nn> - <recette> (<look>, <finition>).mp4 ; plans already
// rendered (same file name) are skipped, so the command can be re-run after a crash.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const args = process.argv.slice(2);
const flag = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const resto = flag("--resto");
const dest = flag("--dest", "C:/Users/hp/OneDrive/Bureau/Studio Resto/Montages");
const preview = args.includes("--preview");
const force = args.includes("--force"); // re-render and replace videos already filed
if (!resto) {
  console.error("Usage: npm run edits:render -- --resto monegasque|samourai [--dest dossier] [--preview]");
  process.exit(1);
}
const TITLES = {
  rafale: "Rafale gourmande", visite: "La visite", jourNuit: "Du jour à la nuit", degrade: "Dégradé de couleurs",
  lent: "Gros plans lents", pingPong: "Ping-pong", crescendo: "Crescendo", unGeste: "Un seul geste",
  tablePleine: "La table se remplit", zoomChaine: "Zoom en chaîne", ambiance: "Ambiance", ascenseur: "Ascenseur",
  travelling: "Travelling", carrousel: "Carrousel de transitions", nuitElectrique: "Nuit électrique",
};
const folder = join(dest, resto === "monegasque" ? "Monegasque" : "Samourai");
mkdirSync(folder, { recursive: true });

const only = flag("--only"); // comma-separated plan numbers, e.g. "03,07"
const plans = readdirSync("edits/auto")
  .filter((f) => f.startsWith(`${resto}-`) && f.endsWith(".json"))
  .filter((f) => !only || only.split(",").includes(f.split("-")[1]))
  .sort();
for (const file of plans) {
  const plan = JSON.parse(readFileSync(`edits/auto/${file}`, "utf8"));
  const t = plan.template ?? {};
  const nn = file.split("-")[1];
  const nice = `${nn} - ${TITLES[t.recette] ?? t.recette} (${t.look}, ${t.finition}).mp4`;
  const target = join(folder, nice);
  if (existsSync(target) && !force) {
    console.log(`déjà fait : ${nice}`);
    continue;
  }
  // Two attempts: the headless browser sometimes times out when the PC is busy.
  let ok = false;
  for (let attempt = 1; attempt <= 2 && !ok; attempt++) {
    const r = spawnSync(process.execPath, ["scripts/render.mjs", `edits/auto/${file}`, ...(preview ? ["--preview"] : [])], {
      stdio: ["ignore", "ignore", "inherit"],
    });
    ok = r.status === 0;
  }
  const out = `out/${file.replace(/\.json$/, "")}-v${plan.version ?? 1}${preview ? "-preview" : ""}.mp4`;
  if (!ok || !existsSync(out)) {
    console.error(`ÉCHEC : ${file}`);
    continue;
  }
  copyFileSync(out, target);
  console.log(`OK : ${nice}`);
}

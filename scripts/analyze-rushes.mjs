// Usage: npm run analyze:rushes [-- public/rushes/monresto] [--every 1]
// For every rush: metadata, scene changes, and a timestamped contact sheet so
// Claude can pick in/out points precisely.
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import { detectScenes, probe } from "./lib/media.mjs";
import { contactSheet } from "./lib/contact-sheet.mjs";

const args = process.argv.slice(2);
const root = args.find((a) => !a.startsWith("--")) ?? "public/rushes";
const everyIdx = args.indexOf("--every");
const every = everyIdx >= 0 ? Number(args[everyIdx + 1]) : null;
const VIDEO = /\.(mp4|mov|m4v|mkv|webm)$/i;

const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : VIDEO.test(f) ? [p] : [];
  });

const files = walk(root);
if (!files.length) {
  console.error(`Aucune vidéo dans ${root}/`);
  process.exit(1);
}
mkdirSync("analysis/rushes", { recursive: true });
const index = [];
for (const file of files) {
  const info = await probe(file);
  const step = every ?? Math.max(0.5, Math.min(2, info.duration / 16));
  const times = [];
  for (let t = 0.05; t < info.duration; t += step) times.push(Math.round(t * 100) / 100);
  const scenes = await detectScenes(file, 0.25);
  const name = basename(file, extname(file));
  const sheets = [];
  for (let i = 0; i < times.length; i += 20) {
    sheets.push(await contactSheet(file, times.slice(i, i + 20), `analysis/rushes/${name}-${sheets.length + 1}.jpg`, { cols: 5 }));
  }
  index.push({ src: relative("public", file), ...info, sampleEvery: step, sceneChanges: scenes, contactSheets: sheets });
  console.log(`${file} : ${info.duration.toFixed(1)} s, ${info.width}x${info.height}, ${scenes.length} changements -> ${sheets.join(", ")}`);
}
writeFileSync("analysis/rushes/index.json", JSON.stringify(index, null, 2));
console.log("\nIndex : analysis/rushes/index.json");

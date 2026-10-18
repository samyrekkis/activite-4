// Usage: npm run import:local -- <dossier ou fichiers…> --to rushes/samourai
// Imports videos and photos straight from the user's computer (any size):
// videos are re-encoded for Remotion into public/<dest>/, photos (HEIC, JPG,
// PNG) are converted to upright JPGs into public/<dest>/photos/.
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { normalizeVideo } from "./lib/normalize.mjs";
import { run } from "./lib/media.mjs";

const args = process.argv.slice(2);
const toIdx = args.indexOf("--to");
const dest = toIdx >= 0 ? args[toIdx + 1] : null;
const sources = args.filter((a, i) => !a.startsWith("--") && i !== toIdx + 1);
if (!dest || !sources.length) {
  console.error('Usage: npm run import:local -- "C:/Users/moi/Downloads/samourai" --to rushes/samourai');
  process.exit(1);
}

const VIDEO = /\.(mov|mp4|m4v|mkv|webm|avi)$/i;
const PHOTO = /\.(heic|heif|jpe?g|png)$/i;
const files = sources.flatMap((src) =>
  statSync(src).isDirectory() ? readdirSync(src).map((f) => join(src, f)) : [src],
);
const videos = files.filter((f) => VIDEO.test(f));
const photos = files.filter((f) => PHOTO.test(f));
if (!videos.length && !photos.length) {
  console.error("Aucune vidéo ni photo trouvée.");
  process.exit(1);
}

const outDir = `public/${dest}`;
mkdirSync(outDir, { recursive: true });
for (const file of videos) {
  const out = `${outDir}/${basename(file, extname(file))}.mp4`;
  if (existsSync(out)) {
    console.log(`${out} existe déjà, ignoré.`);
    continue;
  }
  console.log(`${basename(file)} : conversion…`);
  const info = await normalizeVideo(file, out);
  console.log(`  -> ${out} (${info.width}x${info.height}, ${info.duration.toFixed(1)} s)`);
}

if (photos.length) {
  // One staging folder per source folder, so convert-photos.py handles HEIC orientation.
  const dirs = [...new Set(photos.map((p) => join(p, "..")))];
  for (const dir of dirs) {
    const python = process.platform === "win32" ? "python" : "python3";
    const { stdout } = await run(python, ["scripts/convert-photos.py", dir, `${outDir}/photos`]);
    process.stdout.write(stdout);
  }
}
console.log(`\n${videos.length} vidéo(s) et ${photos.length} photo(s) importées dans ${outDir}/. Étape suivante : npm run analyze:rushes -- ${outDir}`);

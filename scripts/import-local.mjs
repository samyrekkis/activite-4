// Usage: npm run import:local -- <dossier ou fichiers du PC> <dest>
//   npm run import:local -- "C:\Users\Samy\Videos\Samourai" rushes/samourai
//   npm run import:local -- ~/Downloads/ScreenRecording.mp4 refs
// Videos (MOV, MP4, M4V…) are normalized for Remotion (H.264, 30 fps, 1080 px).
// Photos (JPG, PNG, HEIC) go to public/photos/<dest name>, upright and resized.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { normalizeVideo } from "./lib/media.mjs";

const VIDEO = /\.(mov|mp4|m4v|mkv|webm|avi)$/i;
const PHOTO = /\.(jpe?g|png|heic|heif)$/i;

const args = process.argv.slice(2);
const dest = args.pop();
if (!dest || !args.length) {
  console.error('Usage: npm run import:local -- "<dossier ou fichier>" [...] rushes/samourai | rushes/monegasque | refs');
  process.exit(1);
}

const files = args.flatMap((p) => {
  if (!existsSync(p)) {
    console.error(`Introuvable : ${p}`);
    return [];
  }
  return statSync(p).isDirectory() ? readdirSync(p).sort().map((f) => join(p, f)) : [p];
});

const videoDir = `public/${dest}`;
const photoDir = `public/photos/${basename(dest)}`;
const photos = [];

for (const file of files) {
  const name = basename(file, extname(file));
  if (VIDEO.test(file)) {
    mkdirSync(videoDir, { recursive: true });
    const out = `${videoDir}/${name}.mp4`;
    if (existsSync(out)) {
      console.log(`${out} existe déjà, ignoré.`);
      continue;
    }
    console.log(`${basename(file)} : conversion…`);
    const info = await normalizeVideo(file, out);
    console.log(`  -> ${out} (${info.width}x${info.height}, ${info.duration.toFixed(1)} s)`);
  } else if (PHOTO.test(file)) {
    photos.push(file);
  }
}

if (photos.length) {
  // Reuse the HEIC-aware converter; it needs pillow + pillow-heif (pip install pillow pillow-heif).
  const staging = "public/.raw/photos";
  mkdirSync(staging, { recursive: true });
  for (const p of photos) copyFileSync(p, join(staging, basename(p)));
  const python = process.platform === "win32" ? "python" : "python3";
  const r = spawnSync(python, ["scripts/convert-photos.py", staging, photoDir], { stdio: "inherit" });
  if (r.status !== 0) console.error("Photos non converties : installe Python puis `pip install pillow pillow-heif`.");
}

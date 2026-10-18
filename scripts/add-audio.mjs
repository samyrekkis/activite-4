// Adds sounds or music the user downloaded himself (Pixabay, Mixkit, Uppbeat…).
//   npm run audio:add -- "C:/Users/moi/Downloads/whoosh.mp3" --source "Pixabay" --license "Pixabay Content License"
//   npm run audio:add -- "C:/Users/moi/Downloads/musiques" --music --source "YouTube Audio Library" --license "Libre de droits"
// Each file is trimmed, loudness-normalized and registered with its licence
// (public/sfx|music/library.json + LICENSES.md). Music also gets its BPM.
import { readdirSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { looksSynthetic, masterAudio, register, slug } from "./lib/audio.mjs";

const args = process.argv.slice(2);
const flag = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const type = args.includes("--music") ? "music" : "sfx";
const source = flag("--source");
const license = flag("--license");
const valueIdx = new Set(["--source", "--license"].map((f) => args.indexOf(f) + 1).filter((i) => i > 0));
const inputs = args.filter((a, i) => !a.startsWith("--") && !valueIdx.has(i));
if (!inputs.length || !source || !license) {
  console.error('Usage: npm run audio:add -- <fichiers ou dossier> [--music] --source "Pixabay" --license "Pixabay Content License"');
  process.exit(1);
}
const AUDIO = /\.(mp3|wav|m4a|aac|ogg|flac|aiff?)$/i;
const files = inputs.flatMap((p) => (statSync(p).isDirectory() ? readdirSync(p).map((f) => join(p, f)) : [p])).filter((f) => AUDIO.test(f));

for (const file of files) {
  const name = basename(file, extname(file));
  if (looksSynthetic([], name)) console.warn(`Attention : "${name}" a l'air synthétique. Vérifie à l'écoute que c'est un vrai enregistrement.`);
  const src = `${type}/${slug(name)}.mp3`;
  const meta = await masterAudio(file, `public/${src}`, { type });
  register(type, { src, name, ...meta, license, source });
  console.log(`${src}  ${meta.duration}s${meta.bpm ? `  ~${meta.bpm} BPM (1 temps = ${(60 / meta.bpm).toFixed(3)} s)` : ""}`);
}

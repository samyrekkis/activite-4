// Usage: npm run import -- <dest> <fileId>:<name> [<fileId>:<name> …]
//   dest: "rushes/samourai", "rushes/monegasque" or "refs"
// Downloads files shared as "anyone with the link" from Google Drive, then
// normalizes them for Remotion: H.264, 30 fps, max 1080 px wide, sound kept.
// (File IDs come from the Drive folder listing; Claude fetches them with the Drive connector.)
import { createWriteStream, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { basename, extname } from "node:path";
import { probe, run } from "./lib/media.mjs";

const [dest, ...items] = process.argv.slice(2);
if (!dest || !items.length) {
  console.error("Usage: npm run import -- rushes/samourai <fileId>:<nom> [...]");
  process.exit(1);
}
const outDir = `public/${dest}`;
const rawDir = "public/.raw";
mkdirSync(outDir, { recursive: true });
mkdirSync(rawDir, { recursive: true });

for (const item of items) {
  const [id, name = id] = item.split(":");
  const stem = basename(name, extname(name));
  const out = `${outDir}/${stem}.mp4`;
  if (existsSync(out)) {
    console.log(`${out} existe déjà, ignoré.`);
    continue;
  }
  const raw = `${rawDir}/${id}${extname(name) || ".mov"}`;
  const res = await fetch(`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`);
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || type.includes("text/html")) {
    console.error(`${name} : téléchargement refusé (HTTP ${res.status}). Le fichier est-il partagé « Tous les utilisateurs disposant du lien » ?`);
    continue;
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(raw));
  console.log(`${name} : ${(statSync(raw).size / 1e6).toFixed(1)} Mo téléchargés, conversion…`);

  const info = await probe(raw);
  const portrait = (info.height ?? 0) >= (info.width ?? 0);
  await run("ffmpeg", [
    "-y", "-i", raw,
    "-vf", `${portrait ? "scale=1080:-2" : "scale=-2:1080"}:flags=lanczos,fps=30,format=yuv420p`,
    "-c:v", "libx264", "-preset", "medium", "-crf", "18",
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
    out,
  ]);
  rmSync(raw);
  const final = await probe(out);
  console.log(`  -> ${out} (${final.width}x${final.height}, ${final.duration.toFixed(1)} s)`);
}

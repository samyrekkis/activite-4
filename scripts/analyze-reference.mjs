// Usage: npm run analyze:ref -- public/refs/exemple.mp4
// Extracts the "DNA" of a reference edit: cut rhythm, shot lengths, tempo,
// beat sync, plus contact sheets (one frame per shot) for Claude to look at.
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { analyzeAudio, detectScenes, probe } from "./lib/media.mjs";
import { contactSheet } from "./lib/contact-sheet.mjs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run analyze:ref -- public/refs/exemple.mp4");
  process.exit(1);
}
const name = basename(file, extname(file));
const dir = `analysis/ref-${name}`;
mkdirSync(dir, { recursive: true });

const info = await probe(file);
const cuts = await detectScenes(file, 0.3);
const bounds = [0, ...cuts, info.duration];
const shots = bounds.slice(0, -1).map((start, i) => ({
  index: i + 1,
  start: Math.round(start * 100) / 100,
  end: Math.round(bounds[i + 1] * 100) / 100,
  length: Math.round((bounds[i + 1] - start) * 100) / 100,
}));
const lengths = shots.map((s) => s.length).sort((a, b) => a - b);
const audio = info.hasAudio ? await analyzeAudio(file) : { onsets: [], bpm: null };

// How many cuts land within 80 ms of a musical onset: tells us if the edit is beat-synced.
const synced = cuts.filter((c) => audio.onsets.some((o) => Math.abs(o - c) < 0.08)).length;

const report = {
  file,
  ...info,
  aspect: info.width && info.height ? (info.width / info.height).toFixed(3) : null,
  shotCount: shots.length,
  avgShotLength: Math.round((info.duration / shots.length) * 100) / 100,
  medianShotLength: lengths[Math.floor(lengths.length / 2)],
  shortestShot: lengths[0],
  longestShot: lengths.at(-1),
  cutsPerSecond: Math.round((cuts.length / info.duration) * 100) / 100,
  music: { bpm: audio.bpm, beatSec: audio.bpm ? Math.round((60 / audio.bpm) * 1000) / 1000 : null },
  beatSyncRatio: cuts.length ? Math.round((synced / cuts.length) * 100) / 100 : null,
  shots,
  onsets: audio.onsets,
};

// One frame in the middle of every shot, 16 per sheet.
const mids = shots.map((s) => (s.start + s.end) / 2);
const sheets = [];
for (let i = 0; i < mids.length; i += 16) {
  sheets.push(await contactSheet(file, mids.slice(i, i + 16), `${dir}/shots-${sheets.length + 1}.jpg`));
}
report.contactSheets = sheets;
writeFileSync(`${dir}/report.json`, JSON.stringify(report, null, 2));

console.log(`Référence : ${file}`);
console.log(`  ${info.width}x${info.height} @ ${info.fps} fps, ${info.duration.toFixed(1)} s`);
console.log(`  ${shots.length} plans, moyenne ${report.avgShotLength} s (min ${report.shortestShot}, max ${report.longestShot})`);
console.log(`  Musique ~${audio.bpm ?? "?"} BPM, coupes sur le beat : ${Math.round((report.beatSyncRatio ?? 0) * 100)} %`);
console.log(`  Rapport : ${dir}/report.json`);
console.log(`  Planches : ${sheets.join(", ")}`);

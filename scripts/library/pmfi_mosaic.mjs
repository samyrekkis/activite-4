// Adds the opening 3x3 mosaic of the PMFI3044 copy (black and white cells appearing one by
// one, then turning to colour one by one) in front of the plan built by ref-plan.mjs.
//   node scripts/library/pmfi_mosaic.mjs <plan.json>
import fs from "node:fs";
const p = process.argv[2];
const j = JSON.parse(fs.readFileSync(p, "utf8"));
const cat = JSON.parse(fs.readFileSync("public/library/monegasque/catalogue.json", "utf8")).clips;
const cells = JSON.parse(fs.readFileSync("out/allocation.json", "utf8"))["monegasque-pmfi-mosaic"].map((s) => s.id.slice(4));
// Instants measured on the reference (seconds).
const appear = [0.2, 0.6, 1.0, 1.2, 1.4, 1.8, 2.0, 2.4, 2.6];
const color = [3.0, 3.4, 3.6, 3.8, 4.0, 4.2, 4.8, 5.0, 5.2];
const mosaic = { cols: 3, rows: 3, gap: 0, cells: cells.map((n, i) => {
  const m = cat.find((x) => x.id === `MON-${n}`);
  const speed = Math.min(1, +((m.duration - 0.1) / (5.6 - appear[i])).toFixed(3));
  return { src: `library/monegasque/clips/MON-${n}.mp4`, start: 0.05, speed, appear: appear[i], color: color[i] };
}) };
j.clips = j.clips.filter((c) => !c.mosaic);
j.clips.unshift({ label: "#0 mosaïque 3x3 noir et blanc puis couleur", src: "library/monegasque/clips/MON-185.mp4", start: 0, end: 5.6, grade: { brightness: 1 }, mosaic });
j.clips.forEach((c, i) => (c.label = c.label.replace(/^#\d+/, `#${i + 1}`)));
j.refAudio.from = 0;
fs.writeFileSync(p, JSON.stringify(j, null, 2));
console.log(`${p}: mosaic + ${j.clips.length - 1} shots`);

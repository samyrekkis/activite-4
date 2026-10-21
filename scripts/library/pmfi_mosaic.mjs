// Adds the opening 3x3 mosaic of the PMFI3044 copy (black and white cells appearing one by
// one, then turning to colour one by one) in front of the plan built by ref-plan.mjs.
//   node scripts/library/pmfi_mosaic.mjs <plan.json> [MON-1,MON-2,… | allocation key]
import fs from "node:fs";
const p = process.argv[2];
const j = JSON.parse(fs.readFileSync(p, "utf8"));
// Cells: a list of clip ids, or the name of a group in out/allocation.json (default: Monégasque's).
const arg = process.argv[3] || "monegasque-pmfi-mosaic";
const ids = /^(MON|SAM)-/.test(arg) ? arg.split(",") : JSON.parse(fs.readFileSync("out/allocation.json", "utf8"))[arg].map((s) => s.id);
const resto = ids[0].startsWith("SAM") ? "samourai" : "monegasque";
const cat = JSON.parse(fs.readFileSync(`public/library/${resto}/catalogue.json`, "utf8")).clips;
// Instants measured on the reference (seconds).
const appear = [0.2, 0.6, 1.0, 1.2, 1.4, 1.8, 2.0, 2.4, 2.6];
const color = [3.0, 3.4, 3.6, 3.8, 4.0, 4.2, 4.8, 5.0, 5.2];
const mosaic = { cols: 3, rows: 3, gap: 0, cells: ids.map((id, i) => {
  const m = cat.find((x) => x.id === id);
  const speed = Math.min(1, +((m.duration - 0.1) / (5.6 - appear[i])).toFixed(3));
  return { src: `library/${resto}/clips/${id}.mp4`, start: 0.05, speed, appear: appear[i], color: color[i] };
}) };
j.clips = j.clips.filter((c) => !c.mosaic);
// The clip only sets the mosaic's length (5.6 s); any long clip of the restaurant will do.
const holder = resto === "samourai" ? "SAM-058" : "MON-185";
j.clips.unshift({ label: "#0 mosaïque 3x3 noir et blanc puis couleur", src: `library/${resto}/clips/${holder}.mp4`, start: 0, end: 5.3, speed: 0.946, grade: { brightness: 1 }, mosaic });
j.clips.forEach((c, i) => (c.label = c.label.replace(/^#\d+/, `#${i + 1}`)));
j.refAudio.from = 0;
fs.writeFileSync(p, JSON.stringify(j, null, 2));
console.log(`${p}: mosaic + ${j.clips.length - 1} shots`);

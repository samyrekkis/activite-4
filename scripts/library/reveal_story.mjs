// Story copied from the XWSA6292 reference: one long shot that builds up on black,
// rectangle by rectangle (puzzle reveal), opens in full at 6 s, and plays to 7 s.
//   node scripts/library/reveal_story.mjs <name> <clip id> <curve> [letterbox 0|1]
import fs from "node:fs";

const [name, id, curve, letterbox] = process.argv.slice(2);
const resto = id.startsWith("SAM") ? "samourai" : "monegasque";
const m = JSON.parse(fs.readFileSync(`public/library/${resto}/catalogue.json`, "utf8")).clips.find((x) => x.id === id);
const len = 7.03;
const speed = Math.min(1, +((m.duration - 0.1) / len).toFixed(3));
// Rectangles [x, y, w, h, appear s], in the rhythm of the reference: the picture builds
// from a centre band outwards in big touching blocks (scattered small pieces looked messy).
const rects = [
  [0.3, 0.4, 0.4, 0.1, 0], [0.3, 0.5, 0.4, 0.12, 1.0], [0.1, 0.4, 0.2, 0.22, 1.8], [0.7, 0.4, 0.2, 0.22, 2.6],
  [0.3, 0.28, 0.4, 0.12, 3.0], [0.1, 0.28, 0.2, 0.12, 3.2], [0.7, 0.28, 0.2, 0.12, 3.6], [0.1, 0.62, 0.8, 0.12, 3.8],
  [0, 0.16, 0.5, 0.12, 4.2], [0.5, 0.16, 0.5, 0.12, 4.4], [0, 0.74, 1, 0.12, 4.8], [0, 0.28, 0.1, 0.46, 5.2], [0.9, 0.28, 0.1, 0.46, 5.2],
];
const plan = {
  restaurant: resto, format: "vertical", fps: 30, version: 1,
  brief: "Story copiée de l’edit de référence XWSA6292 : un seul plan qui se construit sur fond noir, rectangle par rectangle, puis s’ouvre en entier à 6 s. Même chanson. Aucun texte.",
  handle: resto === "samourai" ? "@samourai_restaurant" : "@lemonegasquedz",
  clips: [{ label: `#1 ${m.name} (révélé en puzzle)`, src: `library/${resto}/clips/${id}.mp4`, start: 0.05, end: +(0.05 + len * speed).toFixed(3),
    ...(speed !== 1 ? { speed } : {}), grade: { curve, brightness: 1 }, ...(letterbox === "1" ? { letterbox: true } : {}), reveal: { rects, full: 6.0 } }],
  refAudio: { src: "XWSA6292", from: 0 },
};
fs.writeFileSync(`edits/copies/${name}.json`, JSON.stringify(plan, null, 2));
console.log(`${name}: ${id} ${m.duration}s at speed ${speed}`);

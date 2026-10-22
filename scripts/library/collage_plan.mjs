// Collage edits copied from the client's references:
//   bento (IWJK2351): 5 rounded cells pop in one by one (wide top, tall left, two right,
//                     wide bottom), hold, then two full-screen hero shots on the beat.
//   strips (FMGV8604): 4 full-width strips fill the frame from top to bottom, one every
//                      4 beats, then full-screen shots on every 4 beats.
//   node scripts/library/collage_plan.mjs <name> <restaurant> <bento|strips> <curve>
import fs from "node:fs";
const [name, resto, kind, curve] = process.argv.slice(2);
const cat = JSON.parse(fs.readFileSync(`public/library/${resto}/catalogue.json`, "utf8")).clips;
// Logos, children and shots the client rejected.
const LOGOS = ["SAM-003", "SAM-005", "SAM-055", "SAM-070", "SAM-039", "SAM-112", "SAM-101", "SAM-243", "SAM-255", "SAM-049",
  "SAM-030", "SAM-032", "SAM-033", "SAM-038", "SAM-050", "SAM-069", "SAM-071", "SAM-068", "SAM-048", "SAM-051", "SAM-052",
  "MON-092", "MON-096", "MON-233", "MON-278", "MON-156", "MON-269", "MON-244", "MON-236", "MON-237", "MON-238", "MON-214", "MON-253"];
const takenFile = `out/taken-${resto}.json`;
const taken = new Set(fs.existsSync(takenFile) ? JSON.parse(fs.readFileSync(takenFile, "utf8")) : []);
let seed = [...name].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 11);
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
const pick = (cats, minDur, view) => {
  const c = cat.filter((m) => !taken.has(m.id) && (m.quality ?? 2) >= 2 && !LOGOS.includes(m.id) && !/noir et blanc/.test(m.name) && m.duration >= minDur)
    .map((m) => ({ m, s: (cats.includes(m.category) ? 10 - cats.indexOf(m.category) * 2 : 0) + (view && m.view === view ? 3 : 0) + (m.quality ?? 2) * 2 + rnd() * 3 }))
    .sort((a, b) => b.s - a.s)[0];
  if (!c) throw new Error(`${name}: nothing left for ${cats}`);
  taken.add(c.m.id);
  return c.m;
};
const src = (m) => `library/${resto}/clips/${m.id}.mp4`;
const cell = (m, appear, until) => ({ src: src(m), start: 0.05, speed: Math.min(1, +((m.duration - 0.1) / (until - appear)).toFixed(3)), appear, color: appear });
const hero = (m, len, label) => {
  const at = Math.max(0, (m.duration - len - 0.08) * (0.3 + 0.4 * rnd()));
  return { label, src: src(m), start: +at.toFixed(3), end: +(at + len).toFixed(3), grade: { curve, brightness: 1 } };
};
let clips, refSrc;
if (kind === "bento") {
  refSrc = "IWJK2351";
  const hold = 6.9;
  const rects = [[0.03, 0.09, 0.94, 0.25], [0.03, 0.355, 0.46, 0.375], [0.51, 0.355, 0.46, 0.18], [0.51, 0.55, 0.46, 0.18], [0.03, 0.745, 0.94, 0.2]];
  const appear = [0, 0.5, 1.4, 2.0, 2.6];
  const ms = [pick(["salle", "exterieur", "deco"], 3, "large"), pick(["personnes", "geste"], 3), pick(["plat", "dessert"], 3), pick(["geste", "cuisine", "table"], 3), pick(["table", "plat", "salle"], 3)];
  const mosaic = { cols: 1, rows: 1, rects, radius: 28, cells: ms.map((m, i) => cell(m, appear[i], hold)) };
  const holder = ms[0];
  clips = [{ label: "#1 collage : salle, ambiance, plat, geste, table (cases qui apparaissent une à une)", src: src(holder), start: 0, end: +(hold * Math.min(1, (holder.duration - 0.1) / hold)).toFixed(3),
      speed: Math.min(1, +((holder.duration - 0.1) / hold).toFixed(3)), grade: { curve, brightness: 1 }, mosaic },
    hero(pick(["plat", "dessert"], 2.2, "gros-plan"), 2.0, "#2 plat en plein écran"),
    hero(pick(["salle", "personnes", "table"], 2.2), 2.0, "#3 la salle pour finir")];
} else {
  refSrc = "FMGV8604";
  const b4 = 1.86, hold = 4 * b4;
  const rects = [[0, 0, 1, 0.25], [0, 0.25, 1, 0.25], [0, 0.5, 1, 0.25], [0, 0.75, 1, 0.25]];
  const ms = [pick(["personnes", "cuisine"], 3, "moyen"), pick(["plat", "geste"], 3), pick(["salle", "deco", "personnes"], 3), pick(["plat", "dessert"], 3)];
  const mosaic = { cols: 1, rows: 1, rects, cells: ms.map((m, i) => cell(m, i * b4, hold)) };
  const holder = ms[0];
  clips = [{ label: "#1 bandes : l'équipe, un plat, la salle, un dessert (une bande toutes les 4 temps)", src: src(holder), start: 0, end: +(hold * Math.min(1, (holder.duration - 0.1) / hold)).toFixed(3),
      speed: Math.min(1, +((holder.duration - 0.1) / hold).toFixed(3)), grade: { curve, brightness: 1 }, mosaic },
    hero(pick(["geste", "cuisine"], b4 + 0.2), b4, "#2 le geste"),
    hero(pick(["plat"], b4 + 0.2, "gros-plan"), b4, "#3 le plat"),
    hero(pick(["personnes", "table"], b4 + 0.2), b4, "#4 à table"),
    hero(pick(["salle", "exterieur"], b4 + 0.2, "large"), b4, "#5 la salle pour finir")];
}
fs.writeFileSync(takenFile, JSON.stringify([...taken]));
const plan = { restaurant: resto, format: "vertical", fps: 30, version: 1,
  brief: `Collage copié de l'edit de référence ${refSrc} (${kind}), même chanson, plans dans l'ordre d'une visite. Aucun texte.`,
  handle: resto === "samourai" ? "@samourai_restaurant" : "@lemonegasquedz", clips, refAudio: { src: refSrc, from: 0 } };
fs.writeFileSync(`edits/copies/${name}.json`, JSON.stringify(plan, null, 2));
console.log(`${name}: ${clips.length} clips, ${clips.reduce((s, c) => s + (c.end - c.start) / (c.speed ?? 1), 0).toFixed(2)} s`);

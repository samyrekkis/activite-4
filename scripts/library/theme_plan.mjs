// Spec for ref-plan.mjs: a theme video (birthdays, outfits, friends, family, romance) on a
// reference's cuts and song. Shots come from the Gemini theme tags (themes.json) in the
// order of a small story for that theme; dark shots are avoided unless the theme is romantic.
// Shots already used by this batch (TAKEN file) are never reused.
//   node scripts/library/theme_plan.mjs <name> <restaurant> <theme> <ref.json> <from> <to> <minShot> <curve> <letterbox 0|1>
import fs from "node:fs";
const [name, resto, theme, ref, from, to, minShot, curve, letterbox] = process.argv.slice(2);
const r = JSON.parse(fs.readFileSync(ref, "utf8"));
const bounds = [+from];
for (const x of r.cuts) if (x > +from + +minShot && x < +to - +minShot && x - bounds.at(-1) >= +minShot) bounds.push(x);
bounds.push(+to);
const n = bounds.length - 1;
const cat = JSON.parse(fs.readFileSync(`public/library/${resto}/catalogue.json`, "utf8")).clips;
const tags = JSON.parse(fs.readFileSync(`public/library/${resto}/themes.json`, "utf8"));
// Near-duplicates (the same scene cut from several reels) share a group: one per batch.
const dups = JSON.parse(fs.readFileSync(`public/library/${resto}/dups.json`, "utf8"));
const grp = (id) => dups[id] ?? id;
// Logos and shots the client rejected (children are allowed in the family theme only).
const BANNED = ["SAM-003", "SAM-005", "SAM-055", "SAM-070", "SAM-039", "SAM-112", "SAM-243", "SAM-255", "SAM-049",
  "SAM-030", "SAM-032", "SAM-033", "SAM-038", "SAM-050", "SAM-069", "SAM-071", "SAM-068", "SAM-048", "SAM-051", "SAM-052",
  "MON-092", "MON-096", "MON-233", "MON-278", "MON-156", "MON-269", "MON-244", "MON-236", "MON-237", "MON-238", "MON-214", "MON-253"];
// Story of each theme: [until position, wanted themes in order of preference].
const STORIES = {
  anniversaire: [[0.12, ["anniversaire", "deco", "salle"]], [0.35, ["amis", "anniversaire", "tenues"]], [0.55, ["plats", "diner", "boissons"]], [0.85, ["anniversaire", "amis"]], [1, ["amis", "anniversaire", "salle"]]],
  tenues: [[0.12, ["exterieur", "salle", "tenues"]], [0.5, ["tenues", "deco"]], [0.7, ["tenues", "diner", "plats"]], [1, ["tenues", "amis", "salle"]]],
  amis: [[0.12, ["salle", "exterieur", "amis"]], [0.4, ["amis", "diner"]], [0.65, ["plats", "boissons", "service"]], [0.9, ["amis", "boissons", "diner"]], [1, ["salle", "amis"]]],
  famille: [[0.12, ["salle", "exterieur", "enfants"]], [0.45, ["enfants", "amis"]], [0.7, ["plats", "boissons", "diner"]], [1, ["enfants", "amis", "plats"]]],
  romantique: [[0.15, ["romantique", "deco", "salle"]], [0.45, ["diner", "romantique", "boissons"]], [0.8, ["plats", "boissons", "romantique"]], [1, ["romantique", "salle", "deco"]]],
  cuisine: [[0.15, ["cuisine", "service"]], [0.75, ["cuisine", "service"]], [1, ["plats", "service"]]],
};
const story = STORIES[theme];
const takenFile = `out/taken-${resto}.json`;
const taken = new Set(fs.existsSync(takenFile) ? JSON.parse(fs.readFileSync(takenFile, "utf8")) : []);
const takenGroups = new Set([...taken].map(grp));
let seed = [...name].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 13);
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
const pool = cat.filter((m) => {
  const t = tags[m.id];
  if (!t || t.logo || BANNED.includes(m.id) || /noir et blanc/.test(m.name)) return false;
  if (t.themes.includes("enfants") && theme !== "famille") return false;
  if ((m.quality ?? 2) < 2 && !(theme === "famille" && t.themes.includes("enfants"))) return false;
  return true;
}).map((m) => ({ m, t: tags[m.id], k: rnd() }));
const shots = [];
for (let i = 0; i < n; i++) {
  const len = bounds[i + 1] - bounds[i], p = (i + 0.5) / n;
  const want = story.find(([until]) => p <= until)[1];
  const score = (x) => {
    const hit = want.findIndex((w) => x.t.themes.includes(w));
    return (hit >= 0 ? 12 - hit * 3 : 0) + (x.t.themes.includes(theme) ? 3 : 0) + (x.m.quality ?? 2) * 1.5
      + (theme !== "cuisine" && x.t.themes.includes("cuisine") ? -5 : 0)
      + (theme === "romantique" ? 0 : x.t.lumiere === "claire" ? 2 : x.t.lumiere === "sombre" ? -4 : 0)
      + (["joyeux", "festif"].includes(x.t.ambiance) && theme !== "romantique" ? 1.5 : 0) + x.k * 2.5;
  };
  // A theme clip a bit short for the slot plays slowed down (down to 0.65x) rather than
  // giving the slot to an off-theme shot.
  const fit = (x) => x.m.duration >= len + 0.15 ? 1 : x.m.duration >= len * 0.65 + 0.15 && want.some((w) => x.t.themes.includes(w)) ? (x.m.duration - 0.12) / len : 0;
  const best = pool.filter((x) => !takenGroups.has(grp(x.m.id)) && fit(x) > 0).sort((a, b) => score(b) - score(a) - (fit(b) < 1 ? 1.5 : 0) + (fit(a) < 1 ? 1.5 : 0))[0];
  if (!best) throw new Error(`${name}: no shot left for slot ${i}`);
  taken.add(best.m.id); takenGroups.add(grp(best.m.id));
  const sp = Math.min(1, +fit(best).toFixed(3));
  const room = Math.max(0, best.m.duration - len * sp - 0.08);
  shots.push({ id: best.m.id, ...(sp < 1 ? { speed: sp } : {}), at: +(room * (0.2 + 0.6 * rnd())).toFixed(2), why: `${want[0]} -> ${best.t.themes.join("/")}${sp < 1 ? " (ralenti " + sp + ")" : ""}`, stage: want[0], view: best.m.view, len: len * sp });
}
// Inside each stage of the story, go from wide to close (set the scene, then the detail);
// a shot only moves to a slot long enough for it.
const VIEW = { large: 0, moyen: 1, dessus: 2, "gros-plan": 3 };
for (let a = 0; a < shots.length; ) {
  let b = a; while (b < shots.length && shots[b].stage === shots[a].stage) b++;
  const lens = shots.slice(a, b).map((s) => s.len);
  const sorted = shots.slice(a, b).sort((x, y) => (VIEW[x.view] ?? 1) - (VIEW[y.view] ?? 1));
  const dur = (s) => cat.find((m) => m.id === s.id).duration;
  if (sorted.every((s, k) => !s.speed && dur(s) >= lens[k] + 0.15)) sorted.forEach((s, k) => { s.at = Math.min(s.at, +Math.max(0, dur(s) - lens[k] - 0.08).toFixed(2)); shots[a + k] = s; });
  a = b;
}
fs.writeFileSync(takenFile, JSON.stringify([...taken]));
const spec = { out: `edits/copies/${name}.json`, restaurant: resto, ref, from: +from, to: +to, minShot: +minShot, curve, version: 1, copyZoom: true,
  ...(letterbox === "1" ? { letterbox: true } : {}),
  brief: `Thème « ${theme} » sur les coupes et la chanson de ${ref.split("/").pop()} : une petite histoire du thème, couleurs vives. Aucun texte.`,
  shots: shots.map(({ id, at, speed }) => ({ id, ...(speed ? { speed } : {}), at })) };
fs.writeFileSync(`edits/specs/copies/${name}.json`, JSON.stringify(spec, null, 1));
console.log(`${name} (${theme}): ${n} plans\n  ${shots.map((s) => `${s.id} ${s.why}`).join("\n  ")}`);

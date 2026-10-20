// Specs for the second batch of Monégasque Reels and Stories (new Instagram footage).
// node edits/specs/monegasque-batch2.mjs [filter] -> writes edits/specs/*.json, then build-plan.mjs each.
// Rules (client feedback): shots in the order of a visit, one constant speed per edit,
// day and night grouped, at most one soft fade, every shot clean enough to post.
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const common = "Sans musique : la cliente ajoute le son. Aucun texte, aucun logo, aucune carte de fin.";
const specs = {
  "reels/monegasque-ramadan": {
    curve: "moody",
    speed: 0.8,
    brief: `REEL lent (environ 15 s, 100 BPM). Thème « Les soirs de ramadan » : le thé versé, le buffet et ses bricks, les convives qui se servent, puis la vitrine de desserts pour finir. Technique : plans longs et posés, mouvements de caméra dans le même sens, une seule vitesse lente. Look chaud et profond (moody). ${common}`,
    shots: [
      { id: "MON-200", beats: 2 },
      { id: "MON-204", beats: 4, reverse: true },
      { id: "MON-201", beats: 6, b: 1.06 },
      { id: "MON-207", beats: 4, b: 0.97 },
      { id: "MON-203", beats: 5, b: 1.06 },
    ],
  },
  "stories/monegasque-tablee-citrons": {
    curve: "portra",
    speed: 0.85,
    brief: `STORY (environ 10 s, 100 BPM). Thème « La grande tablée aux citrons » : la longue table vue d’ensemble, puis on s’approche — la table, les citrons et la bougie — et on finit sur le cocktail levé. Technique : plans longs, une seule vitesse lente. Look portra, chaud et naturel. ${common}`,
    shots: [
      { id: "MON-224", beats: 4, b: 1.08 },
      { id: "MON-215", beats: 4, reframe: { scale: 1.07, origin: "left center" } },
      { id: "MON-217", beats: 4, b: 1.1 },
      { id: "MON-220", beats: 5, b: 1.08 },
    ],
  },
  "reels/monegasque-en-fete": {
    curve: "film",
    speed: 0.9,
    brief: `REEL (environ 14 s, 100 BPM). Thème « Les fêtes de fin d’année au Monégasque » (à publier en décembre) : le musicien, le service, la paella, le risotto, le poisson, les calamars, puis la chanteuse. Technique : ouverture lente sur le musicien, plats en plans courts de deux temps, retour au calme sur la chanteuse en plan long. Look film, chaud mais naturel. ${common}`,
    shots: [
      { id: "MON-298", beats: 4 },
      { id: "MON-303", beats: 3 },
      { id: "MON-305", beats: 2 },
      { id: "MON-310", beats: 2 },
      { id: "MON-308", beats: 2 },
      { id: "MON-315", beats: 3, b: 1.08 },
      { id: "MON-302", beats: 6 },
    ],
  },
  "stories/monegasque-brunch": {
    curve: "portra",
    speed: 0.8,
    brief: `STORY (environ 11 s, 100 BPM). Thème « Brunch au bord de la piscine » : la table du brunch vue du dessus, la salade aux œufs, puis la main qui la prend à côté du café turc. Technique : tout en plongée, trois plans calmes à la même vitesse. Look portra lumineux. ${common}`,
    shots: [
      { id: "MON-289", beats: 6 },
      { id: "MON-291", beats: 5 },
      { id: "MON-327", beats: 6 },
    ],
  },
};

const only = process.argv[2];
for (const [name, s] of Object.entries(specs)) {
  if (only && !name.includes(only)) continue;
  const out = `edits/${name}.json`;
  let version = 1;
  try { version = JSON.parse(fs.readFileSync(out, "utf8")).version + 1; } catch {}
  const file = `edits/specs/${name.split("/")[1]}.json`;
  fs.writeFileSync(file, JSON.stringify({ restaurant: "monegasque", bpm: 100, stabilize: true, out, version, ...s }, null, 1));
  execFileSync(process.execPath, ["scripts/library/build-plan.mjs", file], { stdio: "inherit" });
}

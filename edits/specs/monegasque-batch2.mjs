// Specs for the second batch of Monégasque Reels and Stories (new Instagram footage).
// node edits/specs/monegasque-batch2.mjs  -> writes edits/specs/*.json, then build-plan.mjs each.
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const common = "Sans musique : la cliente ajoute le son. Aucun texte, aucun logo, aucune carte de fin.";
const specs = {
  "reels/monegasque-surprise": {
    curve: "film",
    brief: `REEL lent (environ 14 s, 100 BPM). Thème « La surprise » : on suit le chemin d'une demande romantique, du cordon qu'on ouvre jusqu'à la table aux pétales, puis la piscine au crépuscule. Technique : plans longs et calmes, un seul sens de lecture (on avance), coupes franches, ralentis légers. Look film doux. ${common}`,
    shots: [
      { id: "MON-276", beats: 4, speed: 0.9 },
      { id: "MON-278", beats: 4, speed: 0.9 },
      { id: "MON-283", beats: 2, speed: 0.9 },
      { id: "MON-281", beats: 4, speed: 0.9, b: 0.96 },
      { id: "MON-280", beats: 4, speed: 0.9, reverse: true },
      { id: "MON-282", beats: 4, speed: 0.8, b: 0.93 },
    ],
  },
  "stories/monegasque-anniversaire-rose": {
    curve: "pastel",
    brief: `STORY (environ 10 s, 100 BPM). Thème « Anniversaire en rose » : le néon Love, la salle rose, la table rose et argent. Technique : un écran partagé en deux colonnes au milieu (table / assiette), le reste en plans pleins. Look pastel. ${common}`,
    shots: [
      { id: "MON-272", beats: 2, speed: 0.85 },
      { id: "MON-271", beats: 5, speed: 0.84 },
      { id: "MON-270", beats: 3, speed: 0.9, panels: ["MON-273"], layout: "columns" },
      { id: "MON-274", beats: 2 },
      { id: "MON-275", beats: 4, speed: 0.7 },
    ],
  },
  "reels/monegasque-ramadan": {
    curve: "moody",
    brief: `REEL lent (environ 17 s, 100 BPM). Thème « Les soirs de ramadan » : le thé versé, le hall illuminé, le buffet et ses desserts, les convives qui se servent. Technique : plans longs et posés, mouvements de caméra tous dans le même sens, rythme qui respire. Look chaud et profond (moody). ${common}`,
    shots: [
      { id: "MON-200", beats: 2, speed: 0.9 },
      { id: "MON-199", beats: 5, speed: 0.9, mirror: true },
      { id: "MON-204", beats: 4, speed: 0.9 },
      { id: "MON-201", beats: 6, speed: 0.85, b: 1.1 },
      { id: "MON-207", beats: 4, speed: 0.9 },
      { id: "MON-202", beats: 4, speed: 0.9 },
      { id: "MON-203", beats: 5, speed: 0.8 },
    ],
  },
  "stories/monegasque-tablee-citrons": {
    curve: "golden",
    brief: `STORY (environ 12 s, 100 BPM). Thème « La grande tablée aux citrons » : on cueille un citron, on déroule la serviette, la longue table, le cocktail levé. Technique : presque un plan-séquence, très peu de coupes, plans longs. Look doré solaire. ${common}`,
    shots: [
      { id: "MON-214", beats: 3, speed: 0.9, at: 1.6 },
      { id: "MON-219", beats: 2, speed: 1, b: 1.1 },
      { id: "MON-215", beats: 3, speed: 0.9, reframe: { scale: 1.14, origin: "left center" } },
      { id: "MON-220", beats: 4, speed: 0.9, sat: 0.9 },
      { id: "MON-224", beats: 4, speed: 0.85 },
    ],
  },
  "stories/monegasque-douceurs-nuit": {
    curve: "film",
    brief: `STORY (environ 11 s, 100 BPM). Thème « Douceurs de nuit » : le dessert aux figues, la fourchette qui plonge, les gambas à la mangue, le plateau de fromages, la crêpe au chocolat. Technique : écran partagé en deux bandes horizontales au milieu, gros plans gourmands autour. Look film, naturel et élégant. ${common}`,
    shots: [
      { id: "MON-264", beats: 4, speed: 0.9 },
      { id: "MON-267", beats: 3, speed: 0.9 },
      { id: "MON-266", beats: 3, speed: 0.9, panels: ["MON-265"], layout: "rows" },
      { id: "MON-268", beats: 4, speed: 0.9, b: 1.1 },
      { id: "MON-250", beats: 2, speed: 0.55 },
    ],
  },
  "reels/monegasque-en-fete": {
    curve: "vibrant",
    brief: `REEL (environ 20 s, 100 BPM). Thème « Le Monégasque en fête » : le musicien, la chanteuse, le service qui défile, la paella, le risotto, le poisson. Technique : variation de rythme — ouverture lente sur le musicien, accélération sur les plats (plans d’un temps puis de deux), puis retour au calme sur la chanteuse en plan long. Look festif et riche. ${common}`,
    shots: [
      { id: "MON-298", beats: 4, speed: 0.9 },
      { id: "MON-303", beats: 3, speed: 0.9 },
      { id: "MON-305", beats: 1 },
      { id: "MON-307", beats: 1 },
      { id: "MON-310", beats: 2 },
      { id: "MON-308", beats: 2 },
      { id: "MON-315", beats: 3, speed: 0.9 },
      { id: "MON-313", beats: 4, speed: 1, at: 0.05 },
      { id: "MON-317", beats: 3, speed: 0.9 },
      { id: "MON-302", beats: 6, speed: 0.9 },
    ],
  },
  "stories/monegasque-brunch": {
    curve: "portra",
    brief: `STORY (environ 13 s, 100 BPM). Thème « Brunch au bord de la piscine » : la grande table du brunch vue du dessus, la table au bord de la piscine, la burrata qu'on attrape, le café turc. Technique : tout en plongée (vue du dessus), un triptyque (trois bandes) pour finir. Look portra lumineux. ${common}`,
    shots: [
      { id: "MON-289", beats: 5, speed: 0.9 },
      { id: "MON-290", beats: 3, speed: 0.9 },
      { id: "MON-291", beats: 3, speed: 0.9 },
      { id: "MON-327", beats: 4, speed: 0.9 },
      { id: "MON-325", beats: 3, speed: 0.8, panels: ["MON-288", "MON-286"], layout: "rows", stagger: 0.08 },
    ],
  },
  "reels/monegasque-anniversaires": {
    curve: "tealOrange",
    brief: `REEL lent (environ 18 s, 100 BPM). Thème « Vos anniversaires » : du jour au soir, les tables d'anniversaire au bord de la piscine, la couronne, les cadeaux, puis la nuit : bougies rouges et salle en ballons. Technique : récit jour → nuit, avec un écran partagé en deux colonnes (jour / nuit) comme charnière. Look cinéma chaud/froid. ${common}`,
    shots: [
      { id: "MON-210", beats: 4, speed: 0.9 },
      { id: "MON-293", beats: 3, speed: 0.9 },
      { id: "MON-297", beats: 4, speed: 0.9 },
      { id: "MON-209", beats: 4, speed: 0.9 },
      { id: "MON-213", beats: 2, speed: 0.9, panels: ["MON-247"], layout: "columns" },
      { id: "MON-232", beats: 3, speed: 0.9 },
      { id: "MON-242", beats: 5, speed: 0.9 },
    ],
  },
  "stories/monegasque-saint-valentin": {
    curve: "moody",
    letterbox: true,
    brief: `STORY (environ 11 s, 100 BPM), format cinéma (bandes noires). Thème « Saint-Valentin » : les tables rouges aux bougies, les roses, le rideau de cœurs. Technique : cadre cinéma 2.39 sur toute la story, plans lents et posés, un seul sens de mouvement. Look profond et feutré. ${common}`,
    shots: [
      { id: "MON-319", beats: 4, speed: 0.9 },
      { id: "MON-320", beats: 4, speed: 0.9 },
      { id: "MON-322", beats: 3, speed: 0.85 },
      { id: "MON-296", beats: 5, speed: 0.9 },
      { id: "MON-323", beats: 3, speed: 0.9 },
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
  fs.writeFileSync(file, JSON.stringify({ restaurant: "monegasque", bpm: 100, out, version, ...s }, null, 1));
  execFileSync(process.execPath, ["scripts/library/build-plan.mjs", file], { stdio: "inherit" });
}

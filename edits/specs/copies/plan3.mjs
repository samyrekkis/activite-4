// Three more copies after the client's feedback (Monégasque copies liked; Samouraï UOGV
// loved, OYUA not; no Samouraï set-with-logo table shots).
// node edits/specs/copies/plan3.mjs -> out/plan3.json for allocate.mjs
import fs from "node:fs";

const R = (n, x) => Array(n).fill(x);
const song = "Coupes identiques à la référence, mêmes zooms, même chanson. Aucun texte, aucune carte de fin.";
const ANY = "SALLE|DECO|TABLE|PLAT|DESSERT|GESTE|ANNIV|TRADITION|ENTREE|VUE|POOL|PERSONNES";
const copies = [
  { name: "samourai-copie-clcc", restaurant: "samourai", ref: "analysis/refs/CLCC7774.json", from: 0, to: 20.17, minShot: 0.3, refCrop: "384:680:166:60", curve: "encre", light: "nuit",
    brief: `Copie de l’edit de référence CLCC7774 (visite d’un restaurant, une coupe tous les 2 temps) avec le Samouraï : l’entrée, la salle aux lanternes, les détails, la tradition, les tables, les plats asiatiques. ${song}`,
    slots: ["ENTREE|DECO", "ENTREE|SALLE", "SALLE", "DECO|SALLE", "TRADITION|DECO", "SALLE", "PLAT", "TABLE|SALLE", "DECO|TRADITION", "PLAT", "SALLE|ENTREE", "PLAT", "ANNIV|TABLE|DECO", "PLAT", "GESTE|PLAT", "SALLE|DECO", ANY, ANY, ANY, ANY, ANY, ANY, ANY] },
  { name: "monegasque-copie-oyua-ambiance", restaurant: "monegasque", ref: "analysis/refs/OYUA3954.json", from: 0, to: 14.5, minShot: 0.3, refCrop: "720:820:0:460", curve: "portra",
    speeds: [1.88, 2.12, 2.12, 2.2, 1.08, 1.04, 1.04, 1.1, 1.1, 1.31],
    brief: `Copie de l’edit de référence OYUA3954 (tour rapide en travellings accélérés) : l’ambiance du Monégasque — la salle, les clients, le serveur, l’allée de pétales, la terrasse et la piscine vue d’en haut. ${song}`,
    slots: ["SALLE", "SALLE", "SALLE", "SALLE|PERSONNES", "PERSONNES", "ANNIV|DECO", "PERSONNES|DESSERT", "ANNIV|DECO", "PERSONNES|DECO", "VUE|POOL"] },
];
const exclude = ["MON-092", "MON-096", "MON-233", "MON-278", "MON-156", "MON-269", "MON-244", "MON-236", "MON-237", "MON-238", "MON-214", "MON-253",
  "SAM-030", "SAM-032", "SAM-033", "SAM-038", "SAM-050", "SAM-069", "SAM-071", "SAM-068", "SAM-048", "SAM-049", "SAM-051", "SAM-052",
  // Table sets with the red Samouraï logo the client did not like.
  "SAM-003", "SAM-005", "SAM-055", "SAM-070", "SAM-039"];
fs.writeFileSync("out/plan3.json", JSON.stringify({ exclude, copies }, null, 1));
console.log(copies.map((c) => `${c.name}: ${c.slots.length}`).join("\n"));

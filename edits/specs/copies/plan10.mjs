// The ten copies of the client's reference edits, with the logical order of shot themes
// for each one. node edits/specs/copies/plan10.mjs  -> out/plan10.json for allocate.mjs
import fs from "node:fs";

const R = (n, x) => Array(n).fill(x);
const song = "Coupes identiques à la référence, mêmes zooms, même chanson. Aucun texte, aucune carte de fin.";
const copies = [
  { name: "samourai-copie-uogv", restaurant: "samourai", ref: "analysis/refs/UOGV3464-manual.json", from: 0, to: 16.5, minShot: 0.09, refCrop: "384:680:166:60", curve: "encre", light: "nuit",
    brief: `Copie de l’edit de référence UOGV3464 (visite d’un café le soir) avec le Samouraï : l’enseigne, 8 flashs de détails en noir et blanc, la salle, la tradition, les tables, des flashs de plats, et la salle pour finir. ${song}`,
    slots: ["ENTREE", ...R(8, "DECO|TRADITION|ENTREE|SALLE|GESTE"), "SALLE", "SALLE", "DECO|SALLE", "TRADITION", "ENTREE|DECO", "TABLE|PLAT", "SALLE|DECO", "TABLE|SALLE", "ANNIV", "ANNIV|TABLE", "VUE|DECO", ...R(5, "PLAT"), "PLAT|TABLE|DESSERT", "SALLE"] },
  { name: "samourai-copie-oyua", restaurant: "samourai", ref: "analysis/refs/OYUA3954.json", from: 0, to: 14.5, minShot: 0.3, refCrop: "720:820:0:460", curve: "encre",
    speeds: [1.88, 2.12, 2.12, 2.2, 1.08, 1.04, 1.04, 1.1, 1.1, 1.31],
    brief: `Copie de l’edit de référence OYUA3954 (tour rapide en travellings accélérés) avec le Samouraï : l’entrée, la salle aux lanternes, la tradition, les détails, les tables, les plats et le rooftop. ${song}`,
    slots: ["ENTREE|SALLE", "SALLE", "TRADITION|SALLE", "SALLE", "DECO", "ANNIV|TABLE", "TABLE|PLAT", "PLAT", "PERSONNES|TRADITION|GESTE", "VUE|DECO"] },
  { name: "monegasque-copie-clcc", restaurant: "monegasque", ref: "analysis/refs/CLCC7774.json", from: 0, to: 20.17, minShot: 0.3, refCrop: "384:680:166:60", curve: "portra", light: "nuit",
    brief: `Copie de l’edit de référence CLCC7774 (visite d’un restaurant, une coupe tous les 2 temps) : le Monégasque le soir — l’entrée, la salle, les détails, la tradition, les anniversaires, les tables, les plats, et la piscine de nuit. ${song}`,
    slots: ["ENTREE", "ENTREE", "ANNIV", "SALLE", "SALLE", "DECO|ANNIV", "TRADITION", "ANNIV", "SALLE", "ANNIV", "DECO|ANNIV", "TABLE", "TRADITION", "ANNIV", "TABLE", "PLAT", "DESSERT", "TABLE", "PLAT", "GESTE", "PERSONNES", "POOL|VUE", "POOL|VUE"] },
  { name: "monegasque-copie-uogv", restaurant: "monegasque", ref: "analysis/refs/UOGV3464-manual.json", from: 0, to: 16.5, minShot: 0.09, refCrop: "384:680:166:60", curve: "portra", light: "nuit",
    brief: `Copie de l’edit de référence UOGV3464 (visite d’un café le soir) avec le Monégasque : l’enseigne, 8 flashs de détails en noir et blanc, la salle, la tradition, les anniversaires, des flashs de plats, et la salle pour finir. ${song}`,
    slots: ["ENTREE", ...R(8, "DECO|ANNIV|GESTE|DESSERT"), "SALLE", "SALLE", "DECO|ANNIV", "TRADITION", "ENTREE|ANNIV", "TABLE", "ANNIV", "TABLE", "ANNIV", "ANNIV", "VUE|POOL", ...R(5, "PLAT"), "ANNIV", "SALLE"] },
  { name: "monegasque-copie-oyua-nuit", restaurant: "monegasque", ref: "analysis/refs/OYUA3954.json", from: 0, to: 14.5, minShot: 0.3, refCrop: "720:820:0:460", curve: "portra", light: "nuit",
    speeds: [1.88, 2.12, 2.12, 2.2, 1.08, 1.04, 1.04, 1.1, 1.1, 1.31],
    brief: `Copie de l’edit de référence OYUA3954 (tour rapide en travellings accélérés) : le Monégasque le soir — l’entrée, la salle, un anniversaire, une table, la tradition, la déco, un plat, l’ambiance et la piscine. ${song}`,
    slots: ["ENTREE", "SALLE", "ANNIV", "TABLE", "TRADITION", "ANNIV", "DECO|ANNIV", "PLAT", "PERSONNES", "POOL|VUE"] },
  { name: "monegasque-copie-cajy", restaurant: "monegasque", ref: "analysis/refs/CAJY3696.json", from: 0, to: 14, minShot: 0.1, refCrop: "720:820:0:460", curve: "portra", light: "jour",
    brief: `Copie de l’edit de référence CAJY3696 (balade de jour, un plan de 1,4 s puis 28 coupes de 0,45 s sur le beat) : l’entrée, les vues, la salle, la tradition, les anniversaires, les tables, les plats, les desserts, les gestes, puis la piscine. ${song}`,
    slots: ["ENTREE", "ENTREE|VUE", "VUE", "VUE|POOL", "DECO|ANNIV", "SALLE", "DECO|ANNIV", "TRADITION", "ANNIV", "TABLE", "ANNIV", "TABLE", "PLAT", "DESSERT", "GESTE", "TABLE", "PLAT", "ANNIV", "GESTE|DESSERT", "TABLE", "PLAT", "PERSONNES|GESTE", "ANNIV", "TABLE", "DESSERT|PLAT", "VUE", "POOL", "VUE|POOL", "POOL"] },
  { name: "monegasque-copie-oyua", restaurant: "monegasque", ref: "analysis/refs/OYUA3954.json", from: 0, to: 14.5, minShot: 0.3, refCrop: "720:820:0:460", curve: "portra", light: "jour",
    speeds: [1.88, 2.12, 2.12, 2.2, 1.08, 1.04, 1.04, 1.1, 1.1, 1.31],
    brief: `Copie de l’edit de référence OYUA3954 (tour rapide en travellings accélérés) : le Monégasque de jour — l’entrée, la salle, un anniversaire, la terrasse, la tradition, une table, la déco, un plat, un geste et la piscine. ${song}`,
    slots: ["ENTREE|VUE", "SALLE", "ANNIV", "VUE", "TRADITION", "TABLE", "DECO|ANNIV", "PLAT", "GESTE|PERSONNES", "POOL"] },
  { name: "monegasque-pmfi-mosaic", restaurant: "monegasque", light: "jour", need: 2.0, slots: R(9, "TABLE") },
  { name: "monegasque-copie-pmfi", restaurant: "monegasque", ref: "analysis/refs/PMFI3044.json", from: 5.6, to: 13.0, minShot: 0.1, curve: "film", closeUp: true,
    brief: `Copie de l’edit de référence PMFI3044 : une mosaïque 3×3 de tables en noir et blanc qui apparaissent une à une puis passent en couleur, puis 22 gros plans de desserts, boissons et plats sur le beat. ${song}`,
    slots: ["DESSERT", "DESSERT", "PLAT", "DESSERT", "PLAT", "GESTE", "DESSERT", "PLAT", "PLAT", "DESSERT", "GESTE", "PLAT", "DESSERT", "PLAT", "TABLE", "PLAT", "DESSERT|PLAT", "GESTE", "PLAT", "TABLE", "PLAT", "DESSERT|PLAT"] },
  { name: "monegasque-copie-clcc-jour", restaurant: "monegasque", ref: "analysis/refs/CLCC7774.json", from: 0, to: 20.17, minShot: 0.3, refCrop: "384:680:166:60", curve: "portra", light: "jour",
    brief: `Copie de l’edit de référence CLCC7774 (visite d’un restaurant, une coupe tous les 2 temps) : le Monégasque de jour — l’entrée, la terrasse, la salle, les détails, la tradition, les anniversaires, le brunch, les plats, et la piscine. ${song}`,
    slots: ["ENTREE|VUE", "VUE", "SALLE|VUE", "DECO|ANNIV", "TABLE", "ANNIV", "TRADITION|PERSONNES", "TABLE", "PLAT", "ANNIV", "DESSERT|PLAT", "GESTE", "TABLE", "PLAT", "ANNIV|DECO", "TABLE", "PLAT", "GESTE|DESSERT", "TABLE", "PLAT|DESSERT", "VUE|POOL", "POOL|VUE", "POOL|VUE"] },
  { name: "monegasque-copie-vtzi", restaurant: "monegasque", ref: "analysis/refs/VTZI7105.json", from: 0, to: 14.5, minShot: 0.1, curve: "moody", light: "nuit", closeUp: true,
    brief: `Copie de l’edit de référence VTZI7105 (montage cinéma ultra-rapide, 59 coupes en 14,5 s) : ambiance, gestes, plats, salle, tradition, anniversaires et tables du Monégasque. ${song}`,
    slots: [...R(4, "DECO|ANNIV"), ...R(4, "GESTE"), ...R(2, "DESSERT|PLAT"), ...R(2, "PERSONNES|GESTE|DECO"), ...R(8, "PLAT|GESTE|TABLE"), ...R(3, "ANNIV"), ...R(4, "SALLE"), ...R(2, "TRADITION"), ...R(6, "TABLE"), ...R(6, "PLAT|TABLE|DESSERT"), ...R(3, "DESSERT|PLAT|TABLE"), ...R(4, "ANNIV"), ...R(5, "TABLE"), ...R(2, "ENTREE|VUE"), ...R(4, "PLAT|TABLE")] },
];
const exclude = ["MON-092", "MON-096", "MON-233", "MON-278", "MON-156", "MON-269", "MON-244", "MON-236", "MON-237", "MON-238", "MON-214",
  "SAM-030", "SAM-032", "SAM-033", "SAM-038", "SAM-050", "SAM-069", "SAM-071", "SAM-068", "SAM-048", "SAM-049", "SAM-051", "SAM-052"];
fs.writeFileSync("out/plan10.json", JSON.stringify({ exclude, copies }, null, 1));
console.log(copies.map((c) => `${c.name}: ${c.slots.length}`).join("\n"));

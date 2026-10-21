// New Samouraï copies from the 21-10 footage (chef, kitchen, sushi, kimonos).
// node edits/specs/copies/plan_w7.mjs -> out/plan_w7.json for allocate.mjs
import fs from "node:fs";

const R = (n, x) => Array(n).fill(x);
const song = "Coupes identiques à la référence, mêmes zooms, même chanson. Aucun texte, aucune carte de fin.";
const base = { restaurant: "samourai", curve: "encre", light: "nuit" };
const copies = [
  { ...base, name: "samourai-copie-lxwz", ref: "analysis/refs/LXWZ3325.json", from: 0, to: 9.43, minShot: 0.1,
    brief: `Copie de l’edit de référence LXWZ3325 (montage restaurant : un plan d’accroche de 3,7 s puis 28 coupes rapides) avec le Samouraï : le chef au passe, l’entrée, la cuisine en action, la salle, les sushis, les plats, les kimonos, et des mains qui servent pour finir. ${song}`,
    slots: ["CUISINE|PERSONNES", "ENTREE|DECO", "CUISINE", "SALLE", "CUISINE", "GESTE|CUISINE", "TABLE", "PLAT", "PLAT", "ENTREE|DECO", "SALLE", "CUISINE|PERSONNES", "SALLE|VUE", "PLAT", "TABLE", "GESTE|PLAT", "PLAT", "PLAT", "DESSERT|PLAT", "TABLE", "PLAT", "GESTE|PLAT", "PLAT", "TRADITION", "PLAT", "DECO", "GESTE|PLAT", "PLAT"] },
  { ...base, name: "samourai-copie-vtzi", ref: "analysis/refs/VTZI7105.json", from: 0, to: 14.5, minShot: 0.1, closeUp: true,
    brief: `Copie de l’edit de référence VTZI7105 (cuisine cinéma ultra-rapide, 59 coupes) avec le Samouraï : ambiance, le chef en action, les sushis, la salle, la tradition, les tables. ${song}`,
    slots: [...R(4, "DECO|SALLE"), ...R(6, "CUISINE"), ...R(2, "PLAT"), ...R(2, "PERSONNES|CUISINE|GESTE"), ...R(8, "PLAT"), ...R(3, "ANNIV|DECO|TABLE"), ...R(4, "SALLE"), ...R(2, "TRADITION"), ...R(4, "TABLE|PLAT"), ...R(6, "PLAT|CUISINE"), ...R(3, "DESSERT|PLAT|TABLE"), ...R(4, "PERSONNES|TRADITION"), ...R(5, "TABLE|PLAT|GESTE"), ...R(2, "ENTREE|VUE|SALLE"), ...R(4, "PLAT|GESTE|CUISINE")] },
  { ...base, name: "samourai-copie-uogv-2", ref: "analysis/refs/UOGV3464-manual.json", from: 0, to: 16.5, minShot: 0.09, refCrop: "384:680:166:60",
    brief: `Deuxième copie de l’edit de référence UOGV3464 (visite du soir, flashs noir et blanc) avec les nouveaux plans du Samouraï : l’entrée, 8 flashs de détails en noir et blanc, la salle, les kimonos, le chef, des flashs de sushis, et la salle pour finir. ${song}`,
    slots: ["ENTREE|SALLE|DECO", ...R(8, "DECO|TRADITION|CUISINE|GESTE|SALLE"), "SALLE", "SALLE|DECO", "DECO|SALLE", "TRADITION", "ENTREE|DECO|SALLE", "TABLE|PLAT", "SALLE|DECO", "TABLE|SALLE", "PERSONNES|TRADITION", "CUISINE|TABLE|DECO", "VUE|DECO|SALLE", ...R(5, "PLAT"), "PLAT|TABLE", "SALLE|PERSONNES"] },
  { ...base, name: "samourai-pmfi-mosaic", need: 1.2, slots: R(9, "PLAT|TABLE|DECO|PERSONNES|CUISINE|TRADITION|GESTE") },
  { ...base, name: "samourai-copie-pmfi", ref: "analysis/refs/PMFI3044.json", from: 5.6, to: 13.0, minShot: 0.1, closeUp: true, light: undefined,
    brief: `Copie de l’edit de référence PMFI3044 avec le Samouraï : une mosaïque 3×3 de sushis en noir et blanc qui passent en couleur une à une, puis 22 gros plans de plats, boissons et gestes sur le beat. ${song}`,
    slots: R(22, "PLAT|TABLE|GESTE|CUISINE|DESSERT|PERSONNES|TRADITION") },
  { ...base, name: "samourai-copie-oyua-2", ref: "analysis/refs/OYUA3954.json", from: 0, to: 14.5, minShot: 0.3, refCrop: "720:820:0:460",
    speeds: [1.88, 2.12, 2.12, 2.2, 1.08, 1.04, 1.04, 1.1, 1.1, 1.31],
    brief: `Copie de l’edit de référence OYUA3954 (tour rapide en travellings accélérés) avec le Samouraï : l’entrée, la salle, le chef, les kimonos, une table, la déco, un plat et l’ambiance. ${song}`,
    slots: ["ENTREE|SALLE|DECO", "SALLE|DECO|PERSONNES", "CUISINE|PERSONNES|GESTE", "SALLE|PERSONNES|DECO", "TRADITION|PERSONNES", "TABLE|PLAT|GESTE", "DECO|SALLE|ENTREE|VUE", "PLAT|TABLE|CUISINE", "PERSONNES|TRADITION|SALLE", "VUE|SALLE|DECO|ENTREE"] },
];
const exclude = ["SAM-030", "SAM-032", "SAM-033", "SAM-038", "SAM-050", "SAM-069", "SAM-071", "SAM-068", "SAM-048", "SAM-049", "SAM-051", "SAM-052",
  "SAM-003", "SAM-005", "SAM-055", "SAM-070", "SAM-039"];
fs.writeFileSync("out/plan_w7.json", JSON.stringify({ exclude, copies }, null, 1));
console.log(copies.map((c) => `${c.name}: ${c.slots.length}`).join("\n"));

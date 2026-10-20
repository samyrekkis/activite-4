// Specs for the second batch of Samouraï Reels and Stories (raw 60 fps iPhone footage, look "encre").
// node edits/specs/samourai-batch2.mjs [filter]
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const common = "Look signature Samouraï « encre ». Sans musique : la cliente ajoute le son. Aucun texte, aucun logo, aucune carte de fin.";
const specs = {
  "reels/samourai-rituel": {
    letterbox: true,
    speed: 0.55,
    brief: `REEL lent (environ 14 s, 100 BPM), format cinéma (bandes noires). Thème « Se préparer » : une visite qui se lit d’un trait. On arrive sur le rooftop, on entre dans la chambre calligraphiée, on s’assoit à la table basse ; un seul fondu doux, la nuit tombe, et l’on finit devant le miroir aux kimonos. Une seule vitesse lente et constante (ralenti 60 i/s), aucun speed ramp. ${common}`,
    shots: [
      { id: "SAM-067", beats: 5 },
      { id: "SAM-075", beats: 6 },
      { id: "SAM-070", beats: 7 },
      { id: "SAM-074", beats: 5, fade: 0.6 },
    ],
  },
  "stories/samourai-lanternes": {
    speed: 0.7,
    brief: `STORY (environ 10 s, 100 BPM). Thème « Sous les lanternes » : la cage aux perruches à l’entrée, la salle rouge sous les lanternes, un serveur qui traverse. Trois plans longs, tous en travelling avant à la même vitesse lente (rushs 60 i/s), coupes dans le sens du mouvement. ${common}`,
    shots: [
      { id: "SAM-064", beats: 5, b: 1.04 },
      { id: "SAM-053", beats: 6, at: 1.6 },
      { id: "SAM-060", beats: 6 },
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
  fs.writeFileSync(file, JSON.stringify({ restaurant: "samourai", bpm: 100, autoMirror: true, out, version, curve: "encre", ...s }, null, 1));
  execFileSync(process.execPath, ["scripts/library/build-plan.mjs", file], { stdio: "inherit" });
}

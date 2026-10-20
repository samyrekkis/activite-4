// Specs for the second batch of Samouraï Reels and Stories (raw 60 fps iPhone footage, look "encre").
// node edits/specs/samourai-batch2.mjs [filter]
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const common = "Look signature Samouraï « encre ». Sans musique : la cliente ajoute le son. Aucun texte, aucun logo, aucune carte de fin.";
const specs = {
  "reels/samourai-rituel": {
    letterbox: true,
    brief: `REEL lent (environ 15 s, 100 BPM), format cinéma (bandes noires sur toute la vidéo). Thème « Le rituel » : du miroir de maquillage aux kimonos, la table laquée, la salle sous les lanternes, puis la chambre calligraphiée et la table basse, pour finir en respiration sur le rooftop. Progression de l’ombre vers la lumière. Technique : speed ramps (vitesse réelle puis ralenti soudain, rushs 60 i/s). ${common}`,
    shots: [
      { id: "SAM-074", ramp: [1, 3, 0.35] },
      { id: "SAM-055", beats: 3, speed: 0.6 },
      { id: "SAM-058", beats: 4, speed: 0.5 },
      { id: "SAM-075", ramp: [1, 2, 0.4] },
      { id: "SAM-070", ramp: [1, 2, 0.4] },
      { id: "SAM-067", beats: 6, speed: 0.48 },
    ],
  },
  "reels/samourai-lanternes": {
    brief: `REEL lent (environ 19 s, 100 BPM). Thème « Sous les lanternes » : on entre par la cage aux perruches, puis on glisse dans la salle rouge sous les lanternes, un serveur passe, on finit sur les coussins. Technique : quasi plan-séquence — plans très longs, tous en travelling avant au ralenti (rushs 60 i/s), coupes invisibles dans le sens du mouvement. ${common}`,
    shots: [
      { id: "SAM-064", beats: 5, speed: 0.8, b: 1.04 },
      { id: "SAM-053", beats: 6, speed: 0.7, at: 1.6 },
      { id: "SAM-059", beats: 5, speed: 0.8, at: 1.25 },
      { id: "SAM-056", beats: 4, speed: 0.8, at: 1.9 },
      { id: "SAM-060", beats: 6, speed: 0.75 },
      { id: "SAM-054", beats: 6, speed: 0.75 },
    ],
  },
  "stories/samourai-recoins": {
    brief: `STORY (environ 13 s, 100 BPM). Thème « Les recoins du Samouraï » : l'escalier sous la lanterne, le salon aux coussins jaunes et le vase calligraphié côte à côte, puis le jardin au néon. Technique : travellings lents puis un écran partagé en deux colonnes au milieu. ${common}`,
    shots: [
      { id: "SAM-066", beats: 4, speed: 1 },
      { id: "SAM-061", beats: 4, speed: 0.8, mirror: true },
      { id: "SAM-072", beats: 4, speed: 0.8, panels: ["SAM-073"], layout: "columns", motion: "zoomIn" },
      { id: "SAM-079", beats: 3, speed: 0.8 },
      { id: "SAM-080", beats: 4, speed: 0.8, reframe: { scale: 1.1, origin: "right center" } },
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

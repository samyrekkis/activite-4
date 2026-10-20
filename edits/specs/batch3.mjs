// Batch 3: Reels to reach ten publishable videos. Rules from the client: each edit
// reads as a visit or a story, day and night grouped, one constant slow speed,
// at most one soft fade, no near-duplicate shot, no text and no end card.
// node edits/specs/batch3.mjs [filter]
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const common = "Une seule vitesse lente et constante, coupes dans le sens du mouvement. Sans musique : la cliente ajoute le son. Aucun texte, aucun logo, aucune carte de fin.";
const specs = {
  "reels/monegasque-le-haik": {
    restaurant: "monegasque",
    curve: "film",
    speed: 0.9,
    stabilize: true,
    brief: `REEL lent (environ 15 s, 100 BPM). Thème « Le haïk » (tenue traditionnelle) : de jour sur la terrasse, une femme en haïk au bord de la piscine se dévoile ; puis le soir, sous les néons : le voile brodé en gros plan, elle ajuste son voile, puis le trône doré. ${common}`,
    shots: [
      { id: "MON-043", beats: 4 },
      { id: "MON-001", beats: 4 },
      { id: "MON-002", beats: 5 },
      { id: "MON-050", beats: 3 },
      { id: "MON-048", beats: 2 },
      { id: "MON-047", beats: 3 },
      { id: "MON-042", beats: 4, b: 0.95, reframe: { scale: 1.12, origin: "right bottom" } },
    ],
  },
  "reels/monegasque-le-brunch": {
    restaurant: "monegasque",
    curve: "portra",
    speed: 0.9,
    stabilize: true,
    brief: `REEL lent (environ 17 s, 100 BPM). Thème « Le brunch » : la table en surplomb de la piscine, le petit-déjeuner servi, les mains qui se servent, le couvercle du tajine qu’on soulève, les milkshakes qui trinquent, et le gâteau aux fraises pour finir. ${common}`,
    shots: [
      { id: "MON-145", beats: 4 },
      { id: "MON-051", beats: 4 },
      { id: "MON-055", beats: 3 },
      { id: "MON-007", beats: 4 },
      { id: "MON-066", beats: 3 },
      { id: "MON-082", beats: 5 },
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
  fs.writeFileSync(file, JSON.stringify({ bpm: 100, out, version, ...s }, null, 1));
  execFileSync(process.execPath, ["scripts/library/build-plan.mjs", file], { stdio: "inherit" });
}

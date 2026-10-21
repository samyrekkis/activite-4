// Names extracted clips with Gemini from their still (one .jpg per clip), in the
// names.json format build_library.py expects.
//   node scripts/library/name_clips.mjs <work_dir> <out names.json> "<restaurant description>"
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";
import { loadEnv } from "../lib/media.mjs";

loadEnv();
const [dir, out, desc] = process.argv.slice(2);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const models = (process.env.GEMINI_MODEL || "gemini-3.1-pro-preview,gemini-3.8-flash,gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-3-flash-preview,gemini-3.1-flash-lite")
  .split(",").map((m) => m.trim()).filter(Boolean);
const done = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {};
const clips = readdirSync(dir).filter((f) => f.endsWith(".mp4") && existsSync(`${dir}/${f.replace(".mp4", ".jpg")}`))
  .map((f) => f.replace(".mp4", "")).filter((c) => !done[c]);

const schema = { type: "array", items: { type: "object", properties: {
  clip: { type: "string" },
  name: { type: "string", description: "Description courte en français (4 à 9 mots), concrète : ce qu'on voit (ex : « chef qui découpe le thon au comptoir »)." },
  category: { type: "string", enum: ["plat", "dessert", "boisson", "table", "geste", "salle", "deco", "exterieur", "cuisine", "personnes"] },
  view: { type: "string", enum: ["gros-plan", "moyen", "large", "dessus"] },
  light: { type: "string", enum: ["jour", "nuit"] },
  quality: { type: "integer", description: "0 = inutilisable (flou, noir, texte ou logo incrusté, écran Instagram, enfant identifiable), 1 = faible, 2 = correct, 3 = très beau." },
}, required: ["clip", "name", "category", "view", "light", "quality"] } };

for (let i = 0; i < clips.length; i += 12) {
  const batch = clips.slice(i, i + 12);
  const parts = batch.flatMap((c) => [{ text: `Clip ${c} :` }, { inlineData: { mimeType: "image/jpeg", data: readFileSync(`${dir}/${c}.jpg`).toString("base64") } }]);
  parts.push({ text: `Ce sont des images de clips vidéo d'un restaurant (${desc}). Pour CHAQUE clip, donne son nom, sa catégorie (cuisine = chef ou cuisson en cuisine), son cadrage, jour/nuit et sa qualité pour un Reel. Réponds pour tous les clips : ${batch.join(", ")}.` });
  let res = null;
  for (const model of models) {
    try {
      const r = await ai.models.generateContent({ model, contents: [{ role: "user", parts }], config: { responseMimeType: "application/json", responseJsonSchema: schema, temperature: 0.2 } });
      res = JSON.parse(r.text); break;
    } catch (e) { if ([429, 503, 404].includes(e.status ?? 0)) continue; console.log(`  ${model}: ${e.message}`); }
  }
  if (!res) { console.log("Gemini indisponible, arrêt."); break; }
  for (const x of res) if (batch.includes(x.clip)) done[x.clip] = { name: x.name, category: x.category, view: x.view, light: x.light, quality: x.quality };
  writeFileSync(out, JSON.stringify(done, null, 1));
  console.log(`${Object.keys(done).length} clips nommés`);
}

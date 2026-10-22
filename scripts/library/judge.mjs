// Standalone verdict on a finished video (no reference): does the edit make sense, does
// the song fit the pictures and the cuts, are shots repeated, would it work on Instagram.
//   node scripts/library/judge.mjs <out.json> <video>...
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { GoogleGenAI, createPartFromUri, createUserContent } from "@google/genai";
import { loadEnv } from "../lib/media.mjs";
loadEnv();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const [out, ...videos] = process.argv.slice(2);
const done = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {};
const models = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3-flash-preview", "gemini-3.8-flash"];
const schema = { type: "object", properties: {
  sens: { type: "number", description: "0-10 : le montage raconte-t-il quelque chose de logique (arrivée, salle, ambiance, table, plats, détails, fin) ou saute-t-il au hasard ?" },
  accordSon: { type: "number", description: "0-10 : la musique colle-t-elle aux images (style, énergie) et les coupes tombent-elles sur le rythme ?" },
  qualite: { type: "number", description: "0-10 : images nettes, lumineuses, appétissantes, sans plan raté, noir, flou, logo, enfant." },
  repetitions: { type: "string", description: "Plans répétés ou presque identiques dans la vidéo." },
  problemes: { type: "string", description: "Ce qui ne va pas, précisément, avec les secondes." },
  verdict: { type: "string", enum: ["garder", "corriger", "refaire"] },
}, required: ["sens", "accordSon", "qualite", "repetitions", "problemes", "verdict"] };
const prompt = "Tu es directeur artistique pour les réseaux sociaux de restaurants. Voici un Reel Instagram vertical, avec son son. Juge-le sévèrement pour la page Instagram du restaurant : est-ce que ça a du sens, est-ce que le son s'accorde avec la vidéo, est-ce que la qualité est publiable. Réponds en français.";
for (const v of videos) {
  const key = v.split("/").pop();
  if (done[key]) continue;
  let file = await ai.files.upload({ file: v, config: { mimeType: "video/mp4" } });
  while (file.state === "PROCESSING") { await new Promise((r) => setTimeout(r, 3000)); file = await ai.files.get({ name: file.name }); }
  let res = null;
  for (const model of models) {
    try { const r = await ai.models.generateContent({ model, contents: createUserContent([createPartFromUri(file.uri, file.mimeType), prompt]), config: { responseMimeType: "application/json", responseJsonSchema: schema, temperature: 0.2 } }); res = { ...JSON.parse(r.text), model }; break; }
    catch (e) { console.log(key.slice(0,20), model, e.status, String(e.message).slice(0,140)); }
  }
  if (!res) { console.log(`${key}: Gemini indisponible`); continue; }
  done[key] = res; writeFileSync(out, JSON.stringify(done, null, 1));
  console.log(`${res.verdict.padEnd(8)} sens ${res.sens} son ${res.accordSon} qualité ${res.qualite}  ${key}`);
}

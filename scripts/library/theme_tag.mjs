// Tags every library clip with the client's themes (from one still per clip), so videos
// can be built around a theme: outfits, children, friends at dinner, birthdays, romance.
//   node scripts/library/theme_tag.mjs <restaurant>
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { GoogleGenAI } from "@google/genai";
import { loadEnv } from "../lib/media.mjs";
loadEnv();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const resto = process.argv[2];
const dir = `public/library/${resto}/clips`, still = `out/stills-${resto}`, out = `public/library/${resto}/themes.json`;
fs.mkdirSync(still, { recursive: true });
const cat = JSON.parse(fs.readFileSync(`public/library/${resto}/catalogue.json`, "utf8")).clips;
const done = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : {};
const todo = cat.filter((m) => !done[m.id]);
for (const m of todo) {
  const jpg = `${still}/${m.id}.jpg`;
  if (!fs.existsSync(jpg)) execFileSync("ffmpeg", ["-v", "error", "-y", "-nostdin", "-ss", String(Math.max(0, m.duration / 2)), "-i", `${dir}/${m.id}.mp4`, "-frames:v", "1", "-vf", "scale=-2:360", jpg]);
}
const schema = { type: "array", items: { type: "object", properties: {
  clip: { type: "string" },
  themes: { type: "array", items: { type: "string", enum: ["tenues", "enfants", "amis", "anniversaire", "diner", "romantique", "cuisine", "plats", "boissons", "deco", "salle", "exterieur", "service"] } },
  ambiance: { type: "string", enum: ["joyeux", "festif", "calme", "romantique", "elegant"] },
  lumiere: { type: "string", enum: ["claire", "moyenne", "sombre"] },
  logo: { type: "boolean", description: "Logo ou nom du restaurant imprimé/écrit visible" },
}, required: ["clip", "themes", "ambiance", "lumiere", "logo"] } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < todo.length; i += 12) {
  const batch = todo.slice(i, i + 12).map((m) => m.id);
  const parts = batch.flatMap((c) => [{ text: `Clip ${c} :` }, { inlineData: { mimeType: "image/jpeg", data: fs.readFileSync(`${still}/${c}.jpg`).toString("base64") } }]);
  parts.push({ text: `Images de clips d'un restaurant. Pour CHAQUE clip (${batch.join(", ")}), donne les thèmes présents (tenues = tenues traditionnelles kimono/haïk/caftan ou looks soignés ; enfants = un enfant est visible ; amis = groupe d'amis ou clients qui partagent un moment ; anniversaire = gâteau, bougies, ballons, fête ; diner = repas à table ; romantique = couple, bougies, ambiance tamisée à deux), l'ambiance, la lumière et s'il y a un logo.` });
  let res = null;
  // Free keys have a daily quota per model: try the next model when one is used up.
  const models = ["gemini-3.5-flash", "gemini-3-flash-preview", "gemini-3.1-flash-lite"];
  for (let t = 0; t < 9 && !res; t++) {
    try { const r = await ai.models.generateContent({ model: models[t % models.length], contents: [{ role: "user", parts }], config: { responseMimeType: "application/json", responseJsonSchema: schema, temperature: 0.1 } }); res = JSON.parse(r.text); }
    catch (e) { await sleep(e.status === 429 ? 3000 : 5000); }
  }
  if (!res) { console.log("Gemini indisponible, arrêt"); break; }
  for (const x of res) if (batch.includes(x.clip)) done[x.clip] = { themes: x.themes, ambiance: x.ambiance, lumiere: x.lumiere, logo: x.logo };
  fs.writeFileSync(out, JSON.stringify(done, null, 1));
  console.log(`${resto}: ${Object.keys(done).length}/${cat.length}`);
  await sleep(4000);
}

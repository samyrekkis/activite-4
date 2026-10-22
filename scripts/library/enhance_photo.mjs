// AI retouch of a REAL photo (sharpness, exposure, colour) with Gemini image models,
// strictly without adding, removing or changing anything in the scene.
//   node scripts/library/enhance_photo.mjs <in.jpg> <out.png>
import fs from "node:fs";
import { GoogleGenAI } from "@google/genai";
import { loadEnv } from "../lib/media.mjs";
loadEnv();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const [inp, out] = process.argv.slice(2);
const prompt = "Retouche photo professionnelle de cette photo de restaurant : rends-la plus nette et détaillée, corrige l'exposition (ombres plus ouvertes, pas de zones brûlées), couleurs naturelles et appétissantes, réduis le bruit. Interdit : ajouter, retirer, déplacer ou modifier un objet, une personne, un plat, un texte ou le décor. Même cadrage, même composition, même format vertical.";
for (const model of ["gemini-3-pro-image-preview", "gemini-2.5-flash-image", "gemini-3.1-flash-image-preview"]) {
  try {
    const r = await ai.models.generateContent({ model, contents: [{ role: "user", parts: [{ inlineData: { mimeType: "image/jpeg", data: fs.readFileSync(inp).toString("base64") } }, { text: prompt }] }] });
    const img = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
    if (img) { fs.writeFileSync(out, Buffer.from(img.data, "base64")); console.log("OK", model); process.exit(0); }
    console.log(model, "pas d'image");
  } catch (e) { console.log(model, e.status, String(e.message).slice(0, 100)); }
}
process.exit(1);

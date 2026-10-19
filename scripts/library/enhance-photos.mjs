// Retouches the extracted photos with a Gemini image model: light, sharpness,
// appetising colour, without changing what is on the plate or in the room.
//   npm run photos:enhance -- "<photo or folder>" [--out "<folder>"] [--format 4:5|9:16|1:1] [--model gemini-3.1-flash-image]
// Writes "<name> (retouchée).jpg" next to the originals (or in --out).
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { GoogleGenAI } from "@google/genai";
import { loadEnv } from "../lib/media.mjs";

loadEnv();
const args = process.argv.slice(2);
const flag = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const valueIdx = new Set(["--out", "--format", "--model"].map((f) => args.indexOf(f) + 1).filter((i) => i > 0));
const inputs = args.filter((a, i) => !a.startsWith("--") && !valueIdx.has(i));
if (!inputs.length || !process.env.GEMINI_API_KEY) {
  console.error('Usage: npm run photos:enhance -- "<photo ou dossier>" [--out dossier] [--format 4:5]  (GEMINI_API_KEY dans .env)');
  process.exit(1);
}
const format = flag("--format", "4:5");
const model = flag("--model", "gemini-3.1-flash-image");
const outDir = flag("--out");

const PROMPT = `Retouche professionnelle de cette photo de restaurant, comme un photographe culinaire pour Instagram.
- Améliore la lumière (exposition équilibrée, ombres débouchées), la netteté et le contraste local.
- Couleurs naturelles et appétissantes, blancs neutres, peau naturelle.
- Retire le flou de compression et le bruit.
- Ne change RIEN au contenu : mêmes plats, mêmes quantités, même décor, mêmes personnes. N'ajoute ni ne retire aucun objet, aucun texte, aucun logo.
- Cadrage au format ${format}, en gardant le sujet principal entier.`;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const files = inputs
  .flatMap((p) => (statSync(p).isDirectory() ? readdirSync(p).map((f) => join(p, f)) : [p]))
  .filter((f) => /\.(jpe?g|png)$/i.test(f) && !/\(retouchée\)/.test(f));

for (const file of files) {
  const out = join(outDir ?? dirname(file), `${basename(file, extname(file))} (retouchée).jpg`);
  if (existsSync(out)) {
    console.log(`${basename(out)} existe déjà, ignorée.`);
    continue;
  }
  try {
    const res = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: PROMPT }, { inlineData: { mimeType: "image/jpeg", data: readFileSync(file).toString("base64") } }] }],
      config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: format } },
    });
    const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!part) throw new Error(res.candidates?.[0]?.finishReason ?? "aucune image renvoyée");
    if (outDir) mkdirSync(outDir, { recursive: true });
    writeFileSync(out, Buffer.from(part.inlineData.data, "base64"));
    console.log(`OK  ${basename(out)}`);
  } catch (err) {
    console.error(`ERREUR ${basename(file)} : ${String(err.message ?? err).slice(0, 300)}`);
  }
}

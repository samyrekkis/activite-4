// Judges how close a copy is to the reference edit the client wants reproduced.
//   node scripts/compare-review.mjs <copy.mp4> <ref.mp4> [ref_from] [ref_to] [plan.json]
// Gemini watches both (the reference trimmed to the copied window) and scores, out of 10:
// resemblance (rhythm, shot types, framing, energy), colour (look close to the reference
// and good on food), fluidity. Writes reviews/compare-<copy>.json.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { GoogleGenAI, createPartFromUri, createUserContent } from "@google/genai";
import { loadEnv } from "./lib/media.mjs";

loadEnv();
const [copy, ref, fromArg, toArg, planPath] = process.argv.slice(2);
const from = Number(fromArg ?? 0);
const to = toArg ? Number(toArg) : null;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const models = (process.env.GEMINI_MODEL || "gemini-3.1-pro-preview,gemini-3.8-flash,gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-flash-latest")
  .split(",").map((m) => m.trim()).filter(Boolean);
const plan = planPath && existsSync(planPath) ? JSON.parse(readFileSync(planPath, "utf8")) : null;

// The reference is trimmed to the copied part (no logo or Instagram end screen).
mkdirSync("out/compare", { recursive: true });
const refCut = `out/compare/${basename(ref, ".MP4")}-${from}-${to ?? "end"}.mp4`;
if (!existsSync(refCut)) {
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(from), ...(to ? ["-t", String(to - from)] : []), "-i", ref,
    "-c:v", "libx264", "-crf", "20", "-an", refCut]);
}

const isNetwork = (err) => !err.status && /fetch failed|ECONNRESET|timeout|socket/i.test(`${err.message} ${err.cause?.code ?? ""}`);
const upload = async (path) => {
  let file;
  for (let i = 1; ; i++) {
    try { file = await ai.files.upload({ file: path, config: { mimeType: "video/mp4" } }); break; }
    catch (err) { if (!isNetwork(err) || i >= 4) throw err; await new Promise((r) => setTimeout(r, i * 15000)); }
  }
  while (file.state === "PROCESSING") { await new Promise((r) => setTimeout(r, 3000)); file = await ai.files.get({ name: file.name }); }
  if (file.state !== "ACTIVE") throw new Error(`Gemini n'a pas pu traiter ${path}`);
  return file;
};

const schema = {
  type: "object",
  properties: {
    resemblanceScore: { type: "number", description: "0-10 : à quel point la COPIE ressemble à la RÉFÉRENCE (rythme et durée des plans, types de plans dans le même ordre : large/détail/geste/mouvement, cadrages, mouvements de caméra, énergie, structure). 10 = on dirait le même monteur." },
    colorScore: { type: "number", description: "0-10 : proximité de l'étalonnage de la COPIE avec la RÉFÉRENCE (luminosité, contraste, densité des noirs, saturation, température, teinte) tout en gardant des plats appétissants." },
    fluidityScore: { type: "number", description: "0-10 : fluidité de la COPIE (raccords, lisibilité, pas d'à-coups, pas de plan raté)." },
    resemblance: { type: "string", description: "Ce qui ressemble et ce qui diffère, section par section de la référence." },
    color: { type: "string", description: "Écarts d'étalonnage précis (ex : copie trop claire, trop rouge, noirs pas assez denses) et réglages à appliquer." },
    fluidity: { type: "string" },
    colorFix: {
      type: "object",
      description: "Réglages globaux à appliquer à la COPIE pour que son étalonnage se rapproche de la RÉFÉRENCE (1 = inchangé).",
      properties: {
        brightness: { type: "number", description: "Multiplicateur d'exposition, 0.8 à 1.3." },
        contrast: { type: "number", description: "Multiplicateur de contraste, 0.8 à 1.3." },
        saturate: { type: "number", description: "Multiplicateur de saturation, 0.6 à 1.5." },
        warmth: { type: "number", description: "-1 (plus froid/bleu) à +1 (plus chaud/orangé), 0 = inchangé." },
      },
      required: ["brightness", "contrast", "saturate", "warmth"],
    },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          timestamp: { type: "string" },
          shot: { type: "string", description: "Numéro du plan de la copie (#n) si identifiable." },
          category: { type: "string", enum: ["ressemblance", "couleur", "fluidite", "technique"] },
          problem: { type: "string" },
          fix: { type: "string", description: "Correction concrète : quel type de plan mettre à la place (large, détail, geste, mouvement…), réglage couleur…" },
        },
        required: ["timestamp", "category", "problem", "fix"],
      },
    },
  },
  required: ["resemblanceScore", "colorScore", "fluidityScore", "resemblance", "color", "fluidity", "colorFix", "issues"],
};

const prompt = `Tu es monteur et étalonneur senior. Une cliente veut que l'on REPRODUISE le plus fidèlement possible un edit Instagram de référence, mais avec les images de son restaurant (${plan?.restaurant === "samourai" ? "Le Samouraï, asiatique" : "Le Monégasque, méditerranéen, déco colorée"}).
La PREMIÈRE vidéo est la COPIE. La SECONDE est la RÉFÉRENCE. Les coupes de la copie sont calées sur les mêmes instants que la référence ; la chanson sera ajoutée par la cliente, donc ignore le son.
Compare-les sans complaisance et note la ressemblance, la proximité des couleurs et la fluidité de la copie. Le contenu (plats, lieu) est forcément différent : juge la ressemblance sur la forme (rythme, type et ordre des plans, cadrages, mouvements, énergie, structure), pas sur les objets filmés.
${plan ? `Plans de la copie (ordre et durée) : ${plan.clips.map((c, i) => `#${i + 1} ${((c.end - c.start) / (c.speed ?? 1)).toFixed(2)}s ${c.label.replace(/^#\d+\s*/, "")}`).join(" | ")}` : ""}`;

const files = [await upload(copy), await upload(refCut)];
let result, used;
for (const model of models) {
  try {
    const r = await ai.models.generateContent({ model, contents: createUserContent([...files.map((f) => createPartFromUri(f.uri, f.mimeType)), prompt]),
      config: { responseMimeType: "application/json", responseJsonSchema: schema, temperature: 0.3 } });
    result = JSON.parse(r.text); used = model; break;
  } catch (err) {
    if ([429, 503, 404].includes(err.status ?? 0) || isNetwork(err)) { console.log(`  ${model} indisponible, modèle suivant.`); continue; }
    throw err;
  }
}
for (const f of files) await ai.files.delete({ name: f.name }).catch(() => {});
if (!result) throw new Error("Aucun modèle Gemini disponible.");
mkdirSync("reviews", { recursive: true });
writeFileSync(`reviews/compare-${basename(copy, ".mp4")}.json`, JSON.stringify({ model: used, ...result }, null, 2));
console.log(`Comparaison par ${used}`);
console.log(`Ressemblance : ${result.resemblanceScore}/10. ${result.resemblance}`);
console.log(`Couleur : ${result.colorScore}/10. ${result.color}`);
console.log(`Fluidité : ${result.fluidityScore}/10. ${result.fluidity}`);
console.log(`Correction couleur : ${JSON.stringify(result.colorFix)}`);
for (const i of result.issues) console.log(`  [${i.category}] ${i.timestamp} ${i.shot ?? ""} : ${i.problem}\n      -> ${i.fix}`);

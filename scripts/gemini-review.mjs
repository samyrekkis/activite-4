// Usage: npm run review -- out/plan-v1.mp4 edits/plan.json [--ref public/refs/exemple.mp4]
// Gemini watches the render (and the reference, if given) and returns a
// structured critique that Claude turns into the next version of the plan.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { GoogleGenAI, createPartFromUri, createUserContent } from "@google/genai";
import { loadEnv } from "./lib/media.mjs";

loadEnv();
const args = process.argv.slice(2);
const refIdx = args.indexOf("--ref");
const ref = refIdx >= 0 ? args[refIdx + 1] : null;
const positional = args.filter((a, i) => !a.startsWith("--") && (refIdx < 0 || i !== refIdx + 1));
const video = positional.find((a) => !a.endsWith(".json"));
const planPath = positional.find((a) => a.endsWith(".json"));

if (!video || !planPath) {
  console.error("Usage: npm run review -- out/plan-v1.mp4 edits/plan.json [--ref public/refs/exemple.mp4]");
  process.exit(1);
}
if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY manquante : copie .env.example en .env et colle ta clé (https://aistudio.google.com/apikey).");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const model = process.env.GEMINI_MODEL || "gemini-2.5-pro";
const plan = JSON.parse(readFileSync(planPath, "utf8"));
const name = basename(planPath, ".json");
const version = plan.version ?? 1;

const upload = async (path) => {
  let file = await ai.files.upload({ file: path, config: { mimeType: "video/mp4" } });
  while (file.state === "PROCESSING") {
    await new Promise((r) => setTimeout(r, 3000));
    file = await ai.files.get({ name: file.name });
  }
  if (file.state !== "ACTIVE") throw new Error(`Gemini n'a pas pu traiter ${path} (${file.state})`);
  return file;
};

// Previous critiques of this plan, so Gemini can check whether issues were fixed.
mkdirSync("reviews", { recursive: true });
const previous = readdirSync("reviews")
  .filter((f) => f.startsWith(`${name}-v`) && f.endsWith(".json") && f !== `${name}-v${version}.json`)
  .sort()
  .map((f) => JSON.parse(readFileSync(`reviews/${f}`, "utf8")));

const schema = {
  type: "object",
  properties: {
    score: { type: "number", description: "Note globale /10, exigeante (7 = publiable, 9 = excellent)." },
    verdict: { type: "string", enum: ["a_retravailler", "presque_pret", "pret_a_publier"] },
    summary: { type: "string" },
    hook: { type: "string", description: "Les 2 premières secondes accrochent-elles ? Pourquoi ?" },
    pacing: { type: "string", description: "Rythme, durée des plans, synchronisation avec la musique." },
    matchesReference: { type: "string", description: "Écarts de style avec la vidéo de référence (si fournie)." },
    strengths: { type: "array", items: { type: "string" } },
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          timestamp: { type: "string", description: "mm:ss ou plage mm:ss-mm:ss" },
          clipLabel: { type: "string", description: "Label du clip concerné dans le plan (ex: #3), si identifiable." },
          category: {
            type: "string",
            enum: ["rythme", "transition", "couleur", "cadrage", "texte", "son", "histoire", "technique", "food_appeal"],
          },
          severity: { type: "string", enum: ["bloquant", "important", "mineur"] },
          problem: { type: "string" },
          fix: { type: "string", description: "Correction concrète et applicable au plan JSON." },
        },
        required: ["timestamp", "category", "severity", "problem", "fix"],
      },
    },
    fixedSincePrevious: { type: "array", items: { type: "string" } },
  },
  required: ["score", "verdict", "summary", "hook", "pacing", "strengths", "issues"],
};

const prompt = `Tu es directeur artistique et monteur senior spécialisé dans les vidéos de restaurants pour Instagram Reels et TikTok.
Un monteur (Claude) a produit la vidéo jointe à partir du plan de montage JSON ci-dessous. Critique-la sans complaisance pour qu'il puisse la corriger.

Restaurant : ${plan.restaurant === "samourai" ? "Le Samouraï, cuisine asiatique, shootings en kimono, miroir de maquillage, chambre avec table basse traditionnelle" : "Le Monégasque, brunchs et plats généreux, décoration soignée"}.
Brief : ${plan.brief ?? "non précisé"}
${ref ? "La SECONDE vidéo jointe est la RÉFÉRENCE de style à imiter (rythme, transitions, textes, étalonnage, énergie). Compare précisément." : ""}

Évalue : accroche des 2 premières secondes, rythme et calage sur le beat, transitions, étalonnage et appétence des plats (food appeal), lisibilité et timing des textes, son (musique, effets sonores, niveaux), cohérence de marque, fin et appel à l'action, défauts techniques (saut d'image, flou, noir, image figée, texte coupé).
Les timestamps doivent être exacts. Chaque correction doit être concrète et applicable au plan JSON (start/end, speed, motion, transitionIn, text, sfx, grade, ordre des clips).
${previous.length ? `Critiques précédentes (vérifie ce qui a été corrigé) : ${JSON.stringify(previous.map((p) => ({ version: p.version, score: p.score, issues: p.issues })))}` : ""}

Plan de montage (version ${version}) :
${JSON.stringify(plan, null, 2)}`;

console.log(`Envoi à Gemini (${model}) : ${video}${ref ? ` + référence ${ref}` : ""}…`);
const files = [await upload(video)];
if (ref && existsSync(ref)) files.push(await upload(ref));

const response = await ai.models.generateContent({
  model,
  contents: createUserContent([...files.map((f) => createPartFromUri(f.uri, f.mimeType)), prompt]),
  config: { responseMimeType: "application/json", responseJsonSchema: schema, temperature: 0.4 },
});

const review = { version, video, model, date: new Date().toISOString(), ...JSON.parse(response.text) };
const out = `reviews/${name}-v${version}.json`;
writeFileSync(out, JSON.stringify(review, null, 2));

for (const f of files) await ai.files.delete({ name: f.name }).catch(() => {});

console.log(`\nNote : ${review.score}/10 (${review.verdict})`);
console.log(review.summary);
for (const i of review.issues) {
  console.log(`  [${i.severity}] ${i.timestamp} ${i.clipLabel ?? ""} ${i.category} : ${i.problem}\n      -> ${i.fix}`);
}
console.log(`\nCritique : ${out}`);

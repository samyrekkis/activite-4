// Usage: npm run review -- out/plan-v1.mp4 edits/plan.json [--ref public/refs/exemple.mp4]
// Gemini watches the render (and the reference, if given) and returns a
// structured critique that Claude turns into the next version of the plan.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { GoogleGenAI, createPartFromUri, createUserContent } from "@google/genai";
import { loadEnv } from "./lib/media.mjs";
import { describeTimeline } from "./lib/timeline.mjs";

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
// Tried in order: a model out of quota (429) or overloaded (503, after retries) falls through to the next.
const models = (process.env.GEMINI_MODEL || "gemini-3.1-pro-preview,gemini-3.8-flash,gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-flash-latest")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
const plan = JSON.parse(readFileSync(planPath, "utf8"));
// What the user taught us on previous edits: Gemini must judge against it too.
const preferences = existsSync("PREFERENCES.md") ? readFileSync("PREFERENCES.md", "utf8") : "";
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
    fluidityScore: { type: "number", description: "Fluidité et niveau professionnel du montage, de 0 à 10 (10 = monteur pro haut de gamme)." },
    colorScore: { type: "number", description: "Qualité de l'étalonnage de 0 à 10 (justesse du look pour le thème, raccords couleur entre plans, peau, blancs, appétence)." },
    color: { type: "string", description: "Analyse d'étalonneur : le look choisi sert-il le thème ? Plans trop sombres/clairs/froids par rapport aux voisins ? Correction précise (courbe, luminosité par plan)." },
    fluidity: { type: "string", description: "Analyse détaillée de la fluidité : raccords, continuité du mouvement, logique d'enchaînement, effets superflus, ce qui fait amateur." },
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
            enum: ["fluidite", "rythme", "transition", "couleur", "cadrage", "texte", "son", "histoire", "technique", "food_appeal"],
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
  required: ["score", "verdict", "summary", "fluidityScore", "fluidity", "colorScore", "color", "hook", "pacing", "strengths", "issues"],
};

const prompt = `Tu es directeur artistique et monteur senior spécialisé dans les vidéos de restaurants pour Instagram Reels et TikTok.
Un monteur (Claude) a produit la vidéo jointe à partir du plan de montage JSON ci-dessous. Critique-la sans complaisance pour qu'il puisse la corriger.

Restaurant : ${plan.restaurant === "samourai" ? "Le Samouraï, cuisine asiatique, shootings en kimono, miroir de maquillage, chambre avec table basse traditionnelle" : "Le Monégasque, brunchs et plats généreux, décoration soignée"}.
Brief : ${plan.brief ?? "non précisé"}
${ref ? "La SECONDE vidéo jointe est la RÉFÉRENCE de style à imiter (rythme, transitions, textes, étalonnage, énergie). Compare précisément." : ""}

PRIORITÉ N°1 DU CLIENT : LA FLUIDITÉ ET LE NIVEAU PROFESSIONNEL. Le client trouve que les montages « font amateur » et manquent de fluidité. Parle beaucoup de ça, avec précision, plan par plan.
Juge comme un monteur de pubs haut de gamme. Signes d'un montage amateur, à relever systématiquement :
- trop de types de transitions différents, transitions « gadget » (rotation, stores, retournement, volet circulaire, iris, glitch) qui attirent l'attention sur l'effet au lieu du sujet ;
- zooms numériques et punch-in sur des plans qui bougent déjà, à-coups, flashs, plans trop courts pour être lus (moins de 0,4 s) ;
- raccords sans logique : sauts jour/nuit ou lieu/plat sans fil conducteur, mouvements de caméra qui changent de sens d'un plan à l'autre, cadrages qui se contredisent, changements d'étalonnage visibles ;
- coupes hors du beat, rythme haché ou monotone, absence de respiration ;
- cartes ou éléments graphiques qui coupent le flux.
Signes d'un montage pro : coupes franches sur le beat, raccords dans le mouvement (le geste ou le mouvement de caméra continue d'un plan à l'autre), séquences regroupées par lieu et par lumière, progression claire (accroche, montée, respiration, fin), effets rares et toujours au service du sujet.
ÉTALONNAGE : juge aussi comme un étalonneur expert. Le look doit servir le thème : couleurs vives et blancs propres pour une déco colorée ou un brunch de jour, ambiance sombre et contrastée pour la nuit, peaux naturelles, plats appétissants (jamais gris, verts ou violets). Les plans voisins doivent raccorder en exposition et en température. Looks disponibles pour grade.curve : vibrant, pastel, portra, golden, film, tealOrange, moody, neon, tokyo, bleach, noir ; grade.brightness ajuste un plan.
ORIGINALITÉ : le thème doit être clair et original, et le hook accrocheur dès la première image.
La note globale ne doit JAMAIS dépasser fluidityScore + 1. Chaque problème de fluidité doit avoir une correction concrète (quelle transition remplacer par une coupe, quel clip déplacer, quel mouvement supprimer, quel plan rallonger).

${plan.music ? "" : "La musique et les sons seront ajoutés plus tard par le client : ne juge pas et ne pénalise pas l'absence de son.\n"}Évalue aussi : accroche des 2 premières secondes, rythme et calage sur le beat, transitions, étalonnage et appétence des plats (food appeal), lisibilité et timing des textes, son (musique, effets sonores, niveaux), cohérence de marque, fin et appel à l'action, défauts techniques (saut d'image, flou, noir, image figée, texte coupé).
Les timestamps doivent être exacts. Chaque correction doit être concrète et applicable au plan JSON (start/end, speed, motion, transitionIn, text, sfx, grade, ordre des clips).
${previous.length ? `Critiques précédentes (vérifie ce qui a été corrigé) : ${JSON.stringify(previous.map((p) => ({ version: p.version, score: p.score, issues: p.issues })))}` : ""}

${preferences ? `Préférences du client, apprises de ses remarques (elles priment sur tes goûts ; signale toute violation comme "bloquant") :\n${preferences}\n` : ""}
Chronologie réelle du rendu (début de chaque plan à l'écran, chevauchements de transition déduits). Les "duration" du plan INCLUENT la transition vers le plan suivant : juge le rythme sur ces instants de début, pas sur les durées brutes.
${describeTimeline(plan)}

Plan de montage (version ${version}) :
${JSON.stringify(plan, null, 2)}`;

console.log(`Envoi à Gemini : ${video}${ref ? ` + référence ${ref}` : ""}…`);
const files = [await upload(video)];
if (ref && existsSync(ref)) files.push(await upload(ref));

const generate = async () => {
  for (const model of models) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: createUserContent([...files.map((f) => createPartFromUri(f.uri, f.mimeType)), prompt]),
          config: { responseMimeType: "application/json", responseJsonSchema: schema, temperature: 0.4 },
        });
        return { model, response };
      } catch (err) {
        const status = err.status ?? 0;
        if (status === 503 && attempt < 3) {
          console.log(`  ${model} surchargé, nouvel essai dans ${attempt * 10} s…`);
          await new Promise((r) => setTimeout(r, attempt * 10000));
          continue;
        }
        if (status === 429 || status === 503 || status === 404) {
          console.log(`  ${model} indisponible (${status}), modèle suivant.`);
          break;
        }
        throw err;
      }
    }
  }
  throw new Error(`Aucun modèle Gemini disponible (${models.join(", ")}). Réessaie plus tard.`);
};
const { model, response } = await generate();
console.log(`  Critique rédigée par ${model}.`);

const review = { version, video, model, date: new Date().toISOString(), ...JSON.parse(response.text) };
const out = `reviews/${name}-v${version}.json`;
writeFileSync(out, JSON.stringify(review, null, 2));

for (const f of files) await ai.files.delete({ name: f.name }).catch(() => {});

console.log(`\nNote : ${review.score}/10 (${review.verdict})`);
console.log(review.summary);
console.log(`Fluidité : ${review.fluidityScore}/10. ${review.fluidity}`);
console.log(`Couleur : ${review.colorScore}/10. ${review.color}`);
for (const i of review.issues) {
  console.log(`  [${i.severity}] ${i.timestamp} ${i.clipLabel ?? ""} ${i.category} : ${i.problem}\n      -> ${i.fix}`);
}
console.log(`\nCritique : ${out}`);

// Usage: npm run sfx:pick -- <rôle> [samourai|monegasque] [--count 3]
//        npm run sfx:pick -- --roles        list the roles and how many variants each has
// Shows the variants of a role, least used first (usage counted over every edits/*.json), with
// the instant of their peak so a hit lands on the beat: put "at" = beat time - peak.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { ROLES } from "./lib/sfx-roles.mjs";

const args = process.argv.slice(2);
const libPath = "public/sfx/library.json";
if (!existsSync(libPath)) {
  console.error("Bibliothèque vide : lance d'abord npm run sfx -- --kit");
  process.exit(1);
}
const library = JSON.parse(readFileSync(libPath, "utf8"));

// Old entries (before roles) get one from their search words.
const guessRole = (e) =>
  e.role ?? Object.entries(ROLES).find(([, r]) => r.queries.some((q) => q.split(" ")[0] === (e.query ?? "").split(" ")[0]))?.[0] ?? "custom";

const usage = new Map();
for (const f of existsSync("edits") ? readdirSync("edits").filter((f) => f.endsWith(".json")) : []) {
  for (const s of JSON.parse(readFileSync(`edits/${f}`, "utf8")).sfx ?? []) usage.set(s.src, (usage.get(s.src) ?? 0) + 1);
}

if (args.includes("--roles") || !args[0]) {
  for (const [name, r] of Object.entries(ROLES)) {
    const n = library.filter((e) => guessRole(e) === name).length;
    console.log(`${name.padEnd(11)} ${String(n).padStart(2)} variante(s)  [${r.for}]  ${r.use}`);
  }
  process.exit(0);
}

const role = args[0];
const resto = ["samourai", "monegasque"].find((r) => args.includes(r));
const count = Number(args.includes("--count") ? args[args.indexOf("--count") + 1] : 3);
const pool = library
  .filter((e) => guessRole(e) === role && existsSync(`public/${e.src}`))
  .filter((e) => !resto || !e.for || ["common", "food", "custom", resto].includes(e.for))
  .sort((a, b) => (usage.get(a.src) ?? 0) - (usage.get(b.src) ?? 0) || Math.random() - 0.5);

if (!pool.length) {
  console.error(`Aucun son "${role}". Télécharge-en : npm run sfx -- --role ${role}`);
  process.exit(1);
}
for (const e of pool.slice(0, count)) {
  console.log(`${e.src}  ${(e.duration ?? 0).toFixed(2)} s  pic à ${(e.peak ?? 0).toFixed(2)} s  utilisé ${usage.get(e.src) ?? 0}×  "${e.name}"`);
}

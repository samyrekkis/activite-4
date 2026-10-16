// Free sound effects from Freesound (CC0 only by default: no attribution, commercial use OK).
//   npm run sfx -- "whoosh"              search + download the 3 best
//   npm run sfx -- "gong" --count 5
//   npm run sfx -- --pack samourai       download the whole restaurant pack
// Files land in public/sfx/, credits in public/sfx/LICENSES.md, index in public/sfx/library.json.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadEnv } from "./lib/media.mjs";

loadEnv();
const PACKS = {
  common: ["whoosh transition", "swoosh fast", "pop", "camera shutter", "riser short", "impact hit cinematic"],
  samourai: ["gong", "katana sword unsheathe", "taiko drum hit", "sizzle wok", "chopsticks", "sake pour", "shamisen pluck", "bamboo wind chime"],
  monegasque: ["coffee pour", "cutlery clink plate", "champagne cork pop", "glass clink cheers", "sizzle pan butter", "orange juice pour", "restaurant ambience"],
};

const args = process.argv.slice(2);
const flag = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const count = Number(flag("--count") ?? 3);
const pack = flag("--pack");
const anyLicense = args.includes("--any-license");
const query = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const token = process.env.FREESOUND_API_KEY;

if (!token) {
  console.error("FREESOUND_API_KEY manquante : crée une clé gratuite sur https://freesound.org/apiv2/apply puis ajoute-la dans .env");
  process.exit(1);
}
const queries = pack ? [...new Set([...(PACKS[pack] ?? []), ...PACKS.common])] : query ? [query] : [];
if (!queries.length) {
  console.error(`Usage: npm run sfx -- "whoosh" | --pack ${Object.keys(PACKS).filter((k) => k !== "common").join("|")}`);
  process.exit(1);
}

mkdirSync("public/sfx", { recursive: true });
const libPath = "public/sfx/library.json";
const library = existsSync(libPath) ? JSON.parse(readFileSync(libPath, "utf8")) : [];
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

for (const q of queries) {
  const filter = `duration:[0.1 TO 8]${anyLicense ? "" : ' license:"Creative Commons 0"'}`;
  const url = new URL("https://freesound.org/apiv2/search/text/");
  url.search = new URLSearchParams({
    query: q,
    filter,
    sort: "rating_desc",
    page_size: String(count),
    fields: "id,name,duration,license,username,previews,url,avg_rating",
    token,
  }).toString();
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Freesound "${q}" : HTTP ${res.status}`);
    continue;
  }
  const { results } = await res.json();
  for (const s of results) {
    const file = `sfx/${slug(q)}-${s.id}.mp3`;
    if (!existsSync(`public/${file}`)) {
      const audio = await fetch(s.previews["preview-hq-mp3"]);
      writeFileSync(`public/${file}`, Buffer.from(await audio.arrayBuffer()));
      appendFileSync("public/sfx/LICENSES.md", `- ${file} : "${s.name}" par ${s.username}, ${s.license} (${s.url})\n`);
      library.push({ src: file, query: q, name: s.name, duration: s.duration, license: s.license, source: s.url });
    }
    console.log(`${file}  ${s.duration.toFixed(2)} s  "${s.name}"`);
  }
}
writeFileSync(libPath, JSON.stringify(library, null, 2));
console.log(`\nBibliothèque : ${libPath} (${library.length} sons)`);

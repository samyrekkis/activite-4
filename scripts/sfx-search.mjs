// Free REAL sound effects from Freesound (CC0 only by default: no attribution,
// commercial use OK). Synthesized / generated sounds are filtered out by tags,
// and every file is trimmed and loudness-normalized before use.
//   npm run sfx -- "whoosh"              search + download the 3 best
//   npm run sfx -- "gong" --count 5
//   npm run sfx -- --pack samourai       download the whole restaurant pack
// Files land in public/sfx/, credits in public/sfx/LICENSES.md, index in public/sfx/library.json.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { loadEnv } from "./lib/media.mjs";
import { looksSynthetic, masterAudio, register, slug } from "./lib/audio.mjs";

loadEnv();
const PACKS = {
  // Queries aim at field / foley recordings, not designed or synthesized sounds.
  common: ["whoosh swing stick", "cloth swish fast", "camera shutter dslr", "finger snap", "paper flip", "hand clap"],
  samourai: ["gong hit", "katana unsheathe", "taiko drum", "wok sizzle", "chopsticks wood", "sake pour", "shamisen", "wind chime bamboo", "fabric kimono rustle"],
  monegasque: ["coffee pour cup", "cutlery plate restaurant", "champagne cork pop", "glasses clink cheers", "pan sizzle butter", "juice pour glass", "restaurant ambience brunch"],
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
const known = new Set((existsSync(libPath) ? JSON.parse(readFileSync(libPath, "utf8")) : []).map((e) => e.source));

for (const q of queries) {
  const filter = `duration:[0.1 TO 8] avg_rating:[3.5 TO *]${anyLicense ? "" : ' license:"Creative Commons 0"'}`;
  const url = new URL("https://freesound.org/apiv2/search/text/");
  url.search = new URLSearchParams({
    query: q,
    filter,
    sort: "downloads_desc",
    page_size: String(count * 4),
    fields: "id,name,duration,license,username,previews,url,avg_rating,tags",
    token,
  }).toString();
  const res = await fetch(url).catch((err) => {
    console.error(`Impossible de joindre freesound.org (${err.cause?.message ?? err.message}). Le réseau de cette machine bloque-t-il le site ?`);
    process.exit(1);
  });
  if (!res.ok) {
    console.error(`Freesound "${q}" : HTTP ${res.status}`);
    continue;
  }
  const { results } = await res.json();
  const synthetic = results.filter((s) => looksSynthetic(s.tags, s.name)).length;
  const real = results.filter((s) => !looksSynthetic(s.tags, s.name)).slice(0, count);
  for (const s of real) {
    const file = `sfx/${slug(q)}-${s.id}.mp3`;
    if (!known.has(s.url)) {
      const raw = `public/sfx/.tmp-${s.id}.mp3`;
      writeFileSync(raw, Buffer.from(await (await fetch(s.previews["preview-hq-mp3"])).arrayBuffer()));
      const { duration } = await masterAudio(raw, `public/${file}`);
      rmSync(raw);
      register("sfx", { src: file, query: q, name: s.name, author: s.username, duration, license: s.license, source: s.url });
      known.add(s.url);
    }
    console.log(`${file}  "${s.name}" (note ${s.avg_rating.toFixed(1)})`);
  }
  if (synthetic) console.log(`  ${synthetic} son(s) synthétique(s) écarté(s) pour "${q}"`);
}
console.log(`\nBibliothèque : ${libPath}`);

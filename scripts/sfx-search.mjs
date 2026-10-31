// Free sound effects from Freesound (CC0 only by default: no attribution, commercial use OK),
// sorted by ROLE so an edit can pick a varied sound for each job.
//   npm run sfx -- --kit                    3 variants of every role (common + both restaurants)
//   npm run sfx -- --kit samourai           common roles + the Samouraï ones
//   npm run sfx -- --role impact --count 5  more variants of one role
//   npm run sfx -- "rice cooker steam"      free search (role "custom")
//   npm run sfx -- --dry --kit              show what would be fetched, download nothing
// Every sound is cleaned: leading silence cut, length capped, fade-out, loudness levelled.
// Its loudest instant (`peak`, seconds) is stored so an impact can land exactly on a beat
// (sfx.at = beat - peak). Files: public/sfx/, index: public/sfx/library.json,
// credits: public/sfx/LICENSES.md. Pick the least used variant: npm run sfx:pick -- <role>.
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { loadEnv, run } from "./lib/media.mjs";
import { ROLES } from "./lib/sfx-roles.mjs";

loadEnv();


const args = process.argv.slice(2);
const flag = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const dry = args.includes("--dry");
const anyLicense = args.includes("--any-license");
const kit = args.includes("--kit");
const kitFor = kit && flag("--kit") && !flag("--kit").startsWith("--") ? flag("--kit") : null;
const role = flag("--role");
const count = Number(flag("--count") ?? 3);
const freeQuery = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));

const jobs = []; // { role, query, count }
if (kit) {
  for (const [name, r] of Object.entries(ROLES)) {
    if (kitFor && !["common", "food", kitFor].includes(r.for)) continue;
    // Spread the variants over the role's queries: different searches = more variety.
    r.queries.forEach((q) => jobs.push({ role: name, query: q, count: Math.ceil(count / r.queries.length) }));
  }
} else if (role) {
  if (!ROLES[role]) {
    console.error(`Rôle inconnu : ${role}. Rôles : ${Object.keys(ROLES).join(", ")}`);
    process.exit(1);
  }
  ROLES[role].queries.forEach((q) => jobs.push({ role, query: q, count: Math.ceil(count / ROLES[role].queries.length) }));
} else if (freeQuery) {
  jobs.push({ role: "custom", query: freeQuery, count });
} else {
  console.error('Usage: npm run sfx -- --kit [samourai|monegasque] | --role <rôle> [--count 5] | "<recherche>" [--dry]');
  console.error(`Rôles : ${Object.keys(ROLES).join(", ")}`);
  process.exit(1);
}

if (dry) {
  for (const j of jobs) console.log(`${j.role.padEnd(11)} ${String(j.count).padStart(2)} × "${j.query}"`);
  console.log(`\n${jobs.reduce((n, j) => n + j.count, 0)} sons au maximum (aucun téléchargé : --dry).`);
  process.exit(0);
}

const token = process.env.FREESOUND_API_KEY;
if (!token) {
  console.error("FREESOUND_API_KEY manquante : crée une clé gratuite sur https://freesound.org/apiv2/apply puis ajoute-la dans .env");
  process.exit(1);
}

mkdirSync("public/sfx", { recursive: true });
const libPath = "public/sfx/library.json";
const library = existsSync(libPath) ? JSON.parse(readFileSync(libPath, "utf8")) : [];
const known = new Set(library.map((e) => e.freesoundId).filter(Boolean));
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);

/** Time (s) of the loudest 10 ms window: where the hit is. */
const peakTime = async (file) => {
  const { stderr } = await run("ffmpeg", [
    "-hide_banner", "-i", file, "-af",
    "aformat=channel_layouts=mono,asetnsamples=n=480,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.Peak_level",
    "-f", "null", "-",
  ]);
  let best = -Infinity;
  let at = 0;
  let t = 0;
  for (const line of stderr.split("\n")) {
    const time = line.match(/pts_time:([\d.]+)/);
    if (time) t = Number(time[1]);
    const level = line.match(/Peak_level=(-?[\d.]+|-inf)/);
    if (level && level[1] !== "-inf" && Number(level[1]) > best) {
      best = Number(level[1]);
      at = t;
    }
  }
  return Math.round(at * 100) / 100;
};

/** Cut the leading silence, cap the length, fade out, level the loudness. */
const cleanSound = async (input, output, { max, lufs }) => {
  await run("ffmpeg", [
    "-y", "-i", input, "-af",
    [
      "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02",
      `atrim=0:${max}`,
      `afade=t=out:st=${Math.max(0, max - 0.25)}:d=0.25`,
      `loudnorm=I=${lufs}:TP=-1.5:LRA=11`,
    ].join(","),
    "-ar", "48000", "-ac", "2", "-c:a", "libmp3lame", "-q:a", "2", output,
  ]);
};

let added = 0;
for (const job of jobs) {
  const r = ROLES[job.role] ?? { max: 6, lufs: -18 };
  const url = new URL("https://freesound.org/apiv2/search/text/");
  url.search = new URLSearchParams({
    query: job.query,
    filter: `duration:[0.1 TO ${Math.max(8, r.max * 2)}] avg_rating:[3 TO *]${anyLicense ? "" : ' license:"Creative Commons 0"'}`,
    sort: "rating_desc",
    page_size: String(job.count + 4), // a few spares for the ones already in the library
    fields: "id,name,duration,license,username,previews,url,avg_rating,num_ratings",
    token,
  }).toString();
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Freesound "${job.query}" : HTTP ${res.status}`);
    continue;
  }
  const fresh = (await res.json()).results.filter((s) => !known.has(s.id)).slice(0, job.count);
  for (const s of fresh) {
    const file = `sfx/${job.role}-${slug(job.query)}-${s.id}.mp3`;
    const raw = `public/sfx/.raw-${s.id}.mp3`;
    try {
      const audio = await fetch(s.previews["preview-hq-mp3"]);
      writeFileSync(raw, Buffer.from(await audio.arrayBuffer()));
      await cleanSound(raw, `public/${file}.tmp.mp3`, r);
      renameSync(`public/${file}.tmp.mp3`, `public/${file}`);
    } catch (e) {
      console.error(`  ${s.name} : échec du nettoyage (${String(e).slice(0, 120)})`);
      continue;
    } finally {
      if (existsSync(raw)) rmSync(raw);
    }
    const peak = await peakTime(`public/${file}`);
    const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", `public/${file}`]);
    library.push({
      src: file, role: job.role, for: r.for ?? "custom", use: r.use ?? job.query, query: job.query,
      name: s.name, duration: Math.round(Number(stdout) * 100) / 100, peak,
      license: s.license, source: s.url, freesoundId: s.id,
    });
    known.add(s.id);
    appendFileSync("public/sfx/LICENSES.md", `- ${file} : "${s.name}" par ${s.username}, ${s.license} (${s.url})\n`);
    added++;
    console.log(`${job.role.padEnd(11)} ${file}  pic à ${peak.toFixed(2)} s  "${s.name}"`);
  }
}

// The sounds bundled with the video-agent skills (versioned in git) join the library too.
const BUNDLED = { "va-impact-boom": "impact", "va-zhhh": "glitch", "va-riser": "riser", "va-glass-shatter": "impact", "va-pop-back": "pop" };
for (const [name, r] of Object.entries(BUNDLED)) {
  const src = `sfx/${name}.mp3`;
  if (existsSync(`public/${src}`) && !library.some((e) => e.src === src)) {
    library.push({ src, role: r, for: "common", use: ROLES[r].use, name, peak: await peakTime(`public/${src}`), license: "MIT", source: "https://github.com/Melvynx/video-agent-skills" });
  }
}

writeFileSync(libPath, JSON.stringify(library, null, 2));
const byRole = library.reduce((m, e) => ((m[e.role ?? "?"] = (m[e.role ?? "?"] ?? 0) + 1), m), {});
console.log(`\n${added} nouveaux sons. Bibliothèque : ${library.length} sons`);
console.log(Object.entries(byRole).map(([k, v]) => `${k} ${v}`).join(" · "));

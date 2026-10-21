// Shares library clips between several copies of reference edits so that every video
// mixes all kinds of shots (entrance, views, room, details, tradition, birthdays, food…)
// in a logical order, and no clip is ever used twice: not within a video, not across
// videos, not in videos already delivered (out/used-delivered.json).
//   node scripts/library/allocate.mjs <config.json>
// Config: { exclude: ["MON-092", …], copies: [ { name, restaurant, ref, from, to, minShot,
//   refCrop, curve, brief, speeds?: [..], light?: "jour"|"nuit", closeUp?: true,
//   slots: ["ENTREE", "SALLE|DECO", …] } ] }  -> writes edits/specs/copies/<name>.json
import fs from "node:fs";

const cfg = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const used = new Set(Object.values(JSON.parse(fs.readFileSync("out/used-delivered.json", "utf8"))).flat());
for (const id of cfg.exclude || []) used.add(id);
const cat = (r) => JSON.parse(fs.readFileSync(`public/library/${r}/catalogue.json`, "utf8")).clips;

// Primary theme of a clip, from its category and name.
const theme = (m) => {
  const n = m.name.toLowerCase();
  const food = ["plat", "dessert", "boisson", "table"].includes(m.category);
  if (/ha[iï]k|kimono|tenue|poup[ée]e|geisha|voile|tr[ôo]ne dor|maquillage/.test(n) || (m.category === "personnes" && /[ée]ventail/.test(n))) return "TRADITION";
  if (/anniversaire|birthday|ballon|c[œo]eur|p[ée]tale|love|couronne|cadeau|romantique|saint-valentin|20 ans|bougies rouges/.test(n)) return "ANNIV";
  if (!food && /entr[ée]e|\bporte\b|\brue\b|fa[çc]ade|escalier|enseigne|hall|vitrine|accueil|cordon|n[ée]on (le |samoura|monégas|kanji)/.test(n)) return "ENTREE";
  if (m.category === "exterieur" && /piscine/.test(n)) return "POOL";
  if (!food && (m.category === "exterieur" || /rooftop|passerelle|palmier/.test(n))) return "VUE";
  if (m.category === "salle") return "SALLE";
  if (m.category === "deco") return "DECO";
  if (m.category === "table") return "TABLE";
  if (m.category === "cuisine") return "CUISINE";
  if (m.category === "plat") return "PLAT";
  if (m.category === "dessert" || m.category === "boisson" || /milkshake|cocktail|caf[ée]|\bth[ée]\b|jus|smoothie/.test(n)) return "DESSERT";
  if (m.category === "geste") return "GESTE";
  return "PERSONNES";
};
// Two shots whose descriptions share most words look alike: never in the same video.
const words = (s) => new Set(s.toLowerCase().replace(/[^a-zàâçéèêëîïôûùüœ ]/g, " ").split(/\s+/).filter((w) => w.length > 3));
const alike = (a, b) => { const A = words(a), B = words(b); const inter = [...A].filter((w) => B.has(w)).length; return inter / Math.max(1, Math.min(A.size, B.size)) >= 0.5; };

const out = {};
for (const c of cfg.copies) {
  // A group without a reference (e.g. the cells of a mosaic) only needs clips of c.need seconds.
  let bounds;
  if (c.ref) {
    const ref = JSON.parse(fs.readFileSync(c.ref, "utf8"));
    bounds = [c.from];
    for (const x of ref.cuts) if (x > c.from + c.minShot && x < c.to - c.minShot && x - bounds.at(-1) >= c.minShot) bounds.push(x);
    bounds.push(c.to);
  } else bounds = c.slots.map((_, i) => i * (c.need ?? 1.5)).concat([c.slots.length * (c.need ?? 1.5)]);
  const n = bounds.length - 1;
  if (c.slots.length !== n) throw new Error(`${c.name}: ${n} shots in the reference, ${c.slots.length} slots`);
  // Clips graded black and white in their original post would clash in a colour video.
  const pool = cat(c.restaurant).filter((m) => m.quality >= (c.minQuality ?? 2) && !used.has(m.id) && !/noir et blanc/.test(m.name));
  const shots = [];
  const srcCount = {};
  for (let i = 0; i < n; i++) {
    const want = c.slots[i].split("|");
    const need = (bounds[i + 1] - bounds[i]) * (c.speeds?.[i] ?? 1);
    let best = null, bestScore = -1e9;
    for (const m of pool) {
      if (used.has(m.id) || !want.includes(theme(m))) continue;
      if (m.duration < Math.min(need, 0.6) + 0.1) continue;
      let s = m.quality * 10;
      s += m.duration >= need + 0.1 ? 8 : -12 * (1 - m.duration / need);
      if (c.light && m.light === c.light) s += 15;
      if (shots.some((x) => alike(x.name, m.name))) s -= 40;
      if (c.closeUp && m.view === "gros-plan") s += 5;
      const src = m.source || m.id;
      s -= (srcCount[src] || 0) * 9;
      if (shots.slice(-2).some((x) => x.source === src)) s -= 25;
      s += Math.random() * 3; // ties: spread choices instead of always the same order
      if (s > bestScore) { bestScore = s; best = m; }
    }
    if (!best) throw new Error(`${c.name}: no clip left for slot ${i + 1} (${c.slots[i]}, ${need.toFixed(2)} s)`);
    used.add(best.id);
    const src = best.source || best.id;
    srcCount[src] = (srcCount[src] || 0) + 1;
    shots.push({ id: best.id, source: src, theme: theme(best), name: best.name });
  }
  out[c.name] = shots;
  if (!c.ref) { console.log(`
${c.name}: ${shots.map((x) => x.id).join(" ")}`); continue; }
  const spec = { out: `edits/copies/${c.name}.json`, restaurant: c.restaurant, ref: c.ref, from: c.from, to: c.to, minShot: c.minShot,
    curve: c.curve, version: 100, brief: c.brief, copyZoom: true, ...(c.refCrop ? { refCrop: c.refCrop } : {}),
    shots: shots.map((s, i) => ({ id: s.id, ...(c.speeds ? { speed: c.speeds[i], at: 0 } : {}) })) };
  fs.writeFileSync(`edits/specs/copies/${c.name}.json`, JSON.stringify(spec, null, 1));
  console.log(`\n${c.name} (${n} plans)`);
  shots.forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)} ${c.slots[i].padEnd(14)} ${s.id} ${s.name.slice(0, 50)}`));
}
fs.writeFileSync("out/allocation.json", JSON.stringify(out, null, 1));

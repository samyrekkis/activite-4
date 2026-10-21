// Adds the quadrant transition (CapCut "white photo overlay" tutorial, KHAB0946) on every
// <every>th cut of a plan: the next shot appears quarter by quarter over the previous one.
//   node scripts/library/quad_fx.mjs <plan.json> <every> <dur s>
import fs from "node:fs";
const [p, every, dur] = process.argv.slice(2);
const j = JSON.parse(fs.readFileSync(p, "utf8"));
const resto = j.restaurant;
const cat = JSON.parse(fs.readFileSync(`public/library/${resto}/catalogue.json`, "utf8")).clips;
let n = 0;
j.clips.forEach((c, i) => {
  delete c.quadIn;
  const prev = j.clips[i - 1];
  if (!prev || prev.mosaic || c.mosaic || i % +every !== 0) return;
  const len = (c.end - c.start) / (c.speed ?? 1);
  const d = Math.min(+dur, +(len * 0.6).toFixed(3));
  const sp = prev.speed ?? 1;
  const m = cat.find((x) => prev.src.endsWith(`${x.id}.mp4`));
  // Continue the previous shot underneath; step back if its clip ends too soon.
  const start = m && prev.end + d * sp > m.duration - 0.05 ? Math.max(0, m.duration - 0.05 - d * sp) : prev.end;
  c.quadIn = { src: prev.src, start: +start.toFixed(3), ...(sp !== 1 ? { speed: sp } : {}), dur: d };
  n++;
});
fs.writeFileSync(p, JSON.stringify(j, null, 2));
console.log(`${p}: ${n} quadrant transitions`);

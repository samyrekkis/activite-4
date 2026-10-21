// Effects of the UOGV3464 reference on its Samouraï copy: the 8 flash shots after the
// opening are black and white, and two passages use the reference's blur transition.
//   node scripts/library/uogv_fx.mjs <plan.json>
import fs from "node:fs";
const p = process.argv[2];
const j = JSON.parse(fs.readFileSync(p, "utf8"));
j.clips.forEach((c, i) => {
  if (i >= 1 && i <= 8) c.grade = { ...c.grade, saturate: 0, contrast: 1.15 };
});
for (const i of [16, 25]) if (j.clips[i]) j.clips[i].transitionIn = { type: "blurZoom", duration: 0.25 };
fs.writeFileSync(p, JSON.stringify(j, null, 2));
console.log("uogv effects applied");

// Usage: npm run export:resolve -- edits/plan.json
// Builds a DaVinci Resolve-ready timeline (FCPXML 1.9) from an edit plan:
//   out/resolve/<plan>/NN-<label>.mp4   each shot pre-cut to its exact in/out, speed applied, no grade
//   out/resolve/<plan>/<plan>.fcpxml    shots on V1, music + SFX on audio lanes,
//                                       markers for the intended transitions and on-screen texts
// In Resolve: Fichier > Importer > Timeline… > choose the .fcpxml (media is found next to it).
// If out/<plan>-vN.mp4 exists, the outro card is cut from that render; otherwise a marked gap is left.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildSegments, transitionFrames, totalFrames, DEFAULT_FPS } from "../src/timeline.ts";
import { probe, run } from "./lib/media.mjs";

const planPath = process.argv[2];
if (!planPath) {
  console.error("Usage: npm run export:resolve -- edits/plan.json");
  process.exit(1);
}
const plan = JSON.parse(readFileSync(planPath, "utf8"));
const name = basename(planPath, ".json");
const fps = plan.fps ?? DEFAULT_FPS;
const dir = `out/resolve/${name}`;
mkdirSync(dir, { recursive: true });

const size = { vertical: [1080, 1920], horizontal: [1920, 1080], square: [1080, 1080] }[plan.format ?? "vertical"];
const t = (frames) => `${frames}/${fps}s`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30);
const fileUrl = (p) => pathToFileURL(resolve(p)).href;

// Timeline: segment starts with transition overlaps; each cut is placed mid-transition.
const segments = buildSegments(plan);
const starts = [];
const overlaps = [];
let at = 0;
segments.forEach((s, i) => {
  const o = i > 0 ? transitionFrames(s.transitionIn, segments[i - 1].frames, s.frames, fps) : 0;
  at -= o;
  starts.push(at);
  overlaps.push(o);
  at += s.frames;
});
const total = totalFrames(plan);
const cutIn = segments.map((_, i) => starts[i] + Math.floor(overlaps[i] / 2));
const cutOut = segments.map((_, i) => (i + 1 < segments.length ? cutIn[i + 1] : total));

const render = `out/${name}-v${plan.version ?? 1}.mp4`;
const assets = [];
const spine = [];

for (const [i, seg] of segments.entries()) {
  const len = cutOut[i] - cutIn[i];
  const label = seg.kind === "clip" ? seg.clip.label ?? basename(seg.clip.src) : seg.kind;
  const file = `${dir}/${String(i + 1).padStart(2, "0")}-${slug(label) || seg.kind}.mp4`;
  const markers = [];
  if (seg.transitionIn && seg.transitionIn.type !== "cut" && i > 0) {
    const tr = seg.transitionIn;
    markers.push(`Transition : ${tr.type}${tr.direction ? ` ${tr.direction}` : ""} (${tr.duration ?? 0.35} s)`);
  }

  if (seg.kind === "clip") {
    const clip = seg.clip;
    const speed = clip.speed ?? 1;
    const srcIn = (clip.start ?? 0) + ((cutIn[i] - starts[i]) / fps) * speed;
    const vf = [`setpts=(PTS-STARTPTS)/${speed}`, `fps=${fps}`, `scale=${size[0]}:${size[1]}:force_original_aspect_ratio=increase`, `crop=${size[0]}:${size[1]}`, "format=yuv420p"];
    await run("ffmpeg", ["-y", "-ss", srcIn.toFixed(4), "-i", `public/${clip.src}`, "-an", "-vf", vf.join(","),
      "-frames:v", String(len), "-c:v", "libx264", "-preset", "medium", "-crf", "16", file]);
    for (const txt of clip.text ?? []) markers.push(`Texte (${txt.style ?? "caption"}, ${txt.position ?? "bottom"}) : ${txt.content}`);
    if (clip.motion && clip.motion !== "none") markers.push(`Mouvement : ${clip.motion}`);
  } else if (existsSync(render)) {
    await run("ffmpeg", ["-y", "-ss", (cutIn[i] / fps).toFixed(4), "-i", render, "-an", "-frames:v", String(len),
      "-c:v", "libx264", "-preset", "medium", "-crf", "16", file]);
  } else {
    const card = seg.kind === "outro" ? plan.outro : plan.intro;
    spine.push({ gap: true, offset: cutIn[i], len, markers: [`Carte ${seg.kind} à créer : ${card.title}${card.subtitle ? ` / ${card.subtitle}` : ""}`] });
    continue;
  }
  const id = `v${i + 1}`;
  assets.push(`    <asset id="${id}" name="${esc(basename(file))}" start="0s" duration="${t(len)}" hasVideo="1" format="r0" videoSources="1">\n      <media-rep kind="original-media" src="${fileUrl(file)}"/>\n    </asset>`);
  spine.push({ ref: id, name: label, offset: cutIn[i], len, markers });
}

// Audio: music under the whole edit, SFX attached to whichever shot they fall on.
const audio = [];
const audioAsset = async (id, src) => {
  const info = await probe(`public/${src}`);
  assets.push(`    <asset id="${id}" name="${esc(basename(src))}" start="0s" duration="${t(Math.ceil(info.duration * fps))}" hasAudio="1" audioSources="1" audioChannels="2" audioRate="48000">\n      <media-rep kind="original-media" src="${fileUrl(`public/${src}`)}"/>\n    </asset>`);
};
if (plan.music) {
  await audioAsset("m1", plan.music.src);
  audio.push({ ref: "m1", at: 0, start: Math.round((plan.music.startAt ?? 0) * fps), len: total, lane: -1, name: "Musique" });
}
const sfxIds = new Map();
for (const [k, s] of (plan.sfx ?? []).entries()) {
  if (!sfxIds.has(s.src)) {
    sfxIds.set(s.src, `s${sfxIds.size + 1}`);
    await audioAsset(sfxIds.get(s.src), s.src);
  }
  const info = await probe(`public/${s.src}`);
  const len = Math.min(Math.round((s.duration ?? info.duration) * fps), total - Math.round(s.at * fps));
  if (len > 0) audio.push({ ref: sfxIds.get(s.src), at: Math.round(s.at * fps), start: 0, len, lane: -2 - (k % 2), name: basename(s.src) });
}

const parentOf = (frame) => spine.find((c) => frame >= c.offset && frame < c.offset + c.len) ?? spine[0];
const children = new Map();
for (const a of audio) {
  const p = parentOf(a.at);
  if (!children.has(p)) children.set(p, []);
  children.get(p).push(`        <asset-clip ref="${a.ref}" name="${esc(a.name)}" lane="${a.lane}" offset="${t(a.at - p.offset)}" start="${t(a.start)}" duration="${t(a.len)}"/>`);
}

const spineXml = spine.map((c) => {
  const inner = [
    ...c.markers.map((m) => `        <marker start="0s" duration="${t(1)}" value="${esc(m)}"/>`),
    ...(children.get(c) ?? []),
  ].join("\n");
  const open = c.gap
    ? `      <gap name="Carte" offset="${t(c.offset)}" start="0s" duration="${t(c.len)}">`
    : `      <asset-clip ref="${c.ref}" name="${esc(c.name)}" offset="${t(c.offset)}" start="0s" duration="${t(c.len)}" format="r0" tcFormat="NDF">`;
  return `${open}\n${inner}\n      ${c.gap ? "</gap>" : "</asset-clip>"}`;
}).join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
  <resources>
    <format id="r0" name="Resto ${size[0]}x${size[1]} ${fps}p" frameDuration="1/${fps}s" width="${size[0]}" height="${size[1]}"/>
${assets.join("\n")}
  </resources>
  <library>
    <event name="Resto Edit Studio">
      <project name="${esc(name)}-v${plan.version ?? 1}">
        <sequence format="r0" duration="${t(total)}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
          <spine>
${spineXml}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>
`;
const out = `${dir}/${name}.fcpxml`;
writeFileSync(out, xml);
console.log(`Timeline Resolve : ${out} (${spine.length} plans, ${audio.length} pistes son, ${(total / fps).toFixed(2)} s)`);
console.log("Dans Resolve : Fichier > Importer > Timeline… puis choisir ce fichier.");

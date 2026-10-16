// Generates synthetic clips, music and SFX in public/demo/ so the pipeline can
// be tested end to end before real footage arrives.
import { mkdirSync } from "node:fs";
import { run } from "./lib/media.mjs";

const out = "public/demo";
mkdirSync(out, { recursive: true });

const clips = [
  ["clip-a", "testsrc2", "0xC8102E"],
  ["clip-b", "smptehdbars", "0xD4AF37"],
  ["clip-c", "mandelbrot", "0x0B0B0D"],
  ["clip-d", "testsrc2", "0x2E86AB"],
];
for (const [name, src] of clips) {
  await run("ffmpeg", [
    "-y", "-f", "lavfi", "-i", `${src}=size=1080x1920:rate=30`,
    "-t", "6", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-preset", "ultrafast",
    `${out}/${name}.mp4`,
  ]);
}
// 120 BPM kick + bass loop.
await run("ffmpeg", [
  "-y", "-f", "lavfi",
  "-i", "aevalsrc=exprs='0.6*sin(2*PI*55*t)*exp(-12*mod(t,0.5))+0.15*sin(2*PI*220*t)*lt(mod(t,1),0.25)':s=44100:d=30",
  "-c:a", "libmp3lame", "-q:a", "4", `${out}/music.mp3`,
]);
// Whoosh: filtered noise with a swell.
await run("ffmpeg", [
  "-y", "-f", "lavfi", "-i", "anoisesrc=d=0.6:c=pink:a=0.5",
  "-af", "highpass=f=400,lowpass=f=4000,afade=t=in:d=0.3,afade=t=out:st=0.3:d=0.3",
  `${out}/whoosh.mp3`,
]);
console.log(`Demo media written to ${out}/`);

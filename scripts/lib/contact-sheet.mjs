import { mkdirSync, rmSync } from "node:fs";
import { findFont, run } from "./media.mjs";

/**
 * Grid of timestamped thumbnails from `times` (seconds). This is how Claude
 * "sees" footage: one image per sheet, readable at a glance.
 */
export const contactSheet = async (file, times, outJpg, { cols = 4, thumbWidth = 360 } = {}) => {
  const tmp = `${outJpg}.frames`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const font = findFont();
  for (const [i, t] of times.entries()) {
    const label = `${t.toFixed(2)}s`;
    const draw = font
      ? `,drawtext=fontfile=${font}:text='${label}':x=10:y=10:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.6:boxborderw=6`
      : "";
    await run("ffmpeg", [
      "-y", "-ss", String(t), "-i", file, "-frames:v", "1",
      "-vf", `scale=${thumbWidth}:-2${draw}`, `${tmp}/${String(i).padStart(4, "0")}.jpg`,
    ]);
  }
  const rows = Math.ceil(times.length / cols);
  await run("ffmpeg", [
    "-y", "-pattern_type", "glob", "-i", `${tmp}/*.jpg`,
    "-vf", `tile=${cols}x${rows}:padding=6:color=white`, "-frames:v", "1", "-q:v", "3", outJpg,
  ]);
  rmSync(tmp, { recursive: true, force: true });
  return outJpg;
};

export const evenlySpaced = (duration, count) =>
  Array.from({ length: count }, (_, i) => Math.min(duration - 0.05, ((i + 0.5) * duration) / count));

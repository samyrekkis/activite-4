import { probe, run } from "./media.mjs";

/** Re-encode any phone video for Remotion: H.264, 30 fps, 1080 px on the short side, sound kept. */
export const normalizeVideo = async (input, output) => {
  const info = await probe(input);
  const portrait = (info.height ?? 0) >= (info.width ?? 0);
  await run("ffmpeg", [
    "-y", "-i", input,
    "-vf", `${portrait ? "scale=1080:-2" : "scale=-2:1080"}:flags=lanczos,fps=30,format=yuv420p`,
    "-c:v", "libx264", "-preset", "medium", "-crf", "18",
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
    output,
  ]);
  return probe(output);
};

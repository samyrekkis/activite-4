import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { analyzeAudio, probe, run } from "./media.mjs";

// Tags that betray a synthesized / generated sound: we only want real recordings.
export const SYNTHETIC_TAGS = [
  "synth", "synthesizer", "synthesized", "synthetic", "generated", "procedural", "ai", "ai-generated",
  "8bit", "8-bit", "chiptune", "retro-game", "sci-fi", "scifi", "laser", "electronic", "midi", "bfxr", "sfxr",
];

export const looksSynthetic = (tags = [], name = "") =>
  [...tags, ...name.toLowerCase().split(/[^a-z0-9-]+/)].some((t) => SYNTHETIC_TAGS.includes(t.toLowerCase()));

export const slug = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/**
 * Cleans a real recording so it sits well in a reel: trims leading silence,
 * loudness-normalizes (SFX -16 LUFS, music -14 LUFS), short fade-out, MP3.
 */
export const masterAudio = async (input, output, { type = "sfx" } = {}) => {
  const target = type === "music" ? -14 : -16;
  const filters = [
    ...(type === "sfx" ? ["silenceremove=start_periods=1:start_threshold=-50dB"] : []),
    `loudnorm=I=${target}:TP=-1.5:LRA=11`,
    ...(type === "sfx" ? ["areverse,afade=t=in:d=0.02,areverse"] : []),
  ];
  await run("ffmpeg", ["-y", "-i", input, "-vn", "-af", filters.join(","), "-ar", "44100", "-c:a", "libmp3lame", "-q:a", "2", output]);
  const info = await probe(output);
  const extra = type === "music" ? { bpm: (await analyzeAudio(output)).bpm } : {};
  return { duration: Math.round(info.duration * 100) / 100, ...extra };
};

/** Appends to public/<type>/library.json and LICENSES.md so every sound keeps its proof of licence. */
export const register = (type, entry) => {
  const dir = `public/${type}`;
  mkdirSync(dir, { recursive: true });
  const libPath = `${dir}/library.json`;
  const library = existsSync(libPath) ? JSON.parse(readFileSync(libPath, "utf8")) : [];
  library.push(entry);
  writeFileSync(libPath, JSON.stringify(library, null, 2));
  const licenses = `${dir}/LICENSES.md`;
  if (!existsSync(licenses)) writeFileSync(licenses, `# Crédits (${type})\n\n`);
  appendFileSync(licenses, `- ${entry.src} : "${entry.name}"${entry.author ? ` par ${entry.author}` : ""}, ${entry.license} (${entry.source})\n`);
  return library.length;
};

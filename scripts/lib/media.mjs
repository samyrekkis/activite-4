import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

export const run = (cmd, args, { quiet = true } = {}) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    p.stdout.on("data", (d) => (stdout += d));
    p.stderr.on("data", (d) => {
      stderr += d;
      if (!quiet) process.stderr.write(d);
    });
    p.on("close", (code) =>
      code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${cmd} exited ${code}\n${stderr.slice(-2000)}`)),
    );
  });

export const probe = async (file) => {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-print_format", "json", "-show_format", "-show_streams", file,
  ]);
  const info = JSON.parse(stdout);
  const video = info.streams.find((s) => s.codec_type === "video");
  const audio = info.streams.find((s) => s.codec_type === "audio");
  const [num, den] = (video?.avg_frame_rate ?? "0/1").split("/").map(Number);
  const rotation = Number(
    video?.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? video?.tags?.rotate ?? 0,
  );
  const swap = Math.abs(rotation) === 90;
  return {
    duration: Number(info.format.duration),
    width: swap ? video?.height : video?.width,
    height: swap ? video?.width : video?.height,
    fps: den ? Math.round((num / den) * 100) / 100 : null,
    hasAudio: Boolean(audio),
    codec: video?.codec_name,
  };
};

/** Re-encode any phone/camera video for Remotion: H.264, 30 fps, 1080 px on the short side, sound kept. */
export const normalizeVideo = async (src, out) => {
  const info = await probe(src);
  const portrait = (info.height ?? 0) >= (info.width ?? 0);
  await run("ffmpeg", [
    "-y", "-i", src,
    "-vf", `${portrait ? "scale=1080:-2" : "scale=-2:1080"}:flags=lanczos,fps=30,format=yuv420p`,
    "-c:v", "libx264", "-preset", "medium", "-crf", "18",
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
    out,
  ]);
  return probe(out);
};

/** Timestamps (s) where the picture changes a lot: cuts in an edit, or action in a rush. */
export const detectScenes = async (file, threshold = 0.3) => {
  const { stderr } = await run("ffmpeg", [
    "-hide_banner", "-i", file, "-vf", `select='gt(scene,${threshold})',showinfo`, "-an", "-f", "null", "-",
  ]);
  return [...stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
};

/** Mono PCM energy envelope -> onset times and tempo estimate. */
export const analyzeAudio = async (file) => {
  const rate = 11025;
  const chunks = [];
  await new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", ["-v", "error", "-i", file, "-ac", "1", "-ar", String(rate), "-f", "f32le", "-"]);
    p.stdout.on("data", (d) => chunks.push(d));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error("audio decode failed"))));
  });
  const buf = Buffer.concat(chunks);
  const samples = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4));
  const hop = 256;
  const energy = [];
  for (let i = 0; i + hop <= samples.length; i += hop) {
    let e = 0;
    for (let j = 0; j < hop; j++) e += samples[i + j] ** 2;
    energy.push(Math.sqrt(e / hop));
  }
  if (!energy.length) return { onsets: [], bpm: null, loudness: 0 };
  const flux = energy.map((e, i) => Math.max(0, e - (energy[i - 1] ?? 0)));
  const hopSec = hop / rate;
  const win = Math.round(0.5 / hopSec);
  const onsets = [];
  let last = -Infinity;
  for (let i = 1; i < flux.length - 1; i++) {
    const lo = Math.max(0, i - win);
    const hi = Math.min(flux.length, i + win);
    let mean = 0;
    for (let k = lo; k < hi; k++) mean += flux[k];
    mean /= hi - lo;
    const t = i * hopSec;
    if (flux[i] > mean * 1.8 && flux[i] >= flux[i - 1] && flux[i] >= flux[i + 1] && t - last > 0.12) {
      onsets.push(Math.round(t * 1000) / 1000);
      last = t;
    }
  }
  // Tempo via autocorrelation of the onset strength, 70-180 BPM.
  let best = { bpm: null, score: 0 };
  for (let bpm = 70; bpm <= 180; bpm++) {
    const lag = Math.round(60 / bpm / hopSec);
    let score = 0;
    for (let i = lag; i < flux.length; i++) score += flux[i] * flux[i - lag];
    if (score > best.score) best = { bpm, score };
  }
  const loudness = energy.reduce((a, b) => a + b, 0) / energy.length;
  return { onsets, bpm: best.bpm, loudness: Math.round(loudness * 1000) / 1000 };
};

export const findFont = () =>
  ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf"].find(existsSync);

export const loadEnv = () => {
  if (!existsSync(".env")) return;
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]] && m[2]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
};

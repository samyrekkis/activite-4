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
  const hop = 64;
  const energy = [];
  for (let i = 0; i + hop <= samples.length; i += hop) {
    let e = 0;
    for (let j = 0; j < hop; j++) e += samples[i + j] ** 2;
    energy.push(Math.sqrt(e / hop));
  }
  if (!energy.length) return { onsets: [], bpm: null, loudness: 0 };
  const flux = energy.map((e, i) => Math.max(0, e - (energy[i - 1] ?? 0)));
  // Smoothed copy (~23 ms) for onset picking: the fine hop is for tempo precision only.
  const smooth = flux.map((_, i) => {
    let sum = 0;
    for (let k = Math.max(0, i - 2); k <= Math.min(flux.length - 1, i + 1); k++) sum += flux[k];
    return sum / 4;
  });
  const hopSec = hop / rate;
  const win = Math.round(0.5 / hopSec);
  const onsets = [];
  let last = -Infinity;
  for (let i = 1; i < smooth.length - 1; i++) {
    const lo = Math.max(0, i - win);
    const hi = Math.min(smooth.length, i + win);
    let mean = 0;
    for (let k = lo; k < hi; k++) mean += smooth[k];
    mean /= hi - lo;
    const t = i * hopSec;
    if (smooth[i] > mean * 1.8 && smooth[i] >= smooth[i - 1] && smooth[i] >= smooth[i + 1] && t - last > 0.12) {
      onsets.push(Math.round(t * 1000) / 1000);
      last = t;
    }
  }
  // Tempo: autocorrelation of the onset strength over lags for 70-180 BPM,
  // refined with parabolic interpolation (a single hop is too coarse a step).
  const score = (lag) => {
    let sum = 0;
    for (let i = lag; i < flux.length; i++) sum += flux[i] * flux[i - lag];
    return sum;
  };
  const minLag = Math.floor(60 / 180 / hopSec);
  const maxLag = Math.ceil(60 / 70 / hopSec);
  let bestLag = minLag;
  let bestScore = -Infinity;
  const scores = new Map();
  for (let lag = minLag; lag <= maxLag; lag++) {
    const sc = score(lag);
    scores.set(lag, sc);
    if (sc > bestScore) [bestLag, bestScore] = [lag, sc];
  }
  const [a, b, c] = [scores.get(bestLag - 1) ?? bestScore, bestScore, scores.get(bestLag + 1) ?? bestScore];
  const offset = a - 2 * b + c !== 0 ? (0.5 * (a - c)) / (a - 2 * b + c) : 0;
  const best = { bpm: Math.round((60 / ((bestLag + offset) * hopSec)) * 10) / 10 };
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

import { buildSegments, transitionFrames, totalFrames, DEFAULT_FPS } from "../../src/timeline.ts";

/** Real on-screen timeline of a plan: when each segment starts, transition overlaps included. */
export const describeTimeline = (plan) => {
  const fps = plan.fps ?? DEFAULT_FPS;
  const segments = buildSegments(plan);
  const lines = [];
  let at = 0;
  segments.forEach((s, i) => {
    const t = i > 0 ? transitionFrames(s.transitionIn, segments[i - 1].frames, s.frames, fps) : 0;
    at -= t;
    const name = s.kind === "clip" ? s.clip.label ?? s.clip.src : s.kind;
    const tr = t ? `${s.transitionIn.type} ${(t / fps).toFixed(2)}s` : "cut";
    lines.push(`${(at / fps).toFixed(2).padStart(6)}s  ${name.padEnd(28)} ${(s.frames / fps).toFixed(2)}s  [${tr}]`);
    at += s.frames;
  });
  lines.push(`Total: ${(totalFrames(plan) / fps).toFixed(2)}s`);
  return lines.join("\n");
};

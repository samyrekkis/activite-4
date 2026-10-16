import type { Clip, EditPlan, Transition } from "./types";

export const DEFAULT_FPS = 30;
export const DEFAULT_CARD_SECONDS = 1.6;
export const DEFAULT_TRANSITION_SECONDS = 0.35;

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif)$/i;

export const isImage = (src: string) => IMAGE_EXT.test(src);

export const toFrames = (seconds: number, fps: number) =>
  Math.max(1, Math.round(seconds * fps));

/** On-screen length of a clip in seconds, accounting for speed. */
export const clipSeconds = (clip: Clip): number => {
  if (isImage(clip.src)) return clip.duration ?? 2;
  if (clip.end === undefined) {
    throw new Error(`Clip "${clip.label ?? clip.src}" needs an "end" time.`);
  }
  const span = clip.end - (clip.start ?? 0);
  if (span <= 0) {
    throw new Error(`Clip "${clip.label ?? clip.src}" has end <= start.`);
  }
  return span / (clip.speed ?? 1);
};

export type Segment =
  | { kind: "intro" | "outro"; frames: number; transitionIn?: Transition }
  | { kind: "clip"; clip: Clip; index: number; frames: number; transitionIn?: Transition };

export const buildSegments = (plan: EditPlan): Segment[] => {
  const fps = plan.fps ?? DEFAULT_FPS;
  const segments: Segment[] = [];
  if (plan.intro) {
    segments.push({
      kind: "intro",
      frames: toFrames(plan.intro.duration ?? DEFAULT_CARD_SECONDS, fps),
    });
  }
  plan.clips.forEach((clip, index) => {
    segments.push({
      kind: "clip",
      clip,
      index,
      frames: toFrames(clipSeconds(clip), fps),
      transitionIn: segments.length ? clip.transitionIn : undefined,
    });
  });
  if (plan.outro) {
    segments.push({
      kind: "outro",
      frames: toFrames(plan.outro.duration ?? DEFAULT_CARD_SECONDS, fps),
      transitionIn: { type: "fade", duration: 0.5 },
    });
  }
  return segments;
};

/** Transition length in frames, clamped so it never exceeds either neighbour. */
export const transitionFrames = (
  t: Transition | undefined,
  prevFrames: number,
  nextFrames: number,
  fps: number,
): number => {
  if (!t || t.type === "cut") return 0;
  const wanted = toFrames(t.duration ?? DEFAULT_TRANSITION_SECONDS, fps);
  return Math.min(wanted, prevFrames - 1, nextFrames - 1);
};

export const totalFrames = (plan: EditPlan): number => {
  const fps = plan.fps ?? DEFAULT_FPS;
  const segments = buildSegments(plan);
  let total = 0;
  segments.forEach((s, i) => {
    total += s.frames;
    if (i > 0) total -= transitionFrames(s.transitionIn, segments[i - 1].frames, s.frames, fps);
  });
  return Math.max(1, total);
};

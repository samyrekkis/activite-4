// The edit plan is the single source of truth for a video.
// Claude writes it (edits/*.json), Remotion renders it, Gemini critiques the
// render, and Claude revises the plan. All times are in seconds.

export type RestaurantId = "monegasque" | "samourai";

export type Format = "vertical" | "horizontal" | "square";

export type TransitionType =
  | "cut"
  | "fade"
  | "slide"
  | "wipe"
  | "flip"
  | "clockWipe"
  | "iris"
  | "pushCut"
  | "flash"
  | "zoomPunch"
  | "whip"
  | "spin"
  | "blurZoom"
  | "split"
  | "blinds"
  | "glitch"
  | "lightLeak"
  | "stretch";

export type Direction = "from-left" | "from-right" | "from-top" | "from-bottom";

export type Transition = {
  type: TransitionType;
  /** Seconds. Ignored for "cut". Default 0.35. */
  duration?: number;
  direction?: Direction;
};

export type Motion =
  | "none"
  | "zoomIn"
  | "zoomOut"
  | "panLeft"
  | "panRight"
  | "panUp"
  | "panDown"
  | "punchIn"
  | "shake";

export type TextStyle = "title" | "caption" | "price" | "tag" | "kanji";

export type TextPosition = "top" | "center" | "bottom";

export type TextOverlay = {
  content: string;
  style?: TextStyle;
  position?: TextPosition;
  /** Seconds after the clip starts. Default 0.1. */
  delay?: number;
  /** Seconds. Default: until the end of the clip. */
  duration?: number;
};

export type Grade = {
  /** Film tone curve (see src/grading.tsx), applied before the other settings. */
  curve?: "tealOrange" | "film" | "golden" | "neon" | "bleach" | "noir" | "moody";
  brightness?: number;
  contrast?: number;
  saturate?: number;
  sepia?: number;
  hueRotate?: number;
  /** CSS color blended over the clip (e.g. "rgba(255,140,0,0.12)"). */
  tint?: string;
  tintBlend?: "overlay" | "soft-light" | "color" | "multiply" | "screen";
};

export type SocialCard = {
  kind: "post" | "comment" | "location" | "reserve" | "story" | "saved";
  /** Comment / caption / button text. */
  text?: string;
  /** Account shown (defaults to the plan's handle). */
  handle?: string;
  /** Place name for "location" and the post header. */
  place?: string;
  /** Story bars: how many segments, and which one is playing. */
  segments?: number;
  index?: number;
  /** Seconds after the clip starts. Default 0. */
  delay?: number;
  /** Seconds. Default: until the end of the clip. */
  duration?: number;
};

export type Clip = {
  /** Path relative to public/, e.g. "rushes/plat-01.mp4" or "brand/logo.png". */
  src: string;
  /** In point in the source, seconds (videos only). */
  start?: number;
  /** Out point in the source, seconds (videos only). Required for videos. */
  end?: number;
  /** Display duration for images, seconds. */
  duration?: number;
  /** Playback speed: 0.5 = slow motion, 2 = fast. Default 1. */
  speed?: number;
  motion?: Motion;
  /** 1 = subtle, 2 = strong. Default 1. */
  motionIntensity?: number;
  /** Mute the clip's own sound. Default true (music carries the edit). */
  muted?: boolean;
  volume?: number;
  /** Overrides the restaurant's default grade for this clip only. */
  grade?: Grade;
  text?: TextOverlay[];
  /** Instagram-style cards over the clip. */
  social?: SocialCard[];
  /** Cinema bars on this clip only (2.39:1 look inside the vertical frame). */
  letterbox?: boolean;
  /** Transition INTO this clip from the previous one. */
  transitionIn?: Transition;
  /** Free label so Gemini feedback can reference clips ("#3 plat signature"). */
  label?: string;
};

export type Sfx = {
  /** Path relative to public/, e.g. "sfx/whoosh-01.mp3". */
  src: string;
  /** Seconds on the final timeline. */
  at: number;
  volume?: number;
  /** Trim the sound, seconds. */
  duration?: number;
};

export type Card = {
  title: string;
  subtitle?: string;
  /** Seconds. Default 1.6. */
  duration?: number;
  /** Optional background image or video from public/. */
  background?: string;
};

export type EditPlan = {
  restaurant: RestaurantId;
  format: Format;
  fps?: number;
  /** Version label shown nowhere in the video, used for files and reviews. */
  version?: number;
  /** Short brief: goal, audience, platform. Sent to Gemini with the render. */
  brief?: string;
  intro?: Card;
  outro?: Card;
  clips: Clip[];
  music?: {
    src: string;
    /** Seconds into the track where the edit starts. */
    startAt?: number;
    volume?: number;
    /** Seconds of fade at the end. Default 1. */
    fadeOut?: number;
  };
  sfx?: Sfx[];
  /** Global look on top of the restaurant theme. */
  overlays?: {
    grain?: number;
    vignette?: number;
    letterbox?: boolean;
  };
  /** Restaurant handle / address shown in the outro if no outro subtitle. */
  handle?: string;
};

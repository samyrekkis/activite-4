import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import type { Direction } from "../types";

type DirProps = { direction: Direction };
type NoProps = Record<string, never>;
const isHorizontal = (d: Direction) => d === "from-left" || d === "from-right";
const signOf = (d: Direction) => (d === "from-left" || d === "from-top" ? -1 : 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Spin: the outgoing shot spins away while the incoming one spins into place.
const Spin: React.FC<TransitionPresentationComponentProps<DirProps>> = ({
  children,
  presentationDirection,
  presentationProgress: p,
  passedProps,
}) => {
  const entering = presentationDirection === "entering";
  const s = signOf(passedProps.direction);
  const rotate = entering ? -s * 70 * (1 - p) : s * 70 * p;
  const scale = entering ? interpolate(p, [0, 1], [0.55, 1]) : interpolate(p, [0, 1], [1, 1.5]);
  const opacity = entering ? interpolate(p, [0, 0.45], [0, 1], clamp) : 1;
  const blur = Math.sin(p * Math.PI) * 12;
  return (
    <AbsoluteFill style={{ transform: `rotate(${rotate}deg) scale(${scale})`, opacity, filter: `blur(${blur}px)` }}>
      {children}
    </AbsoluteFill>
  );
};
export const spin = (direction: Direction = "from-right"): TransitionPresentation<DirProps> => ({
  component: Spin,
  props: { direction },
});

// Blur zoom: the outgoing shot rushes towards the camera, the incoming one pulls back into focus.
const BlurZoom: React.FC<TransitionPresentationComponentProps<NoProps>> = ({
  children,
  presentationDirection,
  presentationProgress: p,
}) => {
  const entering = presentationDirection === "entering";
  const scale = entering ? interpolate(p, [0, 1], [0.7, 1]) : interpolate(p, [0, 1], [1, 2.2]);
  const blur = entering ? (1 - p) * 22 : p * 22;
  const opacity = entering ? interpolate(p, [0.2, 0.7], [0, 1], clamp) : 1;
  return (
    <AbsoluteFill style={{ transform: `scale(${scale})`, filter: `blur(${blur}px)`, opacity }}>{children}</AbsoluteFill>
  );
};
export const blurZoom = (): TransitionPresentation<NoProps> => ({ component: BlurZoom, props: {} });

// Split: the incoming shot opens from a line through the centre (vertical line
// for from-left/right, horizontal line for from-top/bottom), like sliding doors.
const Split: React.FC<TransitionPresentationComponentProps<DirProps>> = ({
  children,
  presentationDirection,
  presentationProgress: p,
  passedProps,
}) => {
  if (presentationDirection !== "entering") {
    return (
      <AbsoluteFill style={{ transform: `scale(${1 + 0.08 * p})`, filter: `brightness(${1 - 0.4 * p})` }}>
        {children}
      </AbsoluteFill>
    );
  }
  const gap = 50 * (1 - p);
  const clip = isHorizontal(passedProps.direction) ? `inset(0% ${gap}% 0% ${gap}%)` : `inset(${gap}% 0% ${gap}% 0%)`;
  return <AbsoluteFill style={{ clipPath: clip }}>{children}</AbsoluteFill>;
};
export const split = (direction: Direction = "from-left"): TransitionPresentation<DirProps> => ({
  component: Split,
  props: { direction },
});

// Blinds: the incoming shot appears through stripes that widen (vertical
// stripes for from-left/right, horizontal ones for from-top/bottom).
const Blinds: React.FC<TransitionPresentationComponentProps<DirProps>> = ({
  children,
  presentationDirection,
  presentationProgress: p,
  passedProps,
}) => {
  if (presentationDirection !== "entering" || p >= 0.999) return <AbsoluteFill>{children}</AbsoluteFill>;
  const angle = isHorizontal(passedProps.direction) ? 90 : 180;
  const w = 12.5 * p;
  const mask = `repeating-linear-gradient(${angle}deg, black 0%, black ${w}%, transparent ${w}%, transparent 12.5%)`;
  return <AbsoluteFill style={{ WebkitMaskImage: mask, maskImage: mask }}>{children}</AbsoluteFill>;
};
export const blinds = (direction: Direction = "from-left"): TransitionPresentation<DirProps> => ({
  component: Blinds,
  props: { direction },
});

// Glitch: a few frames of jumpy offsets and colour shifts, then the new shot locks in.
const Glitch: React.FC<TransitionPresentationComponentProps<NoProps>> = ({
  children,
  presentationDirection,
  presentationProgress: p,
}) => {
  const entering = presentationDirection === "entering";
  const step = Math.floor(p * 8);
  const jitter = ((step * 37) % 11) - 5;
  const strength = entering ? 1 - p : p;
  const visible = entering ? p > 0.35 || step % 2 === 1 : p < 0.65 || step % 2 === 0;
  return (
    <AbsoluteFill
      style={{
        opacity: visible ? 1 : 0,
        transform: `translateX(${jitter * strength * 2}%) skewX(${jitter * strength}deg)`,
        filter: `hue-rotate(${jitter * 18 * strength}deg) saturate(${1 + strength * 1.5}) contrast(${1 + strength * 0.4})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
export const glitch = (): TransitionPresentation<NoProps> => ({ component: Glitch, props: {} });

// Light leak: a warm burst of light sweeps across while the shots cross-fade.
const LightLeak: React.FC<TransitionPresentationComponentProps<DirProps>> = ({
  children,
  presentationDirection,
  presentationProgress: p,
  passedProps,
}) => {
  if (presentationDirection !== "entering") return <AbsoluteFill>{children}</AbsoluteFill>;
  const d = passedProps.direction;
  const along = signOf(d) < 0 ? p * 100 : 100 - p * 100;
  const pos = isHorizontal(d) ? `${along}% 50%` : `50% ${along}%`;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: interpolate(p, [0.25, 0.75], [0, 1], clamp) }}>{children}</AbsoluteFill>
      <AbsoluteFill
        style={{
          mixBlendMode: "screen",
          opacity: Math.sin(p * Math.PI),
          background: `radial-gradient(circle at ${pos}, rgba(255,214,150,0.95) 0%, rgba(255,120,60,0.55) 30%, rgba(255,60,40,0) 70%)`,
        }}
      />
    </AbsoluteFill>
  );
};
export const lightLeak = (direction: Direction = "from-left"): TransitionPresentation<DirProps> => ({
  component: LightLeak,
  props: { direction },
});

// Stretch: the incoming shot springs out of one edge while the outgoing one is squeezed away.
const ORIGIN: Record<Direction, [string, string]> = {
  "from-left": ["left center", "right center"],
  "from-right": ["right center", "left center"],
  "from-top": ["center top", "center bottom"],
  "from-bottom": ["center bottom", "center top"],
};
const Stretch: React.FC<TransitionPresentationComponentProps<DirProps>> = ({
  children,
  presentationDirection,
  presentationProgress: p,
  passedProps,
}) => {
  const entering = presentationDirection === "entering";
  const d = passedProps.direction;
  const k = Math.max(0.001, entering ? p : 1 - p);
  const transform = isHorizontal(d) ? `scaleX(${k})` : `scaleY(${k})`;
  return (
    <AbsoluteFill
      style={{ transform, transformOrigin: ORIGIN[d][entering ? 0 : 1], filter: `blur(${Math.sin(p * Math.PI) * 8}px)` }}
    >
      {children}
    </AbsoluteFill>
  );
};
export const stretch = (direction: Direction = "from-left"): TransitionPresentation<DirProps> => ({
  component: Stretch,
  props: { direction },
});

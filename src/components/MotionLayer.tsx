import React from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from "remotion";
import type { Motion } from "../types";

// Camera moves applied on top of a clip (Ken Burns, punch-in, shake).
export const MotionLayer: React.FC<{
  motion: Motion;
  intensity: number;
  seed: string;
  durationInFrames: number;
  children: React.ReactNode;
}> = ({ motion, intensity, seed, durationInFrames, children }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const amount = 0.08 * intensity;
  const pan = 4 * intensity;

  let transform = "";
  switch (motion) {
    case "zoomIn":
      transform = `scale(${1 + amount * p})`;
      break;
    case "zoomOut":
      transform = `scale(${1 + amount * (1 - p)})`;
      break;
    case "panLeft":
      transform = `scale(${1 + amount}) translateX(${interpolate(p, [0, 1], [pan, -pan])}%)`;
      break;
    case "panRight":
      transform = `scale(${1 + amount}) translateX(${interpolate(p, [0, 1], [-pan, pan])}%)`;
      break;
    case "panUp":
      transform = `scale(${1 + amount}) translateY(${interpolate(p, [0, 1], [pan, -pan])}%)`;
      break;
    case "panDown":
      transform = `scale(${1 + amount}) translateY(${interpolate(p, [0, 1], [-pan, pan])}%)`;
      break;
    case "punchIn": {
      // Fast zoom on the first frames, then hold: classic food-reel hit.
      const hit = interpolate(frame, [0, 6], [1 + amount * 2.2, 1 + amount * 0.6], {
        extrapolateRight: "clamp",
        easing: Easing.out(Easing.exp),
      });
      transform = `scale(${hit})`;
      break;
    }
    case "shake": {
      const decay = interpolate(frame, [0, 10], [1, 0.15], { extrapolateRight: "clamp" });
      const x = (random(`${seed}-x-${frame}`) - 0.5) * 30 * intensity * decay;
      const y = (random(`${seed}-y-${frame}`) - 0.5) * 30 * intensity * decay;
      transform = `scale(${1.06}) translate(${x}px, ${y}px)`;
      break;
    }
    default:
      transform = "none";
  }

  return <AbsoluteFill style={{ transform, transformOrigin: "center center" }}>{children}</AbsoluteFill>;
};

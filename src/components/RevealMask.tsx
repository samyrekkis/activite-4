import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { Reveal } from "../types";

// "Puzzle" reveal seen in Reels: on black, rectangles of the shot appear one by one
// (each one shows the moving video underneath), then the whole frame opens at `full`.
// Drawn as a black overlay with holes (even-odd path), so the clip below is untouched.
// Rectangles are fractions of the frame: [x, y, w, h, appearSeconds].
export const RevealMask: React.FC<{ reveal: Reveal }> = ({ reveal }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  if (t >= reveal.full) return null;
  const holes = reveal.rects
    .filter((r) => t >= r[4])
    .map(([x, y, w, h]) => {
      const X = Math.round(x * width), Y = Math.round(y * height), W = Math.round(w * width), H = Math.round(h * height);
      return `M${X} ${Y}H${X + W}V${Y + H}H${X}Z`;
    })
    .join(" ");
  const d = `M0 0H${width}V${height}H0Z ${holes}`;
  return <AbsoluteFill style={{ background: "#000", clipPath: `path(evenodd, '${d}')` }} />;
};

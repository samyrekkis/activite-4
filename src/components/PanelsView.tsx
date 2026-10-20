import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { Panel } from "../types";

// Several shots on screen at once: horizontal bands ("rows", e.g. a triptych of
// three landscape-looking strips), side-by-side columns, or a 2x2 grid. Panels
// open one after the other on the beat with a short wipe, alternating sides,
// then everything plays together.
const WIPE_FRAMES = 6;

const PanelCell: React.FC<{ panel: Panel; index: number; revealAt: number; horizontalWipe: boolean }> = ({
  panel,
  index,
  revealAt,
  horizontalWipe,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // A panel on screen from the cut needs no wipe: wiping it in from black reads as a flash.
  const p = revealAt === 0 ? 1 : interpolate(frame, [revealAt, revealAt + WIPE_FRAMES], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const hidden = (1 - p) * 100;
  const fromStart = index % 2 === 0;
  const clipPath = horizontalWipe
    ? fromStart ? `inset(0 ${hidden}% 0 0)` : `inset(0 0 0 ${hidden}%)`
    : fromStart ? `inset(0 0 ${hidden}% 0)` : `inset(${hidden}% 0 0 0)`;
  return (
    <div style={{ position: "relative", overflow: "hidden", width: "100%", height: "100%", background: "#000" }}>
      <Sequence from={revealAt} layout="none">
        <AbsoluteFill style={{ clipPath }}>
          <OffthreadVideo
            src={staticFile(panel.src)}
            trimBefore={Math.round((panel.start ?? 0) * fps)}
            playbackRate={panel.speed ?? 1}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: panel.position ?? "center" }}
          />
        </AbsoluteFill>
      </Sequence>
    </div>
  );
};

export const PanelsView: React.FC<{ panels: Panel[]; layout: "rows" | "columns" | "grid"; stagger: number; gap: string }> = ({
  panels,
  layout,
  stagger,
  gap,
}) => {
  const { fps, width } = useVideoConfig();
  const g = Math.round((6 * width) / 1080);
  const columns = layout === "columns" ? panels.length : layout === "grid" ? 2 : 1;
  const rows = layout === "rows" ? panels.length : layout === "grid" ? Math.ceil(panels.length / 2) : 1;
  return (
    <AbsoluteFill
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gap: g,
        background: gap,
      }}
    >
      {panels.map((panel, i) => (
        <PanelCell key={i} panel={panel} index={i} revealAt={Math.round(i * stagger * fps)} horizontalWipe={layout !== "columns"} />
      ))}
    </AbsoluteFill>
  );
};

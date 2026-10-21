import React from "react";
import { AbsoluteFill, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { Mosaic } from "../types";

// A cols x rows grid of shots that appear one by one (black until then), in black
// and white, and switch to colour one by one (the "grid reveal" seen in Reels).
// Times are seconds from the start of the clip.
export const MosaicView: React.FC<{ mosaic: Mosaic; gap: string }> = ({ mosaic, gap }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const g = Math.round(((mosaic.gap ?? 0) * width) / 1080);
  return (
    <AbsoluteFill
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${mosaic.cols}, 1fr)`,
        gridTemplateRows: `repeat(${mosaic.rows}, 1fr)`,
        gap: g,
        background: gap,
      }}
    >
      {mosaic.cells.map((cell, i) => {
        const appear = Math.round((cell.appear ?? 0) * fps);
        const colour = cell.color != null && frame >= Math.round(cell.color * fps);
        return (
          <div key={i} style={{ position: "relative", overflow: "hidden", background: "#000" }}>
            <Sequence from={appear} layout="none">
              <AbsoluteFill style={{ filter: colour ? "none" : "grayscale(1) contrast(1.1)" }}>
                <OffthreadVideo
                  src={staticFile(cell.src)}
                  trimBefore={Math.round((cell.start ?? 0) * fps)}
                  playbackRate={cell.speed ?? 1}
                  muted
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: cell.position ?? "center" }}
                />
              </AbsoluteFill>
            </Sequence>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

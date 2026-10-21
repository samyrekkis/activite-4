import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { gradeToFilter, type Theme } from "../themes";
import { isImage } from "../timeline";
import type { Clip } from "../types";
import { MotionLayer } from "./MotionLayer";
import { PanelsView } from "./PanelsView";
import { MosaicView } from "./MosaicView";
import { RevealMask } from "./RevealMask";
import { SocialLayer } from "./SocialLayer";
import { CurveFilter } from "../grading";
import { TextLayer } from "./TextLayer";

export const ClipView: React.FC<{ clip: Clip; index: number; theme: Theme; durationInFrames: number; handle?: string }> = ({
  clip,
  index,
  theme,
  durationInFrames,
  handle,
}) => {
  const { fps, width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const grade = { ...theme.grade, ...clip.grade };
  const src = staticFile(clip.src);
  // Mirror (flips a camera move left/right) on the media itself, around its own centre,
  // so it never combines with the reframe origin and pushes the image out of frame.
  const media: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", ...(clip.mirror ? { transform: "scaleX(-1)" } : {}) };
  const curveId = `curve-${index}`;
  const filter = [grade.curve ? `url(#${curveId})` : "", gradeToFilter(grade)].join(" ").trim();

  // Quadrant transition: this shot shows quarter by quarter (top-left, bottom-left,
  // top-right, bottom-right) over the end of the previous shot, then in full.
  const q = clip.quadIn;
  const qt = frame / fps;
  let quadPath: string | undefined;
  if (q && qt < q.dur) {
    const W = width / 2, H = height / 2;
    const quads = [[0, 0], [0, H], [W, 0], [W, H]].filter((_, k) => qt >= (k * q.dur) / 4);
    quadPath = `path('${quads.map(([x, y]) => `M${x} ${y}H${x + W}V${y + H}H${x}Z`).join(" ")}')`;
  }
  const prevGrade = q ? { ...theme.grade, ...q.grade } : undefined;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.background, overflow: "hidden" }}>
      {q && prevGrade && quadPath ? (
        <AbsoluteFill>
          {prevGrade.curve ? <CurveFilter id={`quad-${curveId}`} curve={prevGrade.curve} /> : null}
          <AbsoluteFill style={{ filter: [prevGrade.curve ? `url(#quad-${curveId})` : "", gradeToFilter(prevGrade)].join(" ").trim() }}>
            <OffthreadVideo src={staticFile(q.src)} trimBefore={Math.round(q.start * fps)} playbackRate={q.speed ?? 1} muted
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </AbsoluteFill>
        </AbsoluteFill>
      ) : null}
      <AbsoluteFill style={quadPath ? { clipPath: quadPath } : undefined}>
      <MotionLayer motion={clip.motion ?? "none"} intensity={clip.motionIntensity ?? 1} seed={`clip-${index}`}
        durationInFrames={durationInFrames}
        zoom={clip.zoom}
      >
        {grade.curve ? <CurveFilter id={curveId} curve={grade.curve} /> : null}
        <AbsoluteFill
          style={{
            filter,
            // Static reframe (no movement): hides an edge without a fake camera move.
            ...(clip.reframe ? { transform: `scale(${clip.reframe.scale})`, transformOrigin: clip.reframe.origin ?? "center" } : {}),          }}
        >
          {clip.mosaic ? (
            <MosaicView mosaic={clip.mosaic} gap={theme.colors.background} />
          ) : clip.panels?.length ? (
            <PanelsView panels={clip.panels} layout={clip.layout ?? "rows"} stagger={clip.stagger ?? 0.15} gap={theme.colors.background} />
          ) : isImage(clip.src) ? (
            <Img src={src} style={media} />
          ) : (
            <OffthreadVideo
              src={src}
              trimBefore={Math.round((clip.start ?? 0) * fps)}
              playbackRate={clip.speed ?? 1}
              muted={clip.muted ?? true}
              volume={clip.volume ?? 1}
              style={media}
            />
          )}
        </AbsoluteFill>
        {grade.tint ? (
          <AbsoluteFill style={{ backgroundColor: grade.tint, mixBlendMode: grade.tintBlend ?? "soft-light" }} />
        ) : null}
      </MotionLayer>
      </AbsoluteFill>
      {clip.reveal ? (
        // Black outside the revealed rectangles (puzzle reveal); the shot keeps playing underneath.
        <RevealMask reveal={clip.reveal} />
      ) : null}
      {clip.letterbox ? (
        // Cinema bars inside the vertical frame: the image reads as a wide film shot.
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "9%", background: "#000" }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "9%", background: "#000" }} />
        </AbsoluteFill>
      ) : null}
      {clip.text?.length ? <TextLayer overlays={clip.text} theme={theme} durationInFrames={durationInFrames} /> : null}
      {clip.social?.length ? (
        <SocialLayer cards={clip.social} theme={theme} durationInFrames={durationInFrames} handle={handle} />
      ) : null}
    </AbsoluteFill>
  );
};

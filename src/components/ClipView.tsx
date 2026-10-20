import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useVideoConfig } from "remotion";
import { gradeToFilter, type Theme } from "../themes";
import { isImage } from "../timeline";
import type { Clip } from "../types";
import { MotionLayer } from "./MotionLayer";
import { PanelsView } from "./PanelsView";
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
  const { fps } = useVideoConfig();
  const grade = { ...theme.grade, ...clip.grade };
  const src = staticFile(clip.src);
  const media: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };
  const curveId = `curve-${index}`;
  const filter = [grade.curve ? `url(#${curveId})` : "", gradeToFilter(grade)].join(" ").trim();

  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.background, overflow: "hidden" }}>
      <MotionLayer motion={clip.motion ?? "none"} intensity={clip.motionIntensity ?? 1} seed={`clip-${index}`}
        durationInFrames={durationInFrames}
      >
        {grade.curve ? <CurveFilter id={curveId} curve={grade.curve} /> : null}
        <AbsoluteFill
          style={{
            filter,
            // Static reframe (no movement): hides an edge without a fake camera move.
            ...(clip.reframe ? { transform: `scale(${clip.reframe.scale})`, transformOrigin: clip.reframe.origin ?? "center" } : {}),
          }}
        >
          {clip.panels?.length ? (
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

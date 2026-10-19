import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, staticFile, useVideoConfig } from "remotion";
import { gradeToFilter, type Theme } from "../themes";
import { isImage } from "../timeline";
import type { Clip } from "../types";
import { MotionLayer } from "./MotionLayer";
import { TextLayer } from "./TextLayer";

export const ClipView: React.FC<{ clip: Clip; index: number; theme: Theme; durationInFrames: number }> = ({
  clip,
  index,
  theme,
  durationInFrames,
}) => {
  const { fps } = useVideoConfig();
  const grade = { ...theme.grade, ...clip.grade };
  const src = staticFile(clip.src);
  const media: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };
  const blur = clip.fit === "blur";
  // In "blur" mode the sharp picture is shown slightly larger than "contain" so it fills more of the frame.
  const fitted: React.CSSProperties = blur ? { ...media, objectFit: "contain", transform: "scale(1.3)" } : media;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.background, overflow: "hidden" }}>
      <MotionLayer motion={clip.motion ?? "none"} intensity={clip.motionIntensity ?? 1} seed={`clip-${index}`}
        durationInFrames={durationInFrames}
      >
        {blur && isImage(clip.src) ? (
          <AbsoluteFill style={{ filter: `${gradeToFilter(grade)} blur(40px) brightness(0.7)`, transform: "scale(1.15)" }}>
            <Img src={src} style={media} />
          </AbsoluteFill>
        ) : null}
        {blur && !isImage(clip.src) ? (
          <AbsoluteFill style={{ filter: `${gradeToFilter(grade)} blur(40px) brightness(0.7)`, transform: "scale(1.15)" }}>
            <OffthreadVideo
              src={src}
              trimBefore={Math.round((clip.start ?? 0) * fps)}
              playbackRate={clip.speed ?? 1}
              muted
              style={media}
            />
          </AbsoluteFill>
        ) : null}
        <AbsoluteFill style={{ filter: gradeToFilter(grade) }}>
          {isImage(clip.src) ? (
            <Img src={src} style={fitted} />
          ) : (
            <OffthreadVideo
              src={src}
              trimBefore={Math.round((clip.start ?? 0) * fps)}
              playbackRate={clip.speed ?? 1}
              muted={clip.muted ?? true}
              volume={clip.volume ?? 1}
              style={fitted}
            />
          )}
        </AbsoluteFill>
        {grade.tint ? (
          <AbsoluteFill style={{ backgroundColor: grade.tint, mixBlendMode: grade.tintBlend ?? "soft-light" }} />
        ) : null}
      </MotionLayer>
      {clip.text?.length ? <TextLayer overlays={clip.text} theme={theme} durationInFrames={durationInFrames} /> : null}
    </AbsoluteFill>
  );
};

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
  const media: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: `50% ${Math.round((clip.focus ?? 0.5) * 100)}%`,
  };
  const renderMedia = (style: React.CSSProperties, background: boolean) =>
    isImage(clip.src) ? (
      <Img src={src} style={style} />
    ) : (
      <OffthreadVideo
        src={src}
        trimBefore={Math.round((clip.start ?? 0) * fps)}
        playbackRate={clip.speed ?? 1}
        muted={background || (clip.muted ?? true)}
        volume={clip.volume ?? 1}
        style={style}
      />
    );

  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.background, overflow: "hidden" }}>
      <MotionLayer motion={clip.motion ?? "none"} intensity={clip.motionIntensity ?? 1} seed={`clip-${index}`}
        durationInFrames={durationInFrames}
      >
        <AbsoluteFill style={{ filter: gradeToFilter(grade) }}>
          {clip.fit === "blur" ? (
            // Portrait media in a landscape frame: blurred copy behind, whole picture in front.
            <>
              <AbsoluteFill style={{ filter: "blur(40px) brightness(0.6)", transform: "scale(1.15)" }}>
                {renderMedia(media, true)}
              </AbsoluteFill>
              <AbsoluteFill>{renderMedia({ ...media, objectFit: "contain" }, false)}</AbsoluteFill>
            </>
          ) : (
            renderMedia(media, false)
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

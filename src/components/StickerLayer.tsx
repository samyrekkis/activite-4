import React from "react";
import { Gif } from "@remotion/gif";
import { AbsoluteFill, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { toFrames } from "../timeline";
import type { Sticker } from "../types";

const DEFAULT_SECONDS = 1.5;

const StickerView: React.FC<{ sticker: Sticker; durationInFrames: number }> = ({ sticker, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const w = (sticker.width ?? 0.4) * width;
  const animation = sticker.animation ?? "pop";
  const enter = spring({ frame, fps, config: { damping: 12, stiffness: 180 } });
  const exit = interpolate(frame, [durationInFrames - 5, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = animation === "pop" ? enter : 1;
  const dy = animation === "slide" ? (1 - enter) * height * 0.25 : 0;
  const opacity = (animation === "fade" ? Math.min(1, frame / 6) : 1) * exit;
  const src = staticFile(sticker.src);
  const style: React.CSSProperties = { width: w, height: "auto", display: "block" };

  let media: React.ReactNode;
  if (/\.gif$/i.test(sticker.src)) {
    media = <Gif src={src} width={w} fit="contain" style={{ width: w }} />;
  } else if (/\.(mp4|webm|mov)$/i.test(sticker.src)) {
    media = (
      <OffthreadVideo
        src={src}
        muted
        transparent={/\.webm$/i.test(sticker.src)}
        trimBefore={Math.round((sticker.start ?? 0) * fps)}
        style={style}
      />
    );
  } else {
    media = <Img src={src} style={style} />;
  }

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: (sticker.x ?? 0.5) * width,
          top: (sticker.y ?? 0.5) * height,
          transform: `translate(-50%, -50%) translateY(${dy}px) rotate(${sticker.rotate ?? 0}deg) scale(${scale})`,
          opacity,
        }}
      >
        {media}
      </div>
    </AbsoluteFill>
  );
};

export const StickerLayer: React.FC<{ stickers: Sticker[] }> = ({ stickers }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {stickers.map((s, i) => {
        const frames = toFrames(s.duration ?? DEFAULT_SECONDS, fps);
        return (
          <Sequence key={i} from={Math.round(s.at * fps)} durationInFrames={frames}>
            <StickerView sticker={s} durationInFrames={frames} />
          </Sequence>
        );
      })}
    </>
  );
};

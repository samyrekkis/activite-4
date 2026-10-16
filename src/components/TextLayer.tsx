import React from "react";
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Theme } from "../themes";
import type { TextOverlay } from "../types";

const positionStyle = (position: TextOverlay["position"]): React.CSSProperties => {
  switch (position) {
    case "top":
      return { justifyContent: "flex-start", paddingTop: "14%" };
    case "center":
      return { justifyContent: "center" };
    default:
      return { justifyContent: "flex-end", paddingBottom: "18%" };
  }
};

const AnimatedText: React.FC<{ overlay: TextOverlay; theme: Theme; durationInFrames: number }> = ({
  overlay,
  theme,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const style = overlay.style ?? "caption";
  const unit = width / 1080;

  const enter = spring({ frame, fps, config: { damping: 14, stiffness: 160 } });
  const exit = interpolate(frame, [durationInFrames - 6, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const base: React.CSSProperties = {
    color: theme.colors.text,
    textShadow: theme.colors.textShadow,
    textAlign: "center",
    padding: `0 ${60 * unit}px`,
    opacity: Math.min(enter, exit),
    lineHeight: 1.1,
  };

  if (style === "title" || style === "kanji") {
    // Letter-by-letter reveal.
    const letters = [...overlay.content];
    return (
      <div
        style={{
          ...base,
          fontFamily: theme.fonts.title,
          fontWeight: 700,
          fontSize: (style === "kanji" ? 220 : 110) * unit,
          letterSpacing: style === "kanji" ? 0 : 2 * unit,
        }}
      >
        {letters.map((ch, i) => {
          const s = spring({ frame: frame - i * 1.5, fps, config: { damping: 12, stiffness: 180 } });
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                whiteSpace: "pre",
                opacity: s,
                transform: `translateY(${(1 - s) * 40 * unit}px)`,
              }}
            >
              {ch}
            </span>
          );
        })}
      </div>
    );
  }

  if (style === "price" || style === "tag") {
    const pop = interpolate(enter, [0, 1], [0.6, 1]);
    return (
      <div style={{ ...base, display: "flex", justifyContent: "center", textShadow: "none" }}>
        <div
          style={{
            background: style === "price" ? theme.colors.primary : "rgba(0,0,0,0.55)",
            border: `${3 * unit}px solid ${theme.colors.accent}`,
            color: theme.colors.text,
            fontFamily: theme.fonts.accent,
            fontWeight: 700,
            fontSize: (style === "price" ? 76 : 52) * unit,
            padding: `${14 * unit}px ${36 * unit}px`,
            borderRadius: 999,
            transform: `scale(${pop}) rotate(${style === "price" ? -3 : 0}deg)`,
          }}
        >
          {overlay.content}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        ...base,
        fontFamily: theme.fonts.body,
        fontWeight: 600,
        fontSize: 58 * unit,
        transform: `translateY(${(1 - enter) * 30 * unit}px)`,
      }}
    >
      {overlay.content}
    </div>
  );
};

export const TextLayer: React.FC<{ overlays: TextOverlay[]; theme: Theme; durationInFrames: number }> = ({
  overlays,
  theme,
  durationInFrames,
}) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {overlays.map((overlay, i) => {
        const from = Math.round((overlay.delay ?? 0.1) * fps);
        const length = Math.max(
          1,
          Math.min(overlay.duration ? Math.round(overlay.duration * fps) : Infinity, durationInFrames - from),
        );
        return (
          <Sequence key={i} from={from} durationInFrames={length} layout="none">
            <AbsoluteFill style={{ alignItems: "center", ...positionStyle(overlay.position) }}>
              <AnimatedText overlay={overlay} theme={theme} durationInFrames={length} />
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </>
  );
};

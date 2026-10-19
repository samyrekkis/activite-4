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
      return { justifyContent: "flex-end", paddingBottom: "30%" };
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
    // Letter-by-letter reveal. Words never break mid-word, and long titles
    // shrink so the longest word fits the frame width.
    const words = overlay.content.split(" ");
    // Split into graphemes so emoji like ✈️ (two code points) stay whole.
    const graphemes = (w: string) => Array.from(new Intl.Segmenter().segment(w), (g) => g.segment);
    const longest = Math.max(...words.map((w) => graphemes(w).length));
    const size = style === "kanji" ? 220 : Math.min(120, 1500 / Math.max(longest, 1));
    let index = 0;
    return (
      <div
        style={{
          ...base,
          fontFamily: theme.fonts.title,
          fontWeight: 700,
          fontSize: size * unit,
          letterSpacing: style === "kanji" ? 0 : 2 * unit,
          // Titles sit on busy footage: a tight dark halo keeps them readable on any colour.
          textShadow: `0 0 ${18 * unit}px rgba(0,0,0,0.85), 0 ${4 * unit}px ${10 * unit}px rgba(0,0,0,0.9)`,
        }}
      >
        {words.map((word, w) => (
          <span key={w} style={{ display: "inline-block", whiteSpace: "nowrap", margin: `0 ${0.15 * size * unit}px` }}>
            {graphemes(word).map((ch) => {
              const s = spring({ frame: frame - index++ * 1.5, fps, config: { damping: 12, stiffness: 180 } });
              return (
                <span
                  key={index}
                  style={{ display: "inline-block", opacity: s, transform: `translateY(${(1 - s) * 40 * unit}px)` }}
                >
                  {ch}
                </span>
              );
            })}
          </span>
        ))}
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
        fontSize: 64 * unit,
        // Multi-line captions (contact details) keep their line breaks.
        whiteSpace: "pre-line",
        textShadow: `0 0 ${14 * unit}px rgba(0,0,0,0.9), 0 ${3 * unit}px ${8 * unit}px rgba(0,0,0,0.9)`,
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

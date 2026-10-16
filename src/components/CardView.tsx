import React from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { gradeToFilter, type Theme } from "../themes";
import { isImage } from "../timeline";
import type { Card } from "../types";

// Intro / outro card: restaurant name, ornament, subtitle (address, handle, offer).
export const CardView: React.FC<{ card: Card; theme: Theme; variant: "intro" | "outro" }> = ({
  card,
  theme,
  variant,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const unit = width / 1080;
  const title = spring({ frame, fps, config: { damping: 15, stiffness: 120 } });
  const sub = spring({ frame: frame - 8, fps, config: { damping: 18 } });
  const line = interpolate(frame, [4, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const dark = theme.colors.background === "#0B0B0D";

  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center" }}>
      {card.background ? (
        <AbsoluteFill style={{ filter: `${gradeToFilter(theme.grade)} blur(6px) brightness(0.55)`, transform: "scale(1.1)" }}>
          {isImage(card.background) ? (
            <Img src={staticFile(card.background)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <OffthreadVideo muted src={staticFile(card.background)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          )}
        </AbsoluteFill>
      ) : null}
      <div style={{ textAlign: "center", padding: `0 ${70 * unit}px` }}>
        {theme.ornament ? (
          <div
            style={{
              fontFamily: theme.fonts.title,
              color: theme.colors.primary,
              fontSize: 120 * unit,
              opacity: title,
              transform: `scale(${interpolate(title, [0, 1], [1.6, 1])})`,
              marginBottom: 20 * unit,
            }}
          >
            {theme.ornament}
          </div>
        ) : null}
        <div
          style={{
            fontFamily: theme.fonts.title,
            fontWeight: 700,
            fontSize: (variant === "intro" ? 120 : 96) * unit,
            color: card.background || dark ? "#FFFFFF" : theme.colors.primary,
            opacity: title,
            transform: `translateY(${(1 - title) * 60 * unit}px)`,
            lineHeight: 1.05,
          }}
        >
          {card.title}
        </div>
        <div
          style={{
            height: 4 * unit,
            width: `${line * 60}%`,
            margin: `${30 * unit}px auto`,
            background: theme.colors.accent,
          }}
        />
        {card.subtitle ? (
          <div
            style={{
              fontFamily: theme.fonts.body,
              fontSize: 46 * unit,
              letterSpacing: 6 * unit,
              textTransform: "uppercase",
              color: card.background || dark ? theme.colors.accent : "#3A2A1A",
              opacity: sub,
              transform: `translateY(${(1 - sub) * 30 * unit}px)`,
            }}
          >
            {card.subtitle}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

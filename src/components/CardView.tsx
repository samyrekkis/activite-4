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
  const { fps, width, height } = useVideoConfig();
  const unit = Math.min(width, height) / 1080;
  if (card.style === "rotatePhone") return <RotatePhoneCard card={card} theme={theme} />;
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
        {card.logo ? (
          <Img
            src={staticFile(card.logo)}
            style={{
              width: 560 * unit,
              opacity: title,
              transform: `scale(${interpolate(title, [0, 1], [1.4, 1])})`,
              marginBottom: 30 * unit,
            }}
          />
        ) : theme.ornament ? (
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

// "Tourne ton téléphone" opener (travel-story style): a phone outline turns from portrait to
// landscape, then headphones appear. Made for landscape edits; in the story version (turned 90°)
// it reads like the classic "rotate your phone" intro.
const RotatePhoneCard: React.FC<{ card: Card; theme: Theme }> = ({ card, theme }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const unit = Math.min(width, height) / 1080;
  const half = Math.round(durationInFrames * 0.55);
  const appear = spring({ frame, fps, config: { damping: 18 } });
  const turn = spring({ frame: frame - Math.round(fps * 0.5), fps, config: { damping: 14, stiffness: 90 } });
  const out1 = interpolate(frame, [half - 8, half], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const in2 = spring({ frame: frame - half, fps, config: { damping: 18 } });
  const label: React.CSSProperties = {
    fontFamily: theme.fonts.body,
    fontWeight: 600,
    fontSize: 34 * unit,
    letterSpacing: 10 * unit,
    textTransform: "uppercase",
    color: "#EDEDED",
    marginTop: 60 * unit,
  };
  const stroke = 6 * unit;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: Math.min(appear, out1) }}>
        <div
          style={{
            width: 150 * unit,
            height: 280 * unit,
            border: `${stroke}px solid #EDEDED`,
            borderRadius: 30 * unit,
            transform: `rotate(${-90 * turn}deg)`,
            position: "relative",
          }}
        >
          <div style={{ position: "absolute", top: 14 * unit, left: "35%", width: "30%", height: 8 * unit, borderRadius: 8 * unit, background: "#EDEDED" }} />
        </div>
        <div style={label}>{card.title || "Tourne ton téléphone"}</div>
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          // Gone before the transition so nothing bleeds onto the first shot.
          opacity: Math.min(in2, interpolate(frame, [durationInFrames - 24, durationInFrames - 14], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })),
        }}
      >
        <svg width={200 * unit} height={180 * unit} viewBox="0 0 200 180" fill="none" stroke="#EDEDED" strokeWidth={6}>
          <path d="M30 110 V90 a70 70 0 0 1 140 0 V110" strokeLinecap="round" />
          <rect x="18" y="100" width="34" height="62" rx="14" />
          <rect x="148" y="100" width="34" height="62" rx="14" />
        </svg>
        <div style={label}>{card.hint ?? "Mets tes écouteurs"}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

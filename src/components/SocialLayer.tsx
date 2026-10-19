import React from "react";
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Theme } from "../themes";
import type { SocialCard } from "../types";

// Instagram-style cards animated over a clip: a post frame, a comment bubble,
// a location pin, a "Réserver" button, story progress bars, a "save" card.
// They stay inside the Reels safe zone (nothing in the top 12 % / bottom 20 %),
// except the post frame and the story bars, which imitate the app on purpose.

const Avatar: React.FC<{ size: number; theme: Theme; letter: string }> = ({ size, theme, letter }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      padding: size * 0.07,
      background: "linear-gradient(45deg,#FEDA75,#FA7E1E,#D62976,#962FBF,#4F5BD5)",
      flexShrink: 0,
    }}
  >
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "50%",
        border: `${size * 0.05}px solid white`,
        background: theme.colors.primary,
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: theme.fonts.title,
        fontSize: size * 0.42,
        fontWeight: 700,
      }}
    >
      {letter}
    </div>
  </div>
);

const Icon: React.FC<{ d: string; size: number; fill?: string; stroke?: string }> = ({ d, size, fill = "none", stroke = "#111" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const HEART = "M12 21s-7.5-4.6-9.5-9.3C1.1 8.3 3.3 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.7 0 5.9 3.8 4.5 7.2C19.5 16.4 12 21 12 21z";
const BUBBLE = "M21 11.5a8.4 8.4 0 0 1-12.3 7.5L3 21l2-5.3A8.5 8.5 0 1 1 21 11.5z";
const PLANE = "M22 3L9.2 13.1M22 3l-7 18-3.8-7.9L3 9.5 22 3z";
const SAVE = "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z";
const PIN = "M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z";

const useEnter = (delayFrames = 0) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delayFrames, fps, config: { damping: 15, stiffness: 170 } });
};

const Post: React.FC<{ card: SocialCard; theme: Theme; unit: number; handle: string; total: number }> = ({ card, theme, unit, handle, total }) => {
  const frame = useCurrentFrame();
  const enter = useEnter();
  const liked = frame > total * 0.45;
  const pop = spring({ frame: frame - total * 0.45, fps: 30, config: { damping: 8, stiffness: 220 } });
  const bar: React.CSSProperties = { position: "absolute", left: 0, right: 0, background: "white", display: "flex", alignItems: "center", padding: `0 ${36 * unit}px`, gap: 22 * unit };
  return (
    <AbsoluteFill style={{ transform: `translateY(${(1 - enter) * 6}%)`, opacity: enter }}>
      <div style={{ ...bar, top: 0, height: 150 * unit, paddingTop: 30 * unit }}>
        <Avatar size={78 * unit} theme={theme} letter={handle.replace("@", "")[0]?.toUpperCase() ?? "R"} />
        <div style={{ fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 34 * unit, color: "#111" }}>
          {handle.replace("@", "")}
          {card.place ? <div style={{ fontWeight: 400, fontSize: 26 * unit, color: "#444" }}>{card.place}</div> : null}
        </div>
        <div style={{ marginLeft: "auto", fontSize: 40 * unit, color: "#111" }}>•••</div>
      </div>
      <div style={{ ...bar, bottom: 0, height: 300 * unit, flexDirection: "column", alignItems: "flex-start", justifyContent: "flex-start", paddingTop: 26 * unit, gap: 14 * unit }}>
        <div style={{ display: "flex", gap: 30 * unit, width: "100%" }}>
          <div style={{ transform: `scale(${liked ? 1 + 0.35 * Math.sin(Math.min(1, pop) * Math.PI) : 1})` }}>
            <Icon d={HEART} size={62 * unit} fill={liked ? "#ED4956" : "none"} stroke={liked ? "#ED4956" : "#111"} />
          </div>
          <Icon d={BUBBLE} size={62 * unit} />
          <Icon d={PLANE} size={62 * unit} />
          <div style={{ marginLeft: "auto" }}>
            <Icon d={SAVE} size={62 * unit} />
          </div>
        </div>
        <div style={{ fontFamily: theme.fonts.body, fontSize: 30 * unit, color: "#111", lineHeight: 1.35 }}>
          <b>{handle.replace("@", "")}</b> {card.text ?? ""}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Comment: React.FC<{ card: SocialCard; theme: Theme; unit: number }> = ({ card, theme, unit: base }) => {
  const unit = base * 1.4;
  const enter = useEnter();
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "flex-start", paddingBottom: "34%", paddingLeft: 60 * unit }}>
      <div
        style={{
          display: "flex",
          gap: 20 * unit,
          alignItems: "center",
          background: "rgba(255,255,255,0.96)",
          borderRadius: 40 * unit,
          padding: `${22 * unit}px ${34 * unit}px`,
          maxWidth: 820 * unit,
          boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
          transform: `scale(${0.6 + 0.4 * enter}) translateY(${(1 - enter) * 40 * unit}px)`,
          transformOrigin: "left bottom",
          opacity: enter,
        }}
      >
        <Avatar size={70 * unit} theme={theme} letter={(card.handle ?? "@a").replace("@", "")[0]?.toUpperCase() ?? "A"} />
        <div style={{ fontFamily: theme.fonts.body, color: "#111", fontSize: 32 * unit, lineHeight: 1.3 }}>
          <div style={{ fontWeight: 600, fontSize: 27 * unit, color: "#555" }}>{(card.handle ?? "@ton.pote").replace("@", "")}</div>
          {card.text}
        </div>
        <div style={{ marginLeft: 8 * unit }}>
          <Icon d={HEART} size={38 * unit} fill="#ED4956" stroke="#ED4956" />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Location: React.FC<{ card: SocialCard; theme: Theme; unit: number }> = ({ card, theme, unit }) => {
  const enter = useEnter();
  const frame = useCurrentFrame();
  const chars = Math.floor(interpolate(frame, [6, 30], [0, (card.place ?? "").length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: "16%" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14 * unit,
          background: "rgba(255,255,255,0.95)",
          borderRadius: 999,
          padding: `${16 * unit}px ${34 * unit}px ${16 * unit}px ${24 * unit}px`,
          boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
          transform: `translateY(${(1 - enter) * -60 * unit}px)`,
          opacity: enter,
        }}
      >
        <Icon d={PIN} size={52 * unit} fill={theme.colors.primary} stroke="white" />
        <span style={{ fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 38 * unit, color: "#111" }}>
          {(card.place ?? "").slice(0, chars)}
        </span>
      </div>
    </AbsoluteFill>
  );
};

const Reserve: React.FC<{ card: SocialCard; theme: Theme; unit: number; total: number }> = ({ card, theme, unit, total }) => {
  const frame = useCurrentFrame();
  const enter = useEnter();
  const tap = total * 0.55;
  const press = frame > tap && frame < tap + 6 ? 0.92 : 1;
  const ripple = interpolate(frame, [tap, tap + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const cursorY = interpolate(frame, [0, tap], [260, 0], { extrapolateRight: "clamp" }) * unit;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: "30%" }}>
      <div
        style={{
          position: "relative",
          background: theme.colors.primary,
          color: "white",
          fontFamily: theme.fonts.body,
          fontWeight: 600,
          fontSize: 46 * unit,
          letterSpacing: 2 * unit,
          padding: `${30 * unit}px ${90 * unit}px`,
          borderRadius: 999,
          boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
          transform: `scale(${(0.7 + 0.3 * enter) * press})`,
          opacity: enter,
          overflow: "visible",
        }}
      >
        {card.text ?? "Réserver"}
        <div
          style={{
            position: "absolute",
            inset: -20 * ripple * unit,
            borderRadius: 999,
            border: `${4 * unit}px solid rgba(255,255,255,${1 - ripple})`,
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 60 * unit,
            bottom: -30 * unit - cursorY,
            width: 54 * unit,
            height: 54 * unit,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.85)",
            boxShadow: "0 0 0 6px rgba(0,0,0,0.12)",
            opacity: frame < tap + 10 ? 1 : 0,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

const Story: React.FC<{ card: SocialCard; theme: Theme; unit: number; total: number; handle: string }> = ({ card, theme, unit, total, handle }) => {
  const frame = useCurrentFrame();
  const segments = card.segments ?? 4;
  const current = Math.min(segments - 1, card.index ?? 0);
  const progress = interpolate(frame, [0, total], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ padding: `${40 * unit}px ${24 * unit}px`, background: "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 14%)" }}>
      <div style={{ display: "flex", gap: 8 * unit }}>
        {Array.from({ length: segments }, (_, i) => (
          <div key={i} style={{ flex: 1, height: 6 * unit, borderRadius: 3 * unit, background: "rgba(255,255,255,0.4)", overflow: "hidden" }}>
            <div style={{ height: "100%", background: "white", width: `${i < current ? 100 : i === current ? progress * 100 : 0}%` }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18 * unit, marginTop: 24 * unit }}>
        <Avatar size={70 * unit} theme={theme} letter={handle.replace("@", "")[0]?.toUpperCase() ?? "R"} />
        <span style={{ fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 32 * unit, color: "white", textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>
          {handle.replace("@", "")}
        </span>
      </div>
    </AbsoluteFill>
  );
};

const Saved: React.FC<{ card: SocialCard; theme: Theme; unit: number }> = ({ card, theme, unit }) => {
  const enter = useEnter();
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 22 * unit,
          background: "rgba(20,20,20,0.82)",
          backdropFilter: "blur(10px)",
          borderRadius: 30 * unit,
          padding: `${28 * unit}px ${40 * unit}px`,
          transform: `scale(${0.8 + 0.2 * enter})`,
          opacity: enter,
        }}
      >
        <Icon d={SAVE} size={58 * unit} fill="white" stroke="white" />
        <span style={{ fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 36 * unit, color: "white" }}>
          {card.text ?? "Enregistré pour ton prochain brunch"}
        </span>
      </div>
    </AbsoluteFill>
  );
};

export const SocialLayer: React.FC<{ cards: SocialCard[]; theme: Theme; durationInFrames: number; handle?: string }> = ({
  cards,
  theme,
  durationInFrames,
  handle = "@restaurant",
}) => {
  const { fps, width } = useVideoConfig();
  const unit = width / 1080;
  return (
    <>
      {cards.map((card, i) => {
        const from = Math.round((card.delay ?? 0) * fps);
        const total = Math.max(1, card.duration ? Math.round(card.duration * fps) : durationInFrames - from);
        const props = { card, theme, unit };
        return (
          <Sequence key={i} from={from} durationInFrames={total} layout="none">
            <AbsoluteFill>
              {card.kind === "post" ? <Post {...props} handle={card.handle ?? handle} total={total} /> : null}
              {card.kind === "comment" ? <Comment {...props} /> : null}
              {card.kind === "location" ? <Location {...props} /> : null}
              {card.kind === "reserve" ? <Reserve {...props} total={total} /> : null}
              {card.kind === "story" ? <Story {...props} total={total} handle={card.handle ?? handle} /> : null}
              {card.kind === "saved" ? <Saved {...props} /> : null}
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </>
  );
};

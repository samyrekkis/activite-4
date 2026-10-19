import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import { TransitionSeries } from "@remotion/transitions";
import { CardView } from "./components/CardView";
import { ClipView } from "./components/ClipView";
import { Grain, Letterbox, Vignette } from "./components/LookOverlays";
import { THEMES } from "./themes";
import { buildSegments, totalFrames, transitionFrames, toFrames } from "./timeline";
import { presentationFor, timingFor } from "./transitions";
import type { EditPlan } from "./types";

export const RestoEdit: React.FC<EditPlan> = (plan) => {
  const { fps, width, height } = useVideoConfig();
  const theme = THEMES[plan.restaurant];
  const segments = buildSegments(plan);
  const duration = totalFrames(plan);
  const fadeOut = toFrames(plan.music?.fadeOut ?? 1, fps);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.background }}>
      <TransitionSeries>
        {segments.map((seg, i) => {
          const tFrames = i > 0 ? transitionFrames(seg.transitionIn, segments[i - 1].frames, seg.frames, fps) : 0;
          const content =
            seg.kind === "clip" ? (
              <ClipView clip={seg.clip} index={seg.index} theme={theme} durationInFrames={seg.frames} handle={plan.handle} />
            ) : (
              <CardView
                card={
                  seg.kind === "intro"
                    ? plan.intro!
                    : { ...plan.outro!, subtitle: plan.outro!.subtitle ?? plan.handle }
                }
                theme={theme}
                variant={seg.kind}
              />
            );
          return (
            <React.Fragment key={i}>
              {tFrames > 0 && seg.transitionIn ? (
                <TransitionSeries.Transition
                  presentation={presentationFor(seg.transitionIn, theme, { width, height })}
                  timing={timingFor(seg.transitionIn, tFrames)}
                />
              ) : null}
              <TransitionSeries.Sequence durationInFrames={seg.frames}>{content}</TransitionSeries.Sequence>
            </React.Fragment>
          );
        })}
      </TransitionSeries>

      <Vignette amount={plan.overlays?.vignette ?? theme.vignette} />
      <Grain amount={plan.overlays?.grain ?? theme.grain} />
      {plan.overlays?.letterbox ? <Letterbox /> : null}

      {plan.music ? (
        <Audio
          src={staticFile(plan.music.src)}
          trimBefore={Math.round((plan.music.startAt ?? 0) * fps)}
          volume={(f) =>
            (plan.music!.volume ?? 0.9) *
            interpolate(f, [0, 8, duration - fadeOut, duration], [0, 1, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          }
        />
      ) : null}

      {plan.sfx?.map((s, i) => (
        <Sequence
          key={i}
          from={Math.round(s.at * fps)}
          durationInFrames={s.duration ? toFrames(s.duration, fps) : undefined}
          layout="none"
        >
          <Audio src={staticFile(s.src)} volume={s.volume ?? 0.8} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

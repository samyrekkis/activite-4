import React from "react";
import { Composition } from "remotion";
import { RestoEdit } from "./RestoEdit";
import { FORMATS } from "./themes";
import { DEFAULT_FPS, totalFrames } from "./timeline";
import type { EditPlan } from "./types";
import demo from "../edits/demo-samourai.json";

// One composition, driven entirely by the edit plan passed as --props.
export const RemotionRoot: React.FC = () => (
  <Composition
    id="RestoEdit"
    component={RestoEdit as unknown as React.FC<Record<string, unknown>>}
    defaultProps={demo as unknown as Record<string, unknown>}
    width={1080}
    height={1920}
    fps={DEFAULT_FPS}
    durationInFrames={1}
    calculateMetadata={({ props }) => {
      const plan = props as unknown as EditPlan;
      return {
        durationInFrames: totalFrames(plan),
        fps: plan.fps ?? DEFAULT_FPS,
        ...FORMATS[plan.format ?? "vertical"],
      };
    }}
  />
);

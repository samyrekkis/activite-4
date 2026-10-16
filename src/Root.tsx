import React from "react";
import { Composition } from "remotion";
import { RestoEdit } from "./RestoEdit";
import { FORMATS } from "./themes";
import { DEFAULT_FPS, totalFrames } from "./timeline";
import type { EditPlan } from "./types";
import demo from "../edits/demo-samourai.json";

type Props = { plan: EditPlan };

// One composition, driven entirely by the edit plan passed as --props={"plan": …}.
// The plan is nested so Remotion's shallow merge with defaultProps can't leak
// optional keys (intro, sfx…) from the demo into a real edit.
const Edit: React.FC<Props> = ({ plan }) => <RestoEdit {...plan} />;

export const RemotionRoot: React.FC = () => (
  <Composition
    id="RestoEdit"
    component={Edit}
    defaultProps={{ plan: demo as unknown as EditPlan }}
    width={1080}
    height={1920}
    fps={DEFAULT_FPS}
    durationInFrames={1}
    calculateMetadata={({ props }) => {
      const { plan } = props;
      return {
        durationInFrames: totalFrames(plan),
        fps: plan.fps ?? DEFAULT_FPS,
        ...FORMATS[plan.format ?? "vertical"],
      };
    }}
  />
);

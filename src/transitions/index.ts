import { linearTiming, springTiming, type TransitionPresentation } from "@remotion/transitions";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { fade } from "@remotion/transitions/fade";
import { flip } from "@remotion/transitions/flip";
import { iris } from "@remotion/transitions/iris";
import { pushCut } from "@remotion/transitions/push-cut";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { Easing } from "remotion";
import type { Theme } from "../themes";
import type { Transition } from "../types";
import { flash, whip, zoomPunch } from "./custom";

export const presentationFor = (
  t: Transition,
  theme: Theme,
  size: { width: number; height: number },
): TransitionPresentation<any> => {
  const direction = t.direction ?? "from-right";
  switch (t.type) {
    case "slide":
      return slide({ direction });
    case "wipe":
      return wipe({ direction });
    case "flip":
      return flip({ direction });
    case "clockWipe":
      return clockWipe(size);
    case "iris":
      return iris(size);
    case "pushCut":
      return pushCut({ flashColor: theme.colors.accent });
    case "flash":
      return flash("#FFFFFF");
    case "zoomPunch":
      return zoomPunch();
    case "whip":
      return whip(direction);
    case "fade":
    default:
      return fade();
  }
};

// Eased (not linear) so motion transitions accelerate and land smoothly.
const EASED = new Set<Transition["type"]>(["whip", "slide", "wipe", "zoomPunch", "iris", "clockWipe"]);

export const timingFor = (t: Transition, frames: number) =>
  t.type === "flip" || t.type === "pushCut"
    ? springTiming({ durationInFrames: frames, config: { damping: 200 } })
    : linearTiming({
        durationInFrames: frames,
        easing: EASED.has(t.type) ? Easing.inOut(Easing.cubic) : undefined,
      });

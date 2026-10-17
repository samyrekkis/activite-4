import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";

type FlashProps = { color: string };

// White (or brand-colour) flash: outgoing burns out, incoming emerges from the flash.
const Flash: React.FC<TransitionPresentationComponentProps<FlashProps>> = ({
  children,
  presentationDirection,
  presentationProgress: p,
  passedProps,
}) => {
  const entering = presentationDirection === "entering";
  const flash = entering
    ? interpolate(p, [0, 0.5, 1], [0, 1, 0], { extrapolateRight: "clamp" })
    : 0;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: entering ? (p > 0.5 ? 1 : 0) : 1 }}>{children}</AbsoluteFill>
      {entering ? <AbsoluteFill style={{ backgroundColor: passedProps.color, opacity: flash }} /> : null}
    </AbsoluteFill>
  );
};

export const flash = (color = "#FFFFFF"): TransitionPresentation<FlashProps> => ({
  component: Flash,
  props: { color },
});

// Zoom punch: outgoing scales up and fades, incoming lands from a slight overscale.
const ZoomPunch: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({
  children,
  presentationDirection,
  presentationProgress: p,
}) => {
  const entering = presentationDirection === "entering";
  const scale = entering ? interpolate(p, [0, 1], [1.35, 1]) : interpolate(p, [0, 1], [1, 1.6]);
  const opacity = entering ? interpolate(p, [0, 0.6], [0, 1], { extrapolateRight: "clamp" }) : 1 - p;
  const blur = entering ? (1 - p) * 10 : p * 14;
  return (
    <AbsoluteFill style={{ transform: `scale(${scale})`, opacity, filter: `blur(${blur}px)` }}>{children}</AbsoluteFill>
  );
};

export const zoomPunch = (): TransitionPresentation<Record<string, never>> => ({
  component: ZoomPunch,
  props: {},
});

type WhipProps = { direction: "from-left" | "from-right" | "from-top" | "from-bottom" };

// Whip pan: fast directional slide with motion blur, the signature fast-cut look.
const Whip: React.FC<TransitionPresentationComponentProps<WhipProps>> = ({
  children,
  presentationDirection,
  presentationProgress: p,
  passedProps,
}) => {
  const entering = presentationDirection === "entering";
  const horizontal = passedProps.direction === "from-left" || passedProps.direction === "from-right";
  const sign = passedProps.direction === "from-left" || passedProps.direction === "from-top" ? -1 : 1;
  const offset = entering ? sign * (1 - p) * 100 : -sign * p * 100;
  const blur = Math.sin(p * Math.PI) * 18;
  const transform = horizontal ? `translateX(${offset}%)` : `translateY(${offset}%)`;
  return <AbsoluteFill style={{ transform, filter: `blur(${blur}px)` }}>{children}</AbsoluteFill>;
};

export const whip = (direction: WhipProps["direction"] = "from-right"): TransitionPresentation<WhipProps> => ({
  component: Whip,
  props: { direction },
});

// Blur cut: a 2-4 frame directional motion-blur smear. Unlike whip, the image barely
// moves; the outgoing shot smears out along one axis and the incoming one resolves from it.
const BlurCut: React.FC<TransitionPresentationComponentProps<WhipProps>> = ({
  children,
  presentationDirection,
  presentationProgress: p,
  passedProps,
}) => {
  const id = `blurcut-${React.useId().replace(/:/g, "")}`;
  const entering = presentationDirection === "entering";
  const horizontal = passedProps.direction === "from-left" || passedProps.direction === "from-right";
  const sign = passedProps.direction === "from-left" || passedProps.direction === "from-top" ? -1 : 1;
  const amount = entering ? 1 - p : p;
  const blur = 70 * amount;
  const offset = (entering ? sign : -sign) * amount * 10;
  const transform = `scale(${1 + 0.12 * amount}) ${horizontal ? `translateX(${offset}%)` : `translateY(${offset}%)`}`;
  const opacity = entering ? interpolate(p, [0.35, 0.6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  return (
    <AbsoluteFill style={{ opacity }}>
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <filter id={id} x="0" y="0" width="100%" height="100%">
          <feGaussianBlur stdDeviation={horizontal ? `${blur} 0` : `0 ${blur}`} edgeMode="duplicate" />
        </filter>
      </svg>
      <AbsoluteFill style={{ transform, filter: blur > 0.5 ? `url(#${id})` : undefined }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

export const blurCut = (direction: WhipProps["direction"] = "from-right"): TransitionPresentation<WhipProps> => ({
  component: BlurCut,
  props: { direction },
});

import React from "react";

// Film-style tone curves, applied with an SVG filter (per-channel tables from
// black to white). CSS filters only do global brightness/contrast; curves give
// the split toning of a real grade: teal shadows with warm skin, lifted film
// blacks, golden highlights…
export type CurveName = "tealOrange" | "film" | "golden" | "neon" | "bleach" | "noir" | "moody";

type Curve = { r: string; g: string; b: string; saturate?: number };

export const CURVES: Record<CurveName, Curve> = {
  // Blockbuster look: cool teal shadows, warm orange mids and highlights.
  tealOrange: { r: "0 0.16 0.55 0.9 1", g: "0.03 0.24 0.52 0.84 0.97", b: "0.12 0.34 0.5 0.7 0.86", saturate: 1.1 },
  // Analogue film: lifted blacks, soft rolled-off highlights, slightly warm.
  film: { r: "0.07 0.23 0.54 0.83 0.96", g: "0.06 0.21 0.5 0.8 0.95", b: "0.06 0.19 0.46 0.75 0.9", saturate: 0.95 },
  // Late afternoon sun on food: warm and rich.
  golden: { r: "0.02 0.28 0.6 0.88 1", g: "0.01 0.22 0.52 0.82 0.96", b: "0 0.14 0.4 0.67 0.84", saturate: 1.15 },
  // Night and neon: deep blacks, magenta-blue highlights.
  neon: { r: "0 0.17 0.52 0.86 1", g: "0 0.12 0.43 0.78 0.94", b: "0.06 0.3 0.6 0.88 1", saturate: 1.2 },
  // Bleach bypass: desaturated, punchy contrast.
  bleach: { r: "0 0.12 0.5 0.9 1", g: "0 0.12 0.5 0.9 1", b: "0 0.12 0.5 0.9 1", saturate: 0.55 },
  // Black and white, contrasty.
  noir: { r: "0 0.08 0.5 0.93 1", g: "0 0.08 0.5 0.93 1", b: "0 0.08 0.5 0.93 1", saturate: 0 },
  // Dark and moody: crushed highlights, green-teal shadows.
  moody: { r: "0.02 0.15 0.44 0.74 0.9", g: "0.04 0.18 0.46 0.74 0.88", b: "0.06 0.2 0.45 0.7 0.84", saturate: 0.9 },
};

export const CurveFilter: React.FC<{ id: string; curve: CurveName }> = ({ id, curve }) => {
  const c = CURVES[curve];
  return (
    <svg width="0" height="0" style={{ position: "absolute" }}>
      <filter id={id} colorInterpolationFilters="sRGB">
        {c.saturate !== undefined ? <feColorMatrix type="saturate" values={String(c.saturate)} /> : null}
        <feComponentTransfer>
          <feFuncR type="table" tableValues={c.r} />
          <feFuncG type="table" tableValues={c.g} />
          <feFuncB type="table" tableValues={c.b} />
        </feComponentTransfer>
      </filter>
    </svg>
  );
};

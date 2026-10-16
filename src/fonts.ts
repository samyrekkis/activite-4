import { continueRender, delayRender, staticFile } from "remotion";
import manifest from "./fonts.manifest.json";

// Self-hosted fonts (see scripts/fetch-fonts.mjs): renders work offline and
// never wait on Google Fonts.
const handle = delayRender("Loading local fonts");
Promise.all(
  manifest.map((f) => {
    const face = new FontFace(f.family, `url(${staticFile(f.file)}) format("woff2")`, {
      weight: f.weight,
      unicodeRange: f.unicodeRange,
    });
    document.fonts.add(face);
    return face.load();
  }),
)
  .then(() => continueRender(handle))
  .catch((err) => {
    console.error("Font loading failed", err);
    continueRender(handle);
  });

export const FONTS = {
  playfair: "'Playfair Display', serif",
  montserrat: "'Montserrat', sans-serif",
  shippori: "'Shippori Mincho', serif",
  bebas: "'Bebas Neue', sans-serif",
};

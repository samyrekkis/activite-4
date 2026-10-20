import { FONTS } from "./fonts";
import type { Grade, RestaurantId, TransitionType } from "./types";

export type Theme = {
  name: string;
  colors: {
    background: string;
    primary: string;
    accent: string;
    text: string;
    textShadow: string;
  };
  fonts: { title: string; body: string; accent: string };
  grade: Grade;
  grain: number;
  vignette: number;
  defaultTransition: TransitionType;
  /** Kanji / ornament shown on cards. */
  ornament?: string;
};

export const THEMES: Record<RestaurantId, Theme> = {
  // Brunch, plats généreux, déco soignée : lumière chaude, élégance méditerranéenne.
  monegasque: {
    name: "Le Monégasque",
    colors: {
      background: "#F6EFE4",
      primary: "#C8102E",
      accent: "#D4AF37",
      text: "#FFFFFF",
      textShadow: "0 4px 24px rgba(60,30,0,0.55)",
    },
    fonts: {
      title: FONTS.playfair,
      body: FONTS.montserrat,
      accent: FONTS.playfair,
    },
    grade: {
      brightness: 1.04,
      contrast: 1.06,
      saturate: 1.18,
      sepia: 0.1,
      tint: "rgba(255,170,90,0.10)",
      tintBlend: "soft-light",
    },
    grain: 0.05,
    vignette: 0.25,
    defaultTransition: "fade",
    ornament: "✦",
  },
  // Cuisine asiatique, kimonos, miroir, chambre à table basse : contraste, rouge laqué, noir.
  samourai: {
    name: "Le Samouraï",
    colors: {
      background: "#0B0B0D",
      primary: "#B3001B",
      accent: "#E8C170",
      text: "#FFFFFF",
      textShadow: "0 4px 28px rgba(0,0,0,0.8)",
    },
    fonts: {
      title: FONTS.shippori,
      body: FONTS.montserrat,
      accent: FONTS.bebas,
    },
    // Neutral base: whites stay white (rice, plates), blacks keep detail. The
    // red veil and heavy contrast of the first version turned whites pink and
    // crushed the shadows; the look now comes from the curve of each edit.
    grade: {
      brightness: 1.0,
      contrast: 1.06,
      saturate: 1.04,
    },
    grain: 0.08,
    vignette: 0.45,
    defaultTransition: "whip",
    ornament: "侍",
  },
};

export const FORMATS = {
  vertical: { width: 1080, height: 1920 },
  horizontal: { width: 1920, height: 1080 },
  square: { width: 1080, height: 1080 },
} as const;

export const gradeToFilter = (g: Grade): string =>
  [
    `brightness(${g.brightness ?? 1})`,
    `contrast(${g.contrast ?? 1})`,
    `saturate(${g.saturate ?? 1})`,
    `sepia(${g.sepia ?? 0})`,
    `hue-rotate(${g.hueRotate ?? 0}deg)`,
  ].join(" ");

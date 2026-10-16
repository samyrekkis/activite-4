// Downloads the theme fonts from Google Fonts into public/fonts/ and writes
// src/fonts.manifest.json, so renders never depend on the network.
// Run once after changing the font list: npm run fonts
import { mkdirSync, writeFileSync } from "node:fs";

const FAMILIES = [
  "Playfair+Display:wght@400;700",
  "Montserrat:wght@400;600",
  "Bebas+Neue",
  "Shippori+Mincho:wght@700",
];
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const url = `https://fonts.googleapis.com/css2?${FAMILIES.map((f) => `family=${f}`).join("&")}&display=block`;
const css = await (await fetch(url, { headers: { "User-Agent": UA } })).text();

mkdirSync("public/fonts", { recursive: true });
const manifest = [];
for (const block of css.matchAll(/@font-face\s*{([^}]*)}/g)) {
  const body = block[1];
  const family = body.match(/font-family:\s*'([^']+)'/)[1];
  const weight = body.match(/font-weight:\s*(\d+)/)[1];
  const src = body.match(/url\((https:[^)]+\.woff2)\)/)[1];
  const unicodeRange = body.match(/unicode-range:\s*([^;]+);/)?.[1].trim();
  const file = `fonts/${family.replace(/\s+/g, "")}-${weight}-${manifest.length}.woff2`;
  const data = Buffer.from(await (await fetch(src)).arrayBuffer());
  writeFileSync(`public/${file}`, data);
  manifest.push({ family, weight, unicodeRange, file });
}
writeFileSync("src/fonts.manifest.json", JSON.stringify(manifest, null, 1) + "\n");
console.log(`${manifest.length} fichiers de police téléchargés dans public/fonts/`);

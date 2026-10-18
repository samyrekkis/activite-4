// Usage: node scripts/voiceover.mjs public/voice/<nom>.mp3 <voix> "<consigne + texte>"
// Voix off avec Gemini TTS (même clé que la revue). Voix utiles : Charon (grave),
// Kore (femme posée), Puck (énergique), Aoede (femme chaleureuse).
// Le texte peut commencer par une consigne de ton : "Dis d'une voix grave et lente : ..."
import { writeFileSync, unlinkSync } from "node:fs";
import { loadEnv, run, probe } from "./lib/media.mjs";

loadEnv();
const [out, voice = "Charon", text] = process.argv.slice(2);
if (!out || !text) {
  console.error('Usage : node scripts/voiceover.mjs public/voice/x.mp3 Charon "texte"');
  process.exit(1);
}

const body = {
  contents: [{ parts: [{ text }] }],
  generationConfig: {
    responseModalities: ["AUDIO"],
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
  },
};
// Le quota gratuit est de quelques requêtes par minute : on réessaie après une pause.
let json;
for (let attempt = 0; attempt < 6; attempt++) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${process.env.GEMINI_API_KEY}`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
  );
  json = await res.json();
  if (res.status !== 429) break;
  await new Promise((r) => setTimeout(r, 30000));
}
const data = json.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
if (!data) {
  console.error("Pas d'audio :", JSON.stringify(json).slice(0, 400));
  process.exit(1);
}

const pcm = out.replace(/\.mp3$/, ".pcm");
writeFileSync(pcm, Buffer.from(data, "base64"));
// PCM 16 bits 24 kHz mono -> MP3, silences de début et de fin retirés.
await run("ffmpeg", [
  "-y", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", pcm,
  "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse",
  "-b:a", "192k", out,
]);
unlinkSync(pcm);
const { duration } = await probe(out);
console.log(`${out} : ${duration.toFixed(2)} s`);

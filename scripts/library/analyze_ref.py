# Reads a reference edit (an Instagram Reel the client wants copied): the song's
# tempo, beats and strong hits, and the cut times of the edit. For screen
# recordings of an editing app, pass the crop of the preview window so the
# timeline below does not count as cuts.
#   python analyze_ref.py <video> <out.json> [crop=w:h:x:y] [threshold]
import json
import re
import subprocess
import sys

import librosa
import numpy as np

src, out = sys.argv[1], sys.argv[2]
crop = next((a.split("=", 1)[1] for a in sys.argv[3:] if a.startswith("crop=")), None)
thr = next((a for a in sys.argv[3:] if re.fullmatch(r"[\d.]+", a)), "10")

wav = out.replace(".json", ".wav")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vn", "-ac", "1", "-ar", "22050", wav], check=True)
y, sr = librosa.load(wav, sr=22050)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units="time")
env = librosa.onset.onset_strength(y=y, sr=sr)
onsets = librosa.onset.onset_detect(onset_envelope=env, sr=sr, units="time", backtrack=False)
strength = env[librosa.time_to_frames(onsets, sr=sr)]
strong = [round(float(t), 3) for t, s in zip(onsets, strength) if s > np.percentile(strength, 75)]

vf = (f"crop={crop}," if crop else "") + f"scdet=threshold={thr},metadata=print:file=-"
log = subprocess.run(["ffmpeg", "-hide_banner", "-i", src, "-vf", vf, "-an", "-f", "null", "-"],
                     capture_output=True, text=True).stdout
cuts = [round(float(t), 3) for t in re.findall(r"lavfi\.scd\.time=([\d.]+)", log)]
# Merge cuts closer than 2 frames (a flash or a wipe counts once).
merged = []
for c in cuts:
    if not merged or c - merged[-1] > 0.07:
        merged.append(c)
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src],
                           capture_output=True, text=True).stdout)
json.dump({"src": src, "duration": round(dur, 3), "tempo": round(float(np.atleast_1d(tempo)[0]), 1),
           "beats": [round(float(b), 3) for b in beats], "strong": strong, "cuts": merged},
          open(out, "w"), indent=1)
print(f"{src}: {dur:.1f}s tempo {float(np.atleast_1d(tempo)[0]):.0f} BPM, {len(beats)} beats, {len(merged)} cuts")
print("cuts:", " ".join(f"{c:.2f}" for c in merged))
print("beats:", " ".join(f"{b:.2f}" for b in beats[:40]))

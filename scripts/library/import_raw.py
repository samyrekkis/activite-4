# Imports raw phone footage (no text, no watermark) into clips for the library:
# H.264 1080x1920, 60 fps kept (slow motion stays fluid), no audio; takes longer
# than --max seconds are split into equal pieces. Writes <out>/<name>_<nn>.mp4,
# a still per clip (.jpg) and <out>/<name>.json in the same format as
# extract_clips.py, so build_library.py can use them.
#   python import_raw.py <out_dir> <video>... [--max 6]
import json
import math
import subprocess
import sys
from pathlib import Path

args = sys.argv[1:]
max_s = float(args[args.index("--max") + 1]) if "--max" in args else 6.0
args = [a for i, a in enumerate(args) if a != "--max" and (i == 0 or args[i - 1] != "--max")]
out = Path(args[0])
out.mkdir(parents=True, exist_ok=True)


def probe(path, entry):
    return subprocess.run(["ffprobe", "-v", "error", "-show_entries", entry, "-of", "csv=p=0", path],
                          capture_output=True, text=True).stdout.strip().splitlines()[0]


for src in map(Path, args[1:]):
    duration = float(probe(str(src), "format=duration"))
    parts = max(1, math.ceil(duration / max_s))
    step = duration / parts
    report = []
    for k in range(parts):
        a, b = k * step, min(duration, (k + 1) * step) - 0.05
        if b - a < 0.6:
            continue
        name = f"{src.stem.upper()}_{k + 1:02d}"
        clip = out / f"{name}.mp4"
        # ffmpeg applies the phone's rotation flag; scale to the vertical frame.
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{a:.3f}", "-i", str(src), "-t", f"{b - a:.3f}", "-an",
                        "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=60",
                        "-c:v", "libx264", "-crf", "17", "-preset", "fast", "-pix_fmt", "yuv420p",
                        "-movflags", "+faststart", str(clip)], check=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{(b - a) / 2:.3f}", "-i", str(clip), "-frames:v", "1",
                        "-q:v", "2", str(out / f"{name}.jpg")], check=True)
        report.append({"clip": name, "source": src.name, "in": round(a, 2), "out": round(b, 2),
                       "duration": round(b - a, 2), "cropped": False, "sharpness": 0, "width": 1080, "height": 1920})
    (out / f"{src.stem.upper()}.json").write_text(json.dumps(report, indent=1), encoding="utf-8")
    print(f"{src.name}: {len(report)} clips")

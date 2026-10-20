# Finds when the Instagram watermark (logo, faded in and out by Instagram) is on
# screen in library clips, and stores it in the catalogue as "wm": [[t0, t1], ...]
# so build-plan.mjs can pick in points that avoid it (erasing it smears).
#   python scan_watermark.py <resto> [first_id_number]
import json
import sys
from pathlib import Path

import cv2

STEP = 2
THRESHOLD = 0.5
TEMPLATE = cv2.imread(str(Path(__file__).with_name("ig_glyph.png")), cv2.IMREAD_GRAYSCALE)
SCALES = [cv2.resize(TEMPLATE, None, fx=s, fy=s) for s in (0.7, 0.85, 1.0, 1.2, 1.4)]

resto = sys.argv[1]
first = int(sys.argv[2]) if len(sys.argv) > 2 else 0
lib = Path("public/library") / resto
cat_path = lib / "catalogue.json"
cat = json.loads(cat_path.read_text(encoding="utf-8"))
clips = cat["clips"] if isinstance(cat, dict) else cat


def logo(frame):
    w = cv2.threshold(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), 190, 255, cv2.THRESH_BINARY)[1]
    return max(cv2.minMaxLoc(cv2.matchTemplate(w, t, cv2.TM_CCOEFF_NORMED))[1] for t in SCALES)


for c in clips:
    if int(c["id"].split("-")[1]) < first:
        continue
    cap = cv2.VideoCapture(str(lib / "clips" / f"{c['id']}.mp4"))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    hits, i = [], 0
    while True:
        ok, f = cap.read()
        if not ok:
            break
        if i % STEP == 0 and logo(f) >= THRESHOLD:
            hits.append(i / fps)
        i += 1
    spans = []
    for t in hits:
        if spans and t - spans[-1][1] <= 3 * STEP / fps:
            spans[-1][1] = t
        else:
            spans.append([t, t])
    # Margin: the watermark fades in and out around the detected frames.
    c["wm"] = [[round(max(0, a - 0.15), 2), round(b + 0.15, 2)] for a, b in spans]
    if spans:
        print(c["id"], c["wm"], flush=True)
cat_path.write_text(json.dumps(cat, ensure_ascii=False, indent=1), encoding="utf-8")
print("done")

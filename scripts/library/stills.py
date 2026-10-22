# Photo candidates for carousels: for each clip of a theme, the sharpest of 7 frames,
# saved full size, plus a numbered contact sheet to choose from.
#   python stills.py <restaurant> <theme> <max>        (clips tagged with that theme)
#   python stills.py 4k <folder> <max>                  (original 4K rushes)
import json, os, subprocess, sys, glob
import numpy as np
from PIL import Image, ImageDraw
src, theme, mx = sys.argv[1], sys.argv[2], int(sys.argv[3])
def dur(p):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p], capture_output=True, text=True).stdout.strip() or 0)
def frame(p, t):
    out = subprocess.run(["ffmpeg", "-v", "error", "-nostdin", "-ss", f"{t:.2f}", "-i", p, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"], capture_output=True).stdout
    from io import BytesIO
    return Image.open(BytesIO(out)).convert("RGB") if out else None
def sharp(im):
    g = np.asarray(im.convert("L").resize((360, int(360 * im.height / im.width))), np.float32)
    lap = g[1:-1, 1:-1] * 4 - g[:-2, 1:-1] - g[2:, 1:-1] - g[1:-1, :-2] - g[1:-1, 2:]
    return float(lap.var()) * (0.6 if g.mean() < 60 else 1.0)  # dark frames rank lower
if src == "4k":
    clips = [(os.path.splitext(os.path.basename(p))[0], p) for p in sorted(glob.glob(os.path.join(theme, "IMG_*.MOV")))]
    name = "samourai-4k"
else:
    tags = json.load(open(f"public/library/{src}/themes.json", encoding="utf8"))
    cat = json.load(open(f"public/library/{src}/catalogue.json", encoding="utf8"))["clips"]
    pick = [m for m in cat if theme in tags.get(m["id"], {}).get("themes", []) and not tags[m["id"]]["logo"]
            and (m.get("quality", 2) >= 2) and tags[m["id"]]["lumiere"] != "sombre"]
    pick.sort(key=lambda m: -m.get("quality", 2))
    clips = [(m["id"], f"public/library/{src}/clips/{m['id']}.mp4") for m in pick]
    name = f"{src}-{theme}"
out = f"out/stills/{name}"; os.makedirs(out, exist_ok=True)
best = []
for cid, p in clips[:mx]:
    d = dur(p)
    cands = [f for f in (frame(p, d * k / 8) for k in range(1, 8)) if f]
    if not cands: continue
    im = max(cands, key=sharp)
    if im.width > im.height and src == "4k": im = im.rotate(-90, expand=True) if False else im
    im.save(f"{out}/{cid}.jpg", quality=95); best.append(cid)
# contact sheet, numbered
th = [Image.open(f"{out}/{c}.jpg") for c in best]
W, H = 180, 320; cols = 8; rows = (len(th) + cols - 1) // cols
sheet = Image.new("RGB", (cols * W, max(1, rows) * (H + 22)), "black"); dr = ImageDraw.Draw(sheet)
for i, (c, im) in enumerate(zip(best, th)):
    im = im.copy(); im.thumbnail((W, H)); x, y = (i % cols) * W, (i // cols) * (H + 22)
    sheet.paste(im, (x, y)); dr.text((x + 4, y + H + 4), c, fill="white")
sheet.save(f"out/stills/{name}-sheet.jpg", quality=85)
print(name, len(best))

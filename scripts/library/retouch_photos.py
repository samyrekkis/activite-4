# Free local photo retouch (no AI generation, nothing added or removed):
# white balance, local contrast, gentle saturation and warmth, sharpening,
# 2x upscale, then crops for Instagram: 4:5 post and 9:16 story.
#   python retouch_photos.py <photos_dir> <out_dir> [--warm 1.0]
# Writes "<name> - post 4x5.jpg" and "<name> - story 9x16.jpg".
import sys
from pathlib import Path

import cv2
import numpy as np

src, out = Path(sys.argv[1]), Path(sys.argv[2])
warm = float(sys.argv[sys.argv.index("--warm") + 1]) if "--warm" in sys.argv else 1.0
out.mkdir(parents=True, exist_ok=True)


def white_balance(img):
    # Gray-world on the mid-tones only, light touch: keeps the restaurant's warm light.
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
    mid = (lab[..., 0] > 40) & (lab[..., 0] < 220)
    for c in (1, 2):
        shift = lab[..., c][mid].mean() - 128
        lab[..., c] -= shift * 0.15
    return cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)


def retouch(img):
    img = white_balance(img)
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    l = cv2.createCLAHE(clipLimit=1.6, tileGridSize=(8, 8)).apply(l)
    img = cv2.cvtColor(cv2.merge([l, a, b]), cv2.COLOR_LAB2BGR)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] = np.clip(hsv[..., 1] * 1.15, 0, 255)
    img = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32)
    img[..., 2] *= 1 + 0.05 * warm  # a touch of warmth: food looks better warm
    img[..., 0] *= 1 - 0.05 * warm
    img = np.clip(img, 0, 255).astype(np.uint8)
    img = cv2.resize(img, None, fx=2, fy=2, interpolation=cv2.INTER_LANCZOS4)
    img = cv2.fastNlMeansDenoisingColored(img, None, 3, 3, 7, 21)
    blur = cv2.GaussianBlur(img, (0, 0), 2.0)
    return cv2.addWeighted(img, 1.5, blur, -0.5, 0)


def crop(img, ratio):
    h, w = img.shape[:2]
    if w / h > ratio:
        nw = int(h * ratio)
        x = (w - nw) // 2
        return img[:, x:x + nw]
    nh = int(w / ratio)
    y = (h - nh) // 2
    return img[y:y + nh]


done = 0
for f in sorted(src.glob("*.jpg")):
    img = cv2.imdecode(np.fromfile(str(f), np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        continue
    r = retouch(img)
    for label, ratio in (("post 4x5", 4 / 5), ("story 9x16", 9 / 16)):
        ok, buf = cv2.imencode(".jpg", crop(r, ratio), [cv2.IMWRITE_JPEG_QUALITY, 93])
        buf.tofile(str(out / f"{f.stem} - {label}.jpg"))
    done += 1
print(f"{done} photos retouchées dans {out}")

# Convert iPhone photos (HEIC/JPG/PNG) to upright JPGs, max 2160 px tall.
# Usage: python3 scripts/convert-photos.py <in-dir> <out-dir>
import os, sys
import pillow_heif
from PIL import Image, ImageOps

pillow_heif.register_heif_opener()
src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
for name in sorted(os.listdir(src)):
    if not name.lower().endswith((".heic", ".heif", ".jpg", ".jpeg", ".png")):
        continue
    im = ImageOps.exif_transpose(Image.open(os.path.join(src, name))).convert("RGB")
    im.thumbnail((2160, 2160))
    out = os.path.join(dst, os.path.splitext(name)[0] + ".jpg")
    im.save(out, quality=90)
    print(out, im.size)

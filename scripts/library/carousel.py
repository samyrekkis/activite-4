# Instagram carousels (1080x1350): a cover with the title, the theme's photos retouched
# (auto levels, gentle vibrance, sharpening, quality upscale), and a closing slide.
#   python carousel.py <spec.json> <out dir>
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont
spec, outdir = json.load(open(sys.argv[1], encoding="utf8")), sys.argv[2]
W, H = 1080, 1350
F = "C:/Windows/Fonts/"
def retouch(im):
    a = np.asarray(im, np.float32)
    lo, hi = np.percentile(a, 0.8), np.percentile(a, 99.4)          # auto levels, no clipping drama
    a = np.clip((a - lo) * 255.0 / max(1, hi - lo), 0, 255)
    im = Image.fromarray(a.astype(np.uint8))
    im = ImageEnhance.Color(im).enhance(1.12)
    im = ImageEnhance.Brightness(im).enhance(1.04)
    return im
def fit(path, focus=0.5):
    im = Image.open(path).convert("RGB")
    r = W / H
    if im.width / im.height > r:  # too wide: crop sides
        w = int(im.height * r); x = int((im.width - w) * focus); im = im.crop((x, 0, x + w, im.height))
    else:                         # too tall: crop top/bottom around focus
        h = int(im.width / r); y = int((im.height - h) * focus); im = im.crop((0, y, im.width, y + h))
    im = retouch(im.resize((W, H), Image.LANCZOS))
    return im.filter(ImageFilter.UnsharpMask(radius=2, percent=70, threshold=2))
def shade(im, top=0.45):
    g = Image.new("L", (1, H)); [g.putpixel((0, y), int(200 * max(0, (y / H - top) / (1 - top)) ** 1.4)) for y in range(H)]
    black = Image.new("RGB", (W, H), "black"); return Image.composite(black, im, g.resize((W, H)))
def text(d, xy, s, font, fill="white", anchor="ls"):
    d.text((xy[0] + 2, xy[1] + 2), s, font=font, fill=(0, 0, 0), anchor=anchor); d.text(xy, s, font=font, fill=fill, anchor=anchor)
def wrap(s, font, d, maxw):
    lines, cur = [], ""
    for w in s.split():
        t = (cur + " " + w).strip()
        if d.textlength(t, font=font) > maxw and cur: lines.append(cur); cur = w
        else: cur = t
    return lines + [cur]
os.makedirs(outdir, exist_ok=True)
slides = spec["photos"]
# 1. cover
im = shade(fit(slides[0]["path"], slides[0].get("focus", 0.5)), 0.4); d = ImageDraw.Draw(im)
big, small = ImageFont.truetype(F + "georgiab.ttf", 92), ImageFont.truetype(F + "segoeuil.ttf", 40)
y = H - 150
for line in reversed(wrap(spec["title"], big, d, W - 140)): text(d, (70, y), line, big); y -= 104
text(d, (72, H - 80), spec["subtitle"], small, fill=(240, 225, 200))
text(d, (W - 70, 90), spec["handle"], ImageFont.truetype(F + "segoeuisl.ttf", 34), anchor="rs")
d.text((W - 70, H - 80), "→", font=ImageFont.truetype(F + "segoeui.ttf", 50), fill="white", anchor="rs")
im.save(f"{outdir}/01.jpg", quality=95)
# 2.. photos
for i, s in enumerate(slides[1:], start=2):
    im = fit(s["path"], s.get("focus", 0.5))
    if s.get("caption"):
        im = shade(im, 0.7); d = ImageDraw.Draw(im); text(d, (70, H - 70), s["caption"], ImageFont.truetype(F + "georgiai.ttf", 46))
    im.save(f"{outdir}/{i:02d}.jpg", quality=95)
# last: call to action on a blurred photo
im = fit(slides[0]["path"]).filter(ImageFilter.GaussianBlur(28)); im = ImageEnhance.Brightness(im).enhance(0.55); d = ImageDraw.Draw(im)
f1, f2 = ImageFont.truetype(F + "georgiab.ttf", 78), ImageFont.truetype(F + "segoeuil.ttf", 44)
y = H // 2 - 120
for line in wrap(spec["cta"], f1, d, W - 160): text(d, (W // 2, y), line, f1, anchor="ms"); y += 92
text(d, (W // 2, y + 40), spec["cta2"], f2, fill=(240, 225, 200), anchor="ms")
text(d, (W // 2, y + 110), spec["handle"], f2, anchor="ms")
im.save(f"{outdir}/{len(slides) + 1:02d}.jpg", quality=95)
print(outdir, len(slides) + 1, "slides")

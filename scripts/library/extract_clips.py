# Splits an edited Instagram video into short raw clips: one per shot, without
# transitions, without the Instagram end card, without text, without audio.
#   - the Instagram watermark (logo + @account) is small: it is inpainted;
#   - titles added in the edit are too big to inpaint cleanly: the clip is
#     cropped to the largest text-free band (same aspect ratio, scaled back to
#     the source size). Clips where no such band exists are skipped.
# Scene text (menus, neon signs) is kept: overlay text is recognised because it
# is perfectly horizontal and stays put on screen while the image moves.
# Also saves the sharpest frame of each clip as a JPG.
#
#   python extract_clips.py <video> <out_dir> [min_band, default 0.6]
#
# Writes <out_dir>/<video>_<nn>.mp4 and .jpg, and <out_dir>/<video>.json
# (one entry per clip: source, in/out, crop, sharpness).
import json
import re
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np
from rapidocr_onnxruntime import RapidOCR

SAMPLE_EVERY_S = 0.5      # OCR sampling period
MIN_CLIP_S = 0.35
MAX_CLIP_S = 4.0          # longer shots are split into several clips
MIN_BAND = float(sys.argv[3]) if len(sys.argv) > 3 else 0.6  # a crop keeps at least this share of the height
WATERMARK = re.compile(r"RESTAUR|MONEGAS|EGASQ|SAMOUR|SAMGUR|AMOURAIR")

src = Path(sys.argv[1])
out_dir = Path(sys.argv[2])
out_dir.mkdir(parents=True, exist_ok=True)
stem = src.stem.upper()

cap = cv2.VideoCapture(str(src))
fps = cap.get(cv2.CAP_PROP_FPS) or 30
W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
step = max(1, round(fps * SAMPLE_EVERY_S))
ocr = RapidOCR(text_score=0.05)  # Arabic overlays are recognised with low confidence


def detect(frame):
    """Text boxes of one frame: dicts with rect, angle, watermark flag."""
    scale = min(1.0, 900 / max(W, H))
    small = cv2.resize(frame, None, fx=scale, fy=scale)
    res, _ = ocr(small)
    found = []
    for quad, text, score in res or []:
        if score < 0.3:
            continue
        p = np.array(quad, float) / scale
        angle = float(np.degrees(np.arctan2(p[1][1] - p[0][1], p[1][0] - p[0][0])))
        x0, y0 = p.min(0)
        x1, y1 = p.max(0)
        letters = re.sub(r"[^A-Z_]", "", text.upper())
        small_line = (y1 - y0) < 0.03 * H and abs(angle) < 3
        found.append({"rect": [x0, y0, x1, y1], "angle": angle, "wm": small_line and bool(WATERMARK.search(letters))})
    return found


def iou(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    return inter / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter + 1e-6)


# Pass 1: frame differences (cuts), brightness, OCR on samples.
diffs, bright, samples, thumbs = [], [], {}, []
prev = None
i = 0
while True:
    ok, frame = cap.read()
    if not ok:
        break
    g = cv2.GaussianBlur(cv2.cvtColor(cv2.resize(frame, (72, 128)), cv2.COLOR_BGR2GRAY), (3, 3), 0).astype(np.float32)
    diffs.append(0.0 if prev is None else float(np.abs(g - prev).mean()))
    bright.append(float(g.mean()))
    thumbs.append(cv2.resize(frame, (180, round(180 * H / W)), interpolation=cv2.INTER_AREA))
    prev = g
    if i % step == 0:
        samples[i] = detect(frame)
    i += 1
n = i
cap.release()
keys = sorted(samples)

# Overlay text = horizontal and present at the same place in a neighbouring sample.
for si, k in enumerate(keys):
    for box in samples[k]:
        box["overlay"] = False
        if box["wm"] or abs(box["angle"]) > 3:
            continue
        neigh = [samples[keys[j]] for j in (si - 1, si + 1) if 0 <= j < len(keys)]
        x0, y0, x1, y1 = box["rect"]
        line = (x1 - x0) > 1.5 * (y1 - y0)  # vertical calligraphy in the decor is not a title
        if line and any(iou(box["rect"], o["rect"]) > 0.4 for nb in neigh for o in nb):
            box["overlay"] = True

# End card: a big centred @account, then walk back over the fade (max 1.5 s).
end = n
for k in (k for k in keys if k > n * 0.5):  # the end card is at the end, never before mid-video
    for box in samples[k]:
        x0, y0, x1, y1 = box["rect"]
        if box["wm"] and 0.3 * W < (x0 + x1) / 2 < 0.7 * W and 0.4 * H < (y0 + y1) / 2 < 0.75 * H and (y1 - y0) > 0.015 * H:
            end = k
            break
    if end < n:
        break
med_b = float(np.median(bright[: max(1, end)]))
limit = end - int(1.5 * fps)
while end > max(0, limit) and end < n and bright[end - 1] < 0.8 * med_b:
    end -= 1

# Cuts: frames whose difference is far above the local median.
d = np.array(diffs)
is_cut = np.zeros(n, bool)
for k in range(1, end):
    local = np.median(d[max(0, k - 15): min(end, k + 16)])
    is_cut[k] = d[k] > max(12.0, 3.5 * local)
# Cuts closer than 6 frames form one transition, dropped entirely.
shots, start, k = [], 0, 1
while k < end:
    if is_cut[k]:
        j = k
        while j + 1 < end and is_cut[j + 1: j + 7].any():
            j += 1 + int(np.argmax(is_cut[j + 1: j + 7]))
        shots.append((start, k - (1 if j > k else 0)))
        start = j + 1 + (1 if j > k else 0)
        k = j
    k += 1
shots.append((start, end))

clips = []
for a, b in shots:
    length = (b - a) / fps
    if length < MIN_CLIP_S:
        continue
    parts = int(np.ceil(length / MAX_CLIP_S))
    edges = np.linspace(a, b, parts + 1).astype(int)
    clips += [(int(edges[p]), int(edges[p + 1])) for p in range(parts)]

# Titles that stay on screen across several different shots (any script, even
# handwriting the OCR cannot read): pixels identical in most shots while the
# image behind changes, with the dense edges of lettering.
static_spans = []
mids = [thumbs[(a + b) // 2] for a, b in shots if b - a >= 3]
if len(mids) >= 5:
    stack = np.stack(mids).astype(np.int16)
    med = np.median(stack, 0)
    # Deviation reached by 75 % of the shots: low where something never changes.
    steady = np.sort(np.abs(stack - med).max(-1), 0)[len(mids) * 3 // 4] < 22
    edges = cv2.Canny(med.astype(np.uint8), 60, 140) > 0
    mask = cv2.dilate((steady & edges).astype(np.uint8), np.ones((11, 11), np.uint8))
    count, _, stats, _ = cv2.connectedComponentsWithStats(mask)
    for x, y, w, h, area in stats[1:]:
        if area > 60 and h < 0.3 * mask.shape[0] and w > 0.08 * mask.shape[1]:
            static_spans.append((y * W / 180, (y + h) * W / 180))
del thumbs


def near_samples(a, b):
    lo = np.searchsorted(keys, a) - 1
    hi = np.searchsorted(keys, b) + 1
    return [keys[j] for j in range(max(0, lo), min(len(keys), hi))]


def crop_for(a, b):
    """Largest horizontal band free of overlay text in [a, b), or None if none needed."""
    spans = sorted([(bx["rect"][1], bx["rect"][3]) for k in near_samples(a, b) for bx in samples[k] if bx["overlay"]] + static_spans)
    if not spans:
        return None
    merged = []
    for y0, y1 in spans:
        y0, y1 = y0 - 0.01 * H, y1 + 0.01 * H
        if merged and y0 <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], y1)
        else:
            merged.append([y0, y1])
    gaps, top = [], 0.0
    for y0, y1 in merged:
        gaps.append((top, y0))
        top = y1
    gaps.append((top, float(H)))
    g0, g1 = max(gaps, key=lambda g: g[1] - g[0])
    g0, g1 = max(0, int(g0)), min(H, int(g1))
    if g1 - g0 < MIN_BAND * H:
        return "skip"
    ch = g1 - g0
    cw = int(round(ch * W / H / 2) * 2)
    ch = int(ch // 2 * 2)
    return ((W - cw) // 2, g0, cw, ch)


def wm_mask(idx, a, b):
    """Rectangles around the watermark (logo above the @account) near frame idx."""
    m = np.zeros((H, W), np.uint8)
    pos = int(np.searchsorted(keys, idx))
    for j in {max(0, pos - 1), min(len(keys) - 1, pos)}:
        for bx in samples[keys[j]]:
            if not bx["wm"]:
                continue
            x0, y0, x1, y1 = bx["rect"]
            h = y1 - y0
            cx = (x0 + x1) / 2
            x0, x1 = min(x0, cx - 1.6 * h) - 0.4 * h, max(x1, cx + 1.6 * h) + 0.4 * h
            y0, y1 = y0 - 2.8 * h, y1 + 0.4 * h
            m[int(max(0, y0)): int(min(H, y1)), int(max(0, x0)): int(min(W, x1))] = 255
    return m


def strokes(roi, area):
    """Only the white strokes of the logo and the @account inside the watermark
    area: erasing a few pixels leaves no blur, erasing the whole box smears."""
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    white = (hsv[..., 2] > 200) & (hsv[..., 1] < 60)
    detail = np.abs(gray.astype(np.int16) - cv2.medianBlur(gray, 15).astype(np.int16)) > 28
    m = ((white | detail) & (area > 0)).astype(np.uint8) * 255
    return cv2.dilate(m, np.ones((3, 3), np.uint8), iterations=2)


# Pass 2: write each clip, plus its sharpest frame.
report = []
cap = cv2.VideoCapture(str(src))
ci = 0
for a, b in clips:
    crop = crop_for(a, b)
    if crop == "skip":
        continue
    ci += 1
    name = f"{stem}_{ci:02d}"
    ff = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
         "-r", f"{fps:.5f}", "-i", "-", "-an", "-c:v", "libx264", "-crf", "17", "-preset", "fast",
         "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out_dir / f"{name}.mp4")],
        stdin=subprocess.PIPE,
    )
    cap.set(cv2.CAP_PROP_POS_FRAMES, a)
    best, best_score = None, -1.0
    for idx in range(a, b):
        ok, frame = cap.read()
        if not ok:
            break
        m = wm_mask(idx, a, b)
        if m.any():
            ys, xs = np.where(m)
            y0, y1 = max(0, ys.min() - 12), min(H, ys.max() + 13)
            x0, x1 = max(0, xs.min() - 12), min(W, xs.max() + 13)
            frame[y0:y1, x0:x1] = cv2.inpaint(frame[y0:y1, x0:x1], strokes(frame[y0:y1, x0:x1], m[y0:y1, x0:x1]), 3, cv2.INPAINT_TELEA)
        if crop:
            x, y, cw, ch = crop
            frame = cv2.resize(frame[y:y + ch, x:x + cw], (W, H), interpolation=cv2.INTER_LANCZOS4)
            # Light unsharp mask: gives back the crispness lost by the enlargement.
            frame = cv2.addWeighted(frame, 1.35, cv2.GaussianBlur(frame, (0, 0), 1.2), -0.35, 0)
        ff.stdin.write(frame.tobytes())
        sharp = cv2.Laplacian(cv2.cvtColor(cv2.resize(frame, (W // 2, H // 2)), cv2.COLOR_BGR2GRAY), cv2.CV_64F).var()
        # The photo prefers frames where nothing had to be erased.
        score = sharp + (0 if m.any() else 1e6)
        if score > best_score:
            best, best_score = frame.copy(), score
    ff.stdin.close()
    ff.wait()
    if best is not None:
        cv2.imwrite(str(out_dir / f"{name}.jpg"), best, [cv2.IMWRITE_JPEG_QUALITY, 94])
    report.append({"clip": name, "source": src.name, "in": round(a / fps, 2), "out": round(b / fps, 2),
                   "duration": round((b - a) / fps, 2), "cropped": bool(crop),
                   "sharpness": round(best_score % 1e6, 1), "width": W, "height": H})
cap.release()
(out_dir / f"{stem}.json").write_text(json.dumps(report, indent=1), encoding="utf-8")
print(f"{src.name}: {len(report)} clips ({sum(r['cropped'] for r in report)} recadrés, "
      f"{len(clips) - len(report)} écartés), fin utile à {end / fps:.1f}s sur {n / fps:.1f}s")

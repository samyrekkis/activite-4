# Compares the overall look of a copy with its reference edit (Lab statistics on
# sampled frames: exposure, contrast, saturation, warmth, green/magenta) and
# prints a 0-10 closeness score plus the grade factors that bring the copy closer.
#   python color_match.py <copy.mp4> <ref.mp4> [ref_from] [ref_to] [--apply plan.json]
# --band y0 y1 measures only that horizontal band (fractions of the height), to skip an
# editing-app overlay or a caption in the reference.
# --apply multiplies every clip's brightness/contrast/saturate in the plan by the factors
# and sets a warm or cool tint when the warmth differs.
import json
import sys

import cv2
import numpy as np

band = (0.0, 1.0)
if "--band" in sys.argv:
    i = sys.argv.index("--band")
    band = (float(sys.argv[i + 1]), float(sys.argv[i + 2]))
    del sys.argv[i:i + 3]
crop = None
if "--crop" in sys.argv:
    i = sys.argv.index("--crop")
    crop = [int(x) for x in sys.argv[i + 1].split(":")]  # w:h:x:y in reference pixels
    del sys.argv[i:i + 2]
args = [a for a in sys.argv[1:] if not a.startswith("--")]
plan_path = sys.argv[sys.argv.index("--apply") + 1] if "--apply" in sys.argv else None
if plan_path:
    args.remove(plan_path)
copy, ref = args[0], args[1]
r0 = float(args[2]) if len(args) > 2 else 0
r1 = float(args[3]) if len(args) > 3 else None


def stats(path, t0=0, t1=None, n=40, box=None):
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    a, b = int(t0 * fps), int((t1 * fps) if t1 else total) - 1
    rows = []
    for i in np.linspace(a, max(a, b), n).astype(int):
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(i))
        ok, f = cap.read()
        if not ok:
            continue
        if box:
            w, h, x, y = box
            f = f[y:y + h, x:x + w]
        f = cv2.resize(f, (180, 320))[int(320 * band[0]):int(320 * band[1])]
        lab = cv2.cvtColor(f, cv2.COLOR_BGR2LAB).astype(np.float32)
        hsv = cv2.cvtColor(f, cv2.COLOR_BGR2HSV).astype(np.float32)
        L = lab[..., 0] * 100 / 255
        rows.append([L.mean(), L.std(), hsv[..., 1].mean() / 255, lab[..., 1].mean() - 128, lab[..., 2].mean() - 128])
    return np.array(rows).mean(0)


c, r = stats(copy), stats(ref, r0, r1, box=crop)
names = ["luminosité", "contraste", "saturation", "vert/magenta", "froid/chaud"]
# Distance weighted to what the eye notices most; 0 distance = 10/10.
d = (abs(c[0] - r[0]) / 4 + abs(c[1] - r[1]) / 3 + abs(c[2] - r[2]) / 0.08 + abs(c[3] - r[3]) / 4 + abs(c[4] - r[4]) / 4)
score = round(float(max(0.0, 10 - d)), 1)
fac = {
    "brightness": float(np.clip(r[0] / max(c[0], 1), 0.75, 1.3)),
    "contrast": float(np.clip(r[1] / max(c[1], 1), 0.75, 1.35)),
    "saturate": float(np.clip(r[2] / max(c[2], 0.01), 0.6, 1.5)),
}
warm = r[4] - c[4]
print(json.dumps({"colorMatch": score, "copy": dict(zip(names, np.round(c, 2).tolist())),
                  "ref": dict(zip(names, np.round(r, 2).tolist())),
                  "factors": {k: round(v, 3) for k, v in fac.items()}, "warmthDiff": round(float(warm), 2)}, ensure_ascii=False))

if plan_path:
    plan = json.load(open(plan_path, encoding="utf-8"))
    tint = None
    if abs(warm) > 1.5:
        alpha = min(0.22, abs(warm) / 40)
        tint = f"rgba(255,150,40,{alpha:.2f})" if warm > 0 else f"rgba(40,120,255,{alpha:.2f})"
    for clip in plan["clips"]:
        g = clip.setdefault("grade", {})
        for k, v in fac.items():
            g[k] = round(g.get(k, 1) * v, 3)
        if tint:
            g["tint"], g["tintBlend"] = tint, "soft-light"
    plan["version"] = plan.get("version", 1) + 1
    json.dump(plan, open(plan_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"plan updated to v{plan['version']}")

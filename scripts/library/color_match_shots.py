# Shot-by-shot colour matching of a copy to its reference: for each shot of the
# plan, compares the copy's frames in that shot with the reference's frames at the
# same instants (exposure, contrast, saturation, warmth) and multiplies that clip's
# grade so the two get closer. Prints the global closeness score before the change.
#   python color_match_shots.py <copy.mp4> <ref.mp4> <plan.json> [ref_from] [strength]
import json
import sys

import cv2
import numpy as np

copy, ref, plan_path = sys.argv[1:4]
ref_from = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
strength = float(sys.argv[5]) if len(sys.argv) > 5 else 0.7
plan = json.load(open(plan_path, encoding="utf-8"))


def reader(path):
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    return cap, fps


def frame_stats(cap, fps, t):
    cap.set(cv2.CAP_PROP_POS_FRAMES, int(round(t * fps)))
    ok, f = cap.read()
    if not ok:
        return None
    f = cv2.resize(f, (90, 160))
    lab = cv2.cvtColor(f, cv2.COLOR_BGR2LAB).astype(np.float32)
    hsv = cv2.cvtColor(f, cv2.COLOR_BGR2HSV).astype(np.float32)
    L = lab[..., 0] * 100 / 255
    return np.array([L.mean(), L.std(), hsv[..., 1].mean() / 255, lab[..., 2].mean() - 128])


cc, cf = reader(copy)
rc, rf = reader(ref)
t = 0.0
allc, allr = [], []
for clip in plan["clips"]:
    dur = (clip["end"] - clip["start"]) / clip.get("speed", 1)
    ts = np.linspace(t + dur * 0.2, t + dur * 0.8, 3)
    c = [s for s in (frame_stats(cc, cf, x) for x in ts) if s is not None]
    r = [s for s in (frame_stats(rc, rf, ref_from + x) for x in ts) if s is not None]
    t += dur
    if not c or not r:
        continue
    c, r = np.mean(c, 0), np.mean(r, 0)
    allc.append(c)
    allr.append(r)
    g = clip.setdefault("grade", {})
    k = strength
    g["brightness"] = round(g.get("brightness", 1) * float(np.clip((r[0] / max(c[0], 1)) ** k, 0.7, 1.4)), 3)
    g["contrast"] = round(g.get("contrast", 1) * float(np.clip((r[1] / max(c[1], 1)) ** k, 0.75, 1.35)), 3)
    g["saturate"] = round(g.get("saturate", 1) * float(np.clip((r[2] / max(c[2], 0.01)) ** k, 0.6, 1.6)), 3)
    warm = (r[3] - c[3]) * k
    if abs(warm) > 2:
        a = min(0.25, abs(warm) / 35)
        g["tint"] = f"rgba(255,150,40,{a:.2f})" if warm > 0 else f"rgba(40,120,255,{a:.2f})"
        g["tintBlend"] = "soft-light"
    else:
        g.pop("tint", None)
        g.pop("tintBlend", None)

C, R = np.array(allc), np.array(allr)
# Per-shot distance, averaged: 0 = each shot looks like its reference shot.
d = (abs(C[:, 0] - R[:, 0]) / 6 + abs(C[:, 1] - R[:, 1]) / 5 + abs(C[:, 2] - R[:, 2]) / 0.12 + abs(C[:, 3] - R[:, 3]) / 6).mean()
print(json.dumps({"shotColorMatch": round(float(max(0, 10 - 2 * d)), 1)}))
plan["version"] = plan.get("version", 1) + 1
json.dump(plan, open(plan_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"plan updated to v{plan['version']}")

# Measures what the edit generator needs to chain clips smoothly:
# average colour, brightness, camera motion (direction and strength).
#   python features.py <clip.mp4>...      -> prints one JSON object per line
import json
import sys
from pathlib import Path

import cv2
import numpy as np

for path in sys.argv[1:]:
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    idx = np.linspace(0, max(0, n - 2), min(8, max(2, n - 1))).astype(int)
    flows, labs, first_lab, last_lab = [], [], None, None
    for i in idx:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(i))
        ok, a = cap.read()
        ok2, b = cap.read()
        if not (ok and ok2):
            continue
        sa = cv2.resize(a, (90, 160))
        sb = cv2.resize(b, (90, 160))
        ga, gb = (cv2.cvtColor(x, cv2.COLOR_BGR2GRAY) for x in (sa, sb))
        f = cv2.calcOpticalFlowFarneback(ga, gb, None, 0.5, 3, 15, 3, 5, 1.2, 0)
        flows.append(f.reshape(-1, 2).mean(0))
        lab = cv2.cvtColor(sa, cv2.COLOR_BGR2LAB).reshape(-1, 3).mean(0)
        labs.append(lab)
        first_lab = lab if first_lab is None else first_lab
        last_lab = lab
    cap.release()
    fl = np.array(flows) if flows else np.zeros((1, 2))
    dx, dy = fl.mean(0) * fps / 90  # screen widths per second, x and y
    lab = np.array(labs).mean(0) if labs else np.zeros(3)
    print(json.dumps({
        "file": Path(path).name,
        "duration": round(n / fps, 2),
        "orientation": "vertical" if H > W else "horizontal",
        "brightness": round(float(lab[0]) / 255, 3),
        "lab": [round(float(v), 1) for v in lab],
        "lab_first": [round(float(v), 1) for v in (first_lab if first_lab is not None else lab)],
        "lab_last": [round(float(v), 1) for v in (last_lab if last_lab is not None else lab)],
        "motion": [round(float(dx), 3), round(float(dy), 3)],
        "motion_strength": round(float(np.hypot(dx, dy)), 3),
    }), flush=True)

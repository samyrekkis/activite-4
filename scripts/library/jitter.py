# Camera shake of clips: mean distance between the frame-to-frame global motion
# and its moving average (a smooth travelling scores low, a shaky hand high).
#   python jitter.py <clip.mp4>...   -> one "<path> <jitter>" line per clip
import sys

import cv2
import numpy as np

for p in sys.argv[1:]:
    cap = cv2.VideoCapture(p)
    prev, d = None, []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        g = cv2.cvtColor(cv2.resize(f, (135, 240)), cv2.COLOR_BGR2GRAY)
        if prev is not None:
            d.append(cv2.calcOpticalFlowFarneback(prev, g, None, 0.5, 3, 15, 3, 5, 1.2, 0).reshape(-1, 2).mean(0))
        prev = g
    d = np.array(d)
    sm = np.array([d[max(0, i - 4): i + 5].mean(0) for i in range(len(d))])
    print(p, round(float(np.linalg.norm(d - sm, axis=1).mean()), 4))

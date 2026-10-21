# Apparent zoom of video segments: scale between the first and last frame of each
# segment (ORB features + similarity transform), > 1 = zooming in / pushing in.
#   python shot_zoom.py <video> <crop w:h:x:y | -> <t0,t1> [<t0,t1> ...]   -> JSON list
import json
import sys

import cv2
import numpy as np

path, crop = sys.argv[1], sys.argv[2]
segs = [tuple(map(float, a.split(","))) for a in sys.argv[3:]]
box = None if crop == "-" else [int(x) for x in crop.split(":")]
cap = cv2.VideoCapture(path)
fps = cap.get(cv2.CAP_PROP_FPS) or 30
orb = cv2.ORB_create(800)
bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)


def grab(t):
    cap.set(cv2.CAP_PROP_POS_FRAMES, max(0, int(round(t * fps))))
    ok, f = cap.read()
    if not ok:
        return None
    if box:
        w, h, x, y = box
        f = f[y:y + h, x:x + w]
    f = cv2.resize(f, (270, 480))
    return cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)


out = []
for t0, t1 in segs:
    d = t1 - t0
    a, b = grab(t0 + min(0.05, d * 0.15)), grab(t1 - min(0.05, d * 0.15))
    scale = 1.0
    if a is not None and b is not None:
        ka, da = orb.detectAndCompute(a, None)
        kb, db = orb.detectAndCompute(b, None)
        if da is not None and db is not None and len(ka) > 12 and len(kb) > 12:
            m = bf.match(da, db)
            if len(m) > 12:
                pa = np.float32([ka[x.queryIdx].pt for x in m])
                pb = np.float32([kb[x.trainIdx].pt for x in m])
                M, inl = cv2.estimateAffinePartial2D(pa, pb, method=cv2.RANSAC, ransacReprojThreshold=4)
                if M is not None and inl is not None and inl.sum() > 10:
                    scale = float(np.hypot(M[0, 0], M[1, 0]))
    out.append(round(float(np.clip(scale, 0.6, 1.6)), 3))
print(json.dumps(out))

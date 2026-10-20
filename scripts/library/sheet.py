# Contact sheet of images, each labelled with its file name (without extension).
#   python sheet.py <out.jpg> <cols> <thumb_height> <image>...
import sys
from pathlib import Path

import cv2
import numpy as np

out, cols, th = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
files = sys.argv[4:]
tw = th * 9 // 16
label_h = 26
cells = []
for f in files:
    im = cv2.imdecode(np.fromfile(f, np.uint8), cv2.IMREAD_COLOR)
    if im is None:
        continue
    h, w = im.shape[:2]
    s = min(tw / w, th / h)
    im = cv2.resize(im, (int(w * s), int(h * s)))
    cell = np.full((th + label_h, tw, 3), 255, np.uint8)
    y, x = label_h + (th - im.shape[0]) // 2, (tw - im.shape[1]) // 2
    cell[y:y + im.shape[0], x:x + im.shape[1]] = im
    cv2.putText(cell, Path(f).stem[:24], (3, 19), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA)
    cells.append(cell)
while len(cells) % cols:
    cells.append(np.full_like(cells[0], 255))
rows = [np.hstack(cells[i:i + cols]) for i in range(0, len(cells), cols)]
cv2.imencode(".jpg", np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 88])[1].tofile(out)

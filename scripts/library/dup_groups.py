# Groups near-duplicate clips (the same scene cut from several reels) by comparing three
# small frames of each clip; a video must never use two clips of the same group.
#   python dup_groups.py <restaurant>   -> public/library/<restaurant>/dups.json {clip: group}
import json, subprocess, sys
import numpy as np
resto = sys.argv[1]
cat = json.load(open(f"public/library/{resto}/catalogue.json", encoding="utf8"))["clips"]
feats = {}
for m in cat:
    fr = []
    for t in (0.15, 0.5, 0.85):
        raw = subprocess.run(["ffmpeg", "-v", "error", "-nostdin", "-ss", str(m["duration"] * t), "-i", f"public/library/{resto}/clips/{m['id']}.mp4",
                              "-frames:v", "1", "-vf", "scale=24:42,format=rgb24", "-f", "rawvideo", "-"], capture_output=True).stdout
        if len(raw) == 24 * 42 * 3:
            a = np.frombuffer(raw, np.uint8).astype(np.float32).reshape(42, 24, 3)
            a = (a - a.mean()) / (a.std() + 1e-6)
            fr.append(a.ravel())
    if fr: feats[m["id"]] = fr
ids = list(feats)
parent = {i: i for i in ids}
def find(x):
    while parent[x] != x: parent[x] = parent[parent[x]]; x = parent[x]
    return x
for a in range(len(ids)):
    for b in range(a + 1, len(ids)):
        s = max(float(np.dot(x, y) / len(x)) for x in feats[ids[a]] for y in feats[ids[b]])
        if s > float(sys.argv[2] if len(sys.argv) > 2 else 0.75): parent[find(ids[a])] = find(ids[b])
groups = {i: find(i) for i in ids}
json.dump(groups, open(f"public/library/{resto}/dups.json", "w"), indent=0)
sizes = {}
for g in groups.values(): sizes[g] = sizes.get(g, 0) + 1
print(resto, len(ids), "clips,", sum(1 for s in sizes.values() if s > 1), "groupes de doublons,", sum(s for s in sizes.values() if s > 1), "clips concernés")

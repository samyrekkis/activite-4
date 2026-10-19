# Files the extracted clips under readable names and builds the catalogue used
# by the edit generator.
#   python build_library.py <resto> <work_dir> <names.json> <studio_resto_dir>
#
# names.json: { "<CLIP>": {"name": "...", "category": "...", "view": "...",
#               "light": "jour|nuit", "quality": 0-3, "photo": true|false}, ... }
#   quality 0 = clip discarded; "photo": false = the still is not worth keeping.
# Writes:
#   public/library/<resto>/clips/<ID>.mp4 + catalogue.json   (for Remotion)
#   <studio>/<Resto>/Clips bruts/<Catégorie> - <name>.mp4   (for the user)
#   <studio>/<Resto>/Photos extraites/<Catégorie> - <name>.jpg
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

resto, work, names_file, studio = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4])
FOLDER = {"monegasque": "Monegasque", "samourai": "Samourai"}[resto]
PREFIX = {"monegasque": "MON", "samourai": "SAM"}[resto]
LABEL = {
    "plat": "Plat", "dessert": "Dessert", "boisson": "Boisson", "table": "Table", "geste": "Geste",
    "salle": "Salle", "deco": "Déco", "exterieur": "Extérieur", "cuisine": "Cuisine", "personnes": "Ambiance",
}

names = json.loads(names_file.read_text(encoding="utf-8"))
reports = {r["clip"]: r for f in work.glob("*.json") for r in json.loads(f.read_text(encoding="utf-8"))}
lib = Path(f"public/library/{resto}/clips")
lib.mkdir(parents=True, exist_ok=True)
clips_dir = studio / FOLDER / "Clips bruts"
photos_dir = studio / FOLDER / "Photos extraites"
clips_dir.mkdir(parents=True, exist_ok=True)
photos_dir.mkdir(parents=True, exist_ok=True)


def safe(s):
    return re.sub(r'[<>:"/\\|?*]', "", s).strip()


taken = set()
entries = []
kept = sorted((k for k, v in names.items() if v.get("quality", 2) > 0 and k in reports))
for n, key in enumerate(kept, 1):
    meta = names[key]
    cid = f"{PREFIX}-{n:03d}"
    shutil.copy2(work / f"{key}.mp4", lib / f"{cid}.mp4")
    base = safe(f"{LABEL.get(meta['category'], meta['category'].title())} - {meta['name']}")
    readable, i = base, 2
    while readable.lower() in taken:
        readable, i = f"{base} ({i})", i + 1
    taken.add(readable.lower())
    shutil.copy2(work / f"{key}.mp4", clips_dir / f"{readable}.mp4")
    if meta.get("photo", True) and (work / f"{key}.jpg").exists():
        shutil.copy2(work / f"{key}.jpg", photos_dir / f"{readable}.jpg")
    entries.append({"id": cid, "src": f"library/{resto}/clips/{cid}.mp4", "file": f"{readable}.mp4",
                    "source": reports[key]["source"], "extract": key, **meta})

# Colour and motion, measured on the clips themselves.
feats = subprocess.run([sys.executable, str(Path(__file__).with_name("features.py")),
                        *[str(lib / f"{e['id']}.mp4") for e in entries]],
                       capture_output=True, text=True, check=True).stdout.splitlines()
by_file = {json.loads(l)["file"]: json.loads(l) for l in feats if l.strip()}
for e in entries:
    f = by_file[f"{e['id']}.mp4"]
    e.update({k: f[k] for k in ("duration", "orientation", "brightness", "lab", "lab_first", "lab_last", "motion", "motion_strength")})

Path(f"public/library/{resto}/catalogue.json").write_text(
    json.dumps({"restaurant": resto, "clips": entries}, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"{resto} : {len(entries)} clips rangés, {sum(1 for e in entries if e.get('photo', True))} photos.")

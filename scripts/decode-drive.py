# Decode a Drive connector download (JSON {content: base64, title}) into a file.
# Usage: python3 scripts/decode-drive.py <tool-result.txt> <out-dir>
import base64, json, os, sys

src, out_dir = sys.argv[1], sys.argv[2]
with open(src) as f:
    data = json.load(f)
os.makedirs(out_dir, exist_ok=True)
path = os.path.join(out_dir, data["title"])
with open(path, "wb") as f:
    f.write(base64.b64decode(data["content"]))
print(path, os.path.getsize(path))

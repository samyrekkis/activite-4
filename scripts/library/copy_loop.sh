#!/usr/bin/env bash
# Colour loop for a copy of a reference edit: render, measure, correct, re-render.
# Keeps the best-scoring version in out/<name>-best.mp4 (score in out/<name>-best.txt).
#   [CROP=w:h:x:y] bash scripts/library/copy_loop.sh <plan.json> <ref.mp4> <from> <to> [passes=3] [band0 band1]
cd "$(dirname "$0")/../.."
P=$1; REF=$2; FROM=$3; TO=$4; N=${5:-3}; B0=${6:-0}; B1=${7:-1}
# Renders are slow on this PC: two passes (measure + one correction) are enough.
[ "$N" -gt "${MAX_PASSES:-2}" ] && N=${MAX_PASSES:-2}
CROP=${CROP:+--crop $CROP}
PY="${PYTHON:-/c/Users/hp/.studioresto/venv/Scripts/python.exe}"
name=$(basename "$P" .json)
best=-1
# Never deliver a stale best from an earlier run.
rm -f "out/$name-best.mp4" "out/$name-best.txt"
for i in $(seq "$N"); do
  v=$(node -p "require('./$P').version")
  vid="out/$name-v$v.mp4"
  for try in 1 2 3; do
    [ -s "$vid" ] && break
    node scripts/render.mjs "$P" > "out/$name.render.txt" 2>&1
    [ -s "$vid" ] || { taskkill //F //IM chrome-headless-shell.exe >/dev/null 2>&1; sleep 5; }
  done
  [ -s "$vid" ] || { echo "$name v$v RENDER_FAIL"; continue; }
  s=$("$PY" scripts/library/color_match.py "$vid" "$REF" "$FROM" "$TO" --band "$B0" "$B1" $CROP | grep -o '"colorMatch": [0-9.]*' | grep -o '[0-9.]*$')
  echo "$name v$v colour $s"
  if awk "BEGIN{exit !($s > $best)}"; then best=$s; cp "$vid" "out/$name-best.mp4"; echo "v$v $s" > "out/$name-best.txt"; fi
  [ "$i" -lt "$N" ] && "$PY" scripts/library/color_match.py "$vid" "$REF" "$FROM" "$TO" --band "$B0" "$B1" $CROP --apply "$P" > /dev/null
done
[ -s "out/$name-best.mp4" ] && echo "BEST $(cat out/$name-best.txt)" || { echo "NO_RENDER $name"; exit 1; }

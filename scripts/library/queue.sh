#!/usr/bin/env bash
# Renders and reviews plans one after another (never two Chrome renders at once).
#   bash scripts/library/queue.sh edits/reels/a.json edits/stories/b.json ...
# Each plan: out/<name>-v<N>.mp4 + review in out/reviews/<name>-v<N>.txt; a line per plan in out/queue.log.
# Score >= 8.8 -> copied to "Studio Resto/Montages/<Reels|Stories>".
cd "$(dirname "$0")/../.."
STUDIO="/c/Users/hp/OneDrive/Bureau/Studio Resto/Montages"
mkdir -p out/reviews
for plan in "$@"; do
  name=$(basename "$plan" .json)
  v=$(node -p "require('./$plan').version")
  vid="out/$name-v$v.mp4"
  rev="out/reviews/$name-v$v.txt"
  for try in 1 2; do
    node scripts/render.mjs "$plan" > "out/reviews/$name-v$v.render.txt" 2>&1 && [ -s "$vid" ] && break
    taskkill //F //IM chrome-headless-shell.exe >/dev/null 2>&1
  done
  [ -s "$vid" ] || { echo "$name v$v RENDER_FAIL" >> out/queue.log; continue; }
  node scripts/gemini-review.mjs "$vid" "$plan" > "$rev" 2>&1
  score=$(grep -m1 -oE "^Note : [0-9.]+" "$rev" | grep -oE "[0-9.]+$")
  fl=$(grep -m1 -oE "^Fluidité : [0-9.]+" "$rev" | grep -oE "[0-9.]+$")
  co=$(grep -m1 -oE "^Couleur : [0-9.]+" "$rev" | grep -oE "[0-9.]+$")
  echo "$name v$v score=$score fluidite=$fl couleur=$co" >> out/queue.log
  if [ -n "$score" ] && awk "BEGIN{exit !($score >= 8.8)}"; then
    case "$plan" in *stories*) dest="$STUDIO/Stories";; *) dest="$STUDIO/Reels";; esac
    mkdir -p "$dest" && cp "$vid" "$dest/$name.mp4"
    echo "$name v$v LIVRE" >> out/queue.log
  fi
done
echo "QUEUE_DONE $*" >> out/queue.log

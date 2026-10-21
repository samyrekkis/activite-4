#!/usr/bin/env bash
# Rebuilds copies of reference edits end to end: plan (cuts + zooms), colour loop, delivery
# with the song. One line per copy: "<name>|<ref file>|<from>|<to>|<title>|<crop or ->"
#   bash scripts/library/run_copies.sh < list.txt
cd "$(dirname "$0")/../.."
R="/c/Users/hp/OneDrive/Bureau/Studio Resto/Exemples/Edits a suivre"
while IFS="|" read -r name ref from to title crop; do
  [ -z "$name" ] && continue
  node scripts/library/ref-plan.mjs "edits/specs/copies/$name.json"
  if [ "$crop" = "-" ]; then
    bash scripts/library/copy_loop.sh "edits/copies/$name.json" "$R/$ref" "$from" "$to" 3 0.4 1
  else
    CROP=$crop bash scripts/library/copy_loop.sh "edits/copies/$name.json" "$R/$ref" "$from" "$to" 3
  fi
  bash scripts/library/make_preview.sh "out/$name-best.mp4" "$R/$ref" "$from" "$title"
done
echo RUN_COPIES_DONE

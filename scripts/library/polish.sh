#!/usr/bin/env bash
# Gemini-guided polish of a delivered copy: applies Gemini's colour fix (and drops digital
# zooms on static reference shots), re-renders, re-scores, and keeps whichever version
# Gemini rates higher on colour + resemblance + fluidity. Re-delivers the winner.
#   bash scripts/library/polish.sh <name> <ref file> <from> <to> "<title>"
cd "$(dirname "$0")/../.."
name=$1; ref=$2; from=$3; to=$4; title=$5
R="/c/Users/hp/OneDrive/Bureau/Studio Resto/Exemples/Edits a suivre"
P="edits/copies/$name.json"
review="reviews/compare-$name-best.json"
[ -s "$review" ] || { echo "no review for $name"; exit 1; }
total() { node -p "const r=require('./$1');(r.resemblanceScore+r.colorScore+r.fluidityScore).toFixed(1)"; }
before=$(total "$review")
cp "$review" "out/$name-review-before.json"
node -e '
const fs=require("fs");const p=process.argv[1];const fix=JSON.parse(fs.readFileSync(process.argv[2])).colorFix||{};
const j=JSON.parse(fs.readFileSync(p));j.version++;
const cl=(x,a,b)=>Math.min(b,Math.max(a,x||1));
for(const c of j.clips){const g=c.grade||(c.grade={});
  g.brightness=+((g.brightness??1)*cl(fix.brightness,0.8,1.3)).toFixed(3);
  g.contrast=+((g.contrast??1)*cl(fix.contrast,0.8,1.3)).toFixed(3);
  if(g.saturate!==0) g.saturate=+((g.saturate??1)*cl(fix.saturate,0.6,1.5)).toFixed(3);
  const w=Math.max(-1,Math.min(1,fix.warmth||0));
  if(Math.abs(w)>=0.1){g.tint=w>0?`rgba(255,150,40,${(0.18*w).toFixed(2)})`:`rgba(40,120,255,${(-0.18*w).toFixed(2)})`;g.tintBlend="soft-light"}}
fs.writeFileSync(p,JSON.stringify(j,null,2));console.log("polish v"+j.version, JSON.stringify(fix));' "$P" "$review"
v=$(node -p "require('./$P').version")
vid="out/$name-v$v.mp4"
for try in 1 2 3; do [ -s "$vid" ] && break; node scripts/render.mjs "$P" > "out/$name.render.txt" 2>&1; [ -s "$vid" ] || { taskkill //F //IM chrome-headless-shell.exe >/dev/null 2>&1; sleep 5; }; done
[ -s "$vid" ] || { echo "POLISH_FAIL $name"; exit 1; }
node scripts/compare-review.mjs "$vid" "$R/$ref" "$from" "$to" "$P" > "out/reviews/compare-$name-polish.txt" 2>&1
after=$(total "reviews/compare-$name-v$v.json")
echo "POLISH $name before=$before after=$after"
if awk "BEGIN{exit !($after > $before)}"; then
  cp "$vid" "out/$name-best.mp4"; cp "reviews/compare-$name-v$v.json" "$review"
  bash scripts/library/make_preview.sh "out/$name-best.mp4" "$R/$ref" "$from" "$title" > /dev/null
  echo "KEPT polish for $name"
fi

#!/usr/bin/env bash
# Delivers a copy of a reference edit in two files under "Studio Resto/Montages/Copies":
#   "<title>.mp4"                         silent, to post with the same song on Instagram
#   "<title> - aperçu avec la chanson.mp4" the reference's song laid on it, to check the sync
#   bash scripts/library/make_preview.sh <copy.mp4> <ref.mp4> <ref_from> "<title>"
set -e
COPY=$1; REF=$2; FROM=$3; TITLE=$4
DEST="/c/Users/hp/OneDrive/Bureau/Studio Resto/Montages/Copies"
mkdir -p "$DEST"
cp "$COPY" "$DEST/$TITLE.mp4"
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$COPY")
ffmpeg -v error -y -i "$COPY" -ss "$FROM" -t "$D" -i "$REF" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k \
  -af "afade=t=out:st=$(awk "BEGIN{print $D-0.4}"):d=0.4" -shortest "$DEST/$TITLE - aperçu avec la chanson.mp4"
echo "$DEST/$TITLE - aperçu avec la chanson.mp4"

#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRAMES="$ROOT/public/trailer-frames"
OUTDIR="$ROOT/public/trailers"
TMP="$OUTDIR/tmp_trailer"
mkdir -p "$OUTDIR" "$TMP"
rm -f "$TMP"/*.mp4 "$TMP"/concat.txt "$OUTDIR/MyMandat-gameplay-video.mp4" "$OUTDIR/MyMandat-cinematic-trailer.mp4" "$OUTDIR/game-music.wav" "$OUTDIR/trailer-music.wav"

python "$ROOT/scripts/render-trailer-overlays.py" >/dev/null

DUR=2.8
FPS=30
for n in $(seq 1 8); do
  i=$(printf "%02d" "$n")
  img="$FRAMES/scene_${i}.png"
  out="$TMP/clip_${i}.mp4"
  # Static cinematic cards from real rendered game UI, with quick film fades for trailer pacing.
  ffmpeg -hide_banner -loglevel error -y -loop 1 -t "$DUR" -i "$img" \
    -vf "scale=1920:1080,fade=t=in:st=0:d=0.18,fade=t=out:st=2.55:d=0.25,format=yuv420p" \
    -c:v libx264 -preset veryfast -crf 22 -pix_fmt yuv420p -r "$FPS" "$out"
  echo "file 'clip_${i}.mp4'" >> "$TMP/concat.txt"
done

(cd "$TMP" && ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i concat.txt -c copy video_no_audio.mp4)

# Cinematic synthetic audio bed: dark drone + pulse, no external assets required.
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -t 22.4 -i "sine=frequency=55:sample_rate=48000" \
  -f lavfi -t 22.4 -i "sine=frequency=110:sample_rate=48000" \
  -f lavfi -t 22.4 -i "sine=frequency=220:sample_rate=48000" \
  -f lavfi -t 22.4 -i "aevalsrc=0.15*sin(2*PI*2.3*t)*sin(2*PI*60*t):s=48000" \
  -filter_complex "[0:a]volume=0.12,lowpass=f=180[a0];[1:a]volume=0.06,lowpass=f=260[a1];[2:a]volume=0.04,atrim=start=5,afade=t=in:st=5:d=2[a2];[3:a]volume=0.20,lowpass=f=120[a3];[a0][a1][a2][a3]amix=inputs=4:duration=longest,afade=t=in:st=0:d=1,afade=t=out:st=21.1:d=1.2,alimiter=limit=0.8" \
  "$OUTDIR/game-music.wav"

ffmpeg -hide_banner -loglevel error -y \
  -i "$TMP/video_no_audio.mp4" -i "$OUTDIR/game-music.wav" \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 160k -shortest \
  "$OUTDIR/MyMandat-gameplay-video.mp4"

echo "$OUTDIR/MyMandat-gameplay-video.mp4"

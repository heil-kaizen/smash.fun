#!/usr/bin/env bash
# Launch MEME SMASH locally and open it in the browser.
set -e
cd "$(dirname "$0")"
PORT="${1:-8080}"
echo "Serving MEME SMASH at http://127.0.0.1:$PORT"
( sleep 1; open "http://127.0.0.1:$PORT/index.html" 2>/dev/null || true ) &
python3 -m http.server "$PORT" --bind 127.0.0.1

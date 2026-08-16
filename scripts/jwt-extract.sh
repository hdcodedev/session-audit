#!/usr/bin/env bash
# jwt-extract.sh - extract every JWT (eyJ...eyJ.../sig) from the session
# exports into one JSON file (deduped, with the source session file).
# Usage:
#   ./jwt-extract.sh [DIR] [OUT]
#     DIR : folder with exported sessions (default ~/kilo-cloud-export)
#     OUT : json output (default <DIR>/leak-reports/jwt_tokens.json)
set -uo pipefail

DIR="${1:-$HOME/kilo-cloud-export}"
OUT="${2:-$DIR/leak-reports/jwt_tokens.json}"

if ! command -v rg >/dev/null 2>&1; then echo "ripgrep (rg) required" >&2; exit 1; fi
mkdir -p "$(dirname "$OUT")"

rg -No --color=never -g '*.json' -e 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' "$DIR" 2>/dev/null \
| awk -F':' '
    BEGIN { print "{\"tokens\": [" }
    { f=$1; sub(/.*\//, "", f); m=$0; sub(/^[^:]*:/, "", m);
      if (m in seen) next; seen[m]=1;
      if (n>0) printf ",\n";
      printf "  {\"token\": \"%s\", \"source\": \"%s\"}", m, f;
      n++ }
    END { print ""; print "],"; print "\"count\": " n; print "}" }' > "$OUT"

echo "Extracted $(grep -o '"token"' "$OUT" | wc -l | tr -d ' ') unique JWTs -> $OUT"

#!/usr/bin/env bash
# jwt-decode.sh - decode a JWT (eyJ...eyJ...sig) and show header + payload.
# Fully offline: just base64url-decodes the first two segments.
# Usage:
#   ./jwt-decode.sh <jwt>
#   echo "<jwt>" | ./jwt-decode.sh
set -uo pipefail

raw="${1:-$(cat)}"
tok="$(printf '%s' "$raw" | grep -oE 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' | head -1)"

if [ -z "$tok" ]; then
  echo "No JWT found in input." >&2
  echo "Usage: $0 <jwt>" >&2
  exit 1
fi

b64d() {
  if [ "$(uname)" = "Darwin" ]; then base64 -D 2>/dev/null; else base64 -d 2>/dev/null; fi
}
decode_segment() {
  local s="$1"
  s="${s//-/+}"
  s="${s//_//}"
  case $(( ${#s} % 4 )) in
    2) s="${s}==" ;;
    3) s="${s}=" ;;
  esac
  printf '%s' "$s" | b64d
}
pp() {
  if command -v jq >/dev/null 2>&1; then jq . 2>/dev/null || cat; else cat; fi
}

IFS='.' read -r h p s <<< "$tok"

echo "=== HEADER ==="
decode_segment "$h" | pp
echo
echo "=== PAYLOAD ==="
decode_segment "$p" | pp
echo

exp="$(decode_segment "$p" | grep -o '"exp"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]\+')"
if [ -n "$exp" ]; then
  if [ "$(uname)" = "Darwin" ]; then hum="$(date -r "$exp" '+%Y-%m-%d %H:%M:%S %Z' 2>/dev/null)"; else hum="$(date -d "@$exp" '+%Y-%m-%d %H:%M:%S %Z' 2>/dev/null)"; fi
  now="$(date +%s)"
  if [ "$exp" -lt "$now" ]; then st="EXPIRED"; else st="still valid"; fi
  echo "exp: $exp  ($hum)  -> $st"
else
  echo "exp: <not present in payload>"
fi

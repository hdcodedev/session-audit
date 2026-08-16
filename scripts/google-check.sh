#!/usr/bin/env bash
# google-check.sh - check if a Google API key (AIza...) is live, and which API.
# Note: a Google API key cannot be attributed to a user/account from the key
# string alone - this only reports validity + which APIs accept it.
# Usage:
#   ./google-check.sh <google-api-key>
#   echo "<key>" | ./google-check.sh
set -uo pipefail

key="${1:-}"
if [ -z "$key" ]; then key="$(cat)"; fi
key="$(printf '%s' "$key" | tr -d '[:space:]')"

if [ -z "$key" ]; then
  echo "Usage: $0 <google-api-key>" >&2
  exit 1
fi

echo "Key: ${key:0:12}... (${#key} chars)"

endpoints=(
  "Gemini:   https://generativelanguage.googleapis.com/v1beta/models?key="
  "Translate:https://translation.googleapis.com/language/translate/v2?q=hi&target=es&format=text&key="
  "Maps:     https://maps.googleapis.com/maps/api/geocode/json?address=test&key="
  "YouTube:  https://www.googleapis.com/youtube/v3/videos?part=snippet&id=dQw4w9WgXcQ&key="
)

valid=0; invalid=0; restricted=0; live_api=""
declare -a notes

for entry in "${endpoints[@]}"; do
  name="${entry%%:*}"; url="${entry#*:}${key}"
  resp="$(curl -s -w '\n%{http_code}' --max-time 15 "$url")"
  code="$(printf '%s' "$resp" | tail -1)"
  body="$(printf '%s' "$resp" | sed '$d')"
  msg="$(printf '%s' "$body" | grep -m1 -o '"message"[[:space:]]*:[[:space:]]*"[^"]*"' | sed -E 's/.*"message"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/')"

  if [ "$code" = "200" ]; then
    valid=1; live_api="$name"
    notes+=("[$name] HTTP 200 -> VALID (accepted by $name)")
  elif printf '%s' "$body" | grep -qi 'api key not valid'; then
    invalid=1
    notes+=("[$name] HTTP $code -> INVALID: ${msg:-API key not valid}")
  else
    restricted=1
    notes+=("[$name] HTTP $code -> ${msg:-restricted / API not enabled for this key}")
  fi
done

echo
for n in "${notes[@]}"; do echo "  $n"; done
echo
if [ "$invalid" = "1" ]; then
  echo "STATUS: INVALID / REVOKED / DEAD"
elif [ "$valid" = "1" ]; then
  echo "STATUS: VALID (live) - accepted by: $live_api"
elif [ "$restricted" = "1" ]; then
  echo "STATUS: VALID but RESTRICTED (key exists; not enabled for the tested APIs)"
else
  echo "STATUS: UNKNOWN (no response)"
fi

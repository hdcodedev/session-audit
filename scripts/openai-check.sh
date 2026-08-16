#!/usr/bin/env bash
# openai-check.sh - check if an OpenAI API key (sk-...) is live.
# Usage:
#   ./openai-check.sh <openai-key>
#   echo "<key>" | ./openai-check.sh
set -uo pipefail

key="${1:-}"
if [ -z "$key" ]; then key="$(cat)"; fi
key="$(printf '%s' "$key" | tr -d '[:space:]')"

if [ -z "$key" ]; then
  echo "Usage: $0 <openai-key>" >&2
  exit 1
fi

echo "Key: ${key:0:12}... (${#key} chars)"

resp="$(curl -s -w '\n%{http_code}' --max-time 15 -H "Authorization: Bearer $key" https://api.openai.com/v1/models)"
code="$(printf '%s' "$resp" | tail -1)"
body="$(printf '%s' "$resp" | sed '$d')"

echo "HTTP $code"
if [ "$code" = "200" ]; then
  echo "STATUS: VALID (live)"
  org="$(printf '%s' "$body" | grep -m1 '"org"'); "
  n="$(printf '%s' "$body" | grep -o '"id"' | wc -l | tr -d ' ')"
  echo "models returned: $n"
elif [ "$code" = "401" ]; then
  msg="$(printf '%s' "$body" | grep -m1 -o '"message"[[:space:]]*:[[:space:]]*"[^"]*"' | sed -E 's/.*"message"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/')"
  echo "STATUS: INVALID / EXPIRED / REVOKED"
  echo "  ${msg:-Bad credentials}"
else
  msg="$(printf '%s' "$body" | grep -m1 -o '"message"[[:space:]]*:[[:space:]]*"[^"]*"' | sed -E 's/.*"message"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/')"
  echo "STATUS: UNKNOWN (HTTP $code)"
  echo "  ${msg:-no message}"
fi

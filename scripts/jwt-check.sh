#!/usr/bin/env bash
# jwt-check.sh - decode every JWT in the extracted JSON and report validity.
# "Validity" = the exp claim vs now (offline decode only, NOT server-verified).
# Usage:
#   ./jwt-check.sh [JSON] [REPORT]
#     JSON   : file from jwt-extract.sh (default ~/kilo-cloud-export/leak-reports/jwt_tokens.json)
#     REPORT : output (default <dir>/leak-reports/jwt_status.txt)
set -uo pipefail

JSON="${1:-$HOME/kilo-cloud-export/leak-reports/jwt_tokens.json}"
REPORT="${2:-$(dirname "$JSON")/jwt_status.txt}"

if [ ! -f "$JSON" ]; then echo "JSON not found: $JSON (run jwt-extract.sh first)" >&2; exit 1; fi

b64d() { if [ "$(uname)" = "Darwin" ]; then base64 -D 2>/dev/null; else base64 -d 2>/dev/null; fi; }
decode_segment() {
  local s="$1"; s="${s//-/+}"; s="${s//_//}";
  case $(( ${#s} % 4 )) in 2) s="${s}==";; 3) s="${s}=";; esac
  printf '%s' "$s" | b64d
}

pairs="$(awk '{ if ($0 !~ /"token":/) next; t=$0; sub(/.*"token":[[:space:]]*"/,"",t); sub(/".*/,"",t); s=$0; sub(/.*"source":[[:space:]]*"/,"",s); sub(/".*/,"",s); print t "\t" s }' "$JSON")"

tmp="$(mktemp)"
now="$(date +%s)"
v=0; e=0; u=0; bad=0

while IFS=$'\t' read -r tok src; do
  [ -z "$tok" ] && continue
  p="$(IFS='.' read -r h pp s <<< "$tok"; decode_segment "$pp" 2>/dev/null)"
  if [ -z "$p" ]; then st="UNDECODABLE"; bad=$((bad+1)); hum="<n/a>";
  else
    exp="$(printf '%s' "$p" | grep -o '"exp"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]\+')"
    if [ -n "$exp" ]; then
      if [ "$exp" -lt "$now" ]; then st="EXPIRED"; e=$((e+1)); else st="VALID"; v=$((v+1)); fi
      if [ "$(uname)" = "Darwin" ]; then hum="$(date -r "$exp" '+%Y-%m-%d %H:%M:%S' 2>/dev/null)"; else hum="$(date -d "@$exp" '+%Y-%m-%d %H:%M:%S' 2>/dev/null)"; fi
    else st="NO_EXP"; u=$((u+1)); hum="<none>"; fi
  fi
  printf '%-12s | %-26s | %s | %s\n' "$st" "${tok:0:26}" "$hum" "$src" >> "$tmp"
done <<< "$pairs"

{
  echo "JWT validity report (expiry-based; decoded offline, NOT server-verified)"
  echo "Generated: $(date)"
  echo "Source: $JSON"
  echo "VALID (not expired): $v | EXPIRED: $e | NO_EXP: $u | UNDECODABLE: $bad"
  echo
  printf '%-12s | %-26s | %s | %s\n' "STATUS" "TOKEN(prefix)" "EXP" "SOURCE"
  echo "-------------------------------------------------------------------------------"
  cat "$tmp"
} | tee "$REPORT"
rm -f "$tmp"

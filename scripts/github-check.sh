#!/usr/bin/env bash
# github-check.sh - check if a GitHub token is valid, and show its user + scopes.
# Usage:
#   ./github-check.sh <token>
#   echo "<token>" | ./github-check.sh
#   cat token.txt | ./github-check.sh
set -uo pipefail

token="${1:-}"
if [ -z "$token" ]; then
  token="$(cat)"
fi
token="$(printf '%s' "$token" | tr -d '[:space:]')"

if [ -z "$token" ]; then
  echo "Usage: $0 <github-token>" >&2
  exit 1
fi

resp="$(curl -s -w '\n%{http_code}' -H "Authorization: Bearer $token" -H "Accept: application/vnd.github+json" https://api.github.com/user)"
code="$(printf '%s' "$resp" | tail -1)"
body="$(printf '%s' "$resp" | sed '$d')"

echo "HTTP $code"
if [ "$code" = "200" ]; then
  echo "STATUS: VALID"
  login="$(printf '%s' "$body"  | grep -m1 '"login"'        | sed -E 's/.*"login"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/')"
  name="$(printf  '%s' "$body"  | grep -m1 '"name"'         | sed -E 's/.*"name"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/')"
  email="$(printf '%s' "$body"  | grep -m1 '"email"'        | sed -E 's/.*"email"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/')"
  url="$(printf   '%s' "$body"  | grep -m1 '"html_url"'     | sed -E 's/.*"html_url"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/')"
  echo "login : ${login:-<unknown>}"
  echo "name  : ${name:-<unknown>}"
  echo "email : ${email:-<unknown>}"
  echo "url   : ${url:-<unknown>}"
else
  echo "STATUS: INVALID / EXPIRED / REVOKED"
  printf '%s' "$body" | head -c 300; echo
fi

scopes="$(curl -s -I -H "Authorization: Bearer $token" https://api.github.com/user \
          | tr -d '\r' | awk -F': ' 'tolower($1)=="x-oauth-scopes"{print $2}')"
echo "scopes: ${scopes:-<none/unknown>}"

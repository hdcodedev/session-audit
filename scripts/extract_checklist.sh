#!/usr/bin/env bash
#
# extract_checklist.sh - build a per-provider revocation checklist from the
# exported Kilo sessions. Each unique secret/key value becomes a tickable
# "[ ]" item grouped by provider, so you can work through revoking/rotating.
#
# Usage:
#   ./extract_checklist.sh [DIR] [OUT]
#     DIR : folder with exported sessions (default ~/kilo-cloud-export)
#     OUT : checklist file (default <DIR>/leak-reports/revoke_checklist.md)
#
# Values are extracted UNREDACTED from the session exports - keep the output
# file safe and delete it (and the export folder) when done.

set -uo pipefail

DIR="${1:-$HOME/kilo-cloud-export}"
OUT="${2:-$DIR/leak-reports/revoke_checklist.md}"

if [ ! -d "$DIR" ]; then echo "Directory not found: $DIR" >&2; exit 1; fi
if ! command -v rg >/dev/null 2>&1; then echo "ripgrep (rg) required: brew install ripgrep" >&2; exit 1; fi

mkdir -p "$(dirname "$OUT")"
: > "$OUT"

{
  echo "# Revocation checklist (by provider)"
  echo
  echo "Generated: $(date)"
  echo "Source: $DIR"
  echo
  echo "Tick each item as you revoke/rotate the credential at its provider."
  echo "Values are extracted UNREDACTED from the session exports - keep this file safe."
  echo
} > "$OUT"

while IFS= read -r line; do
  [ -z "$line" ] && continue
  label="${line%% ::: *}"
  pat="${line#* ::: }"; pat="${pat%% ::: *}"
  rg -No --color=never -g '*.json' -e "$pat" "$DIR" 2>/dev/null \
  | awk -v lbl="$label" '
      { m=$0; sub(/^[^:]*:/, "", m); if (m == "") next;
        key = lbl "\x1f" m;
        if (!(key in seen)) { seen[key]=1; out[lbl] = (out[lbl]=="" ? "" : out[lbl] "\n") m; cnt[lbl]++ } }
      END { if (cnt[lbl] > 0) {
              print "## " lbl " (" cnt[lbl] ")";
              n = split(out[lbl], a, "\n");
              for (i=1; i<=n; i++) print "  - [ ] " a[i];
              print "" } }
    ' >> "$OUT"
done <<'PATTERNS'
AWS Access Key ID ::: AKIA[0-9A-Z]{16}
AWS Secret Access Key ::: (?:secretAccessKey|aws_secret_access_key)["']?\s*[:=]\s*["']?[A-Za-z0-9/+=]{32,}["']?
Private Key Block ::: -----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP |ENCRYPTED )?PRIVATE KEY-----
PGP Private Key Block ::: -----BEGIN PGP PRIVATE KEY BLOCK-----
Google API Key ::: AIza[0-9A-Za-z_\-]{35}
Slack Token ::: xox[baprs]-[0-9A-Za-z\-]{10,}
Stripe Key ::: sk_(live|test)_[0-9a-zA-Z]{16,}|pk_(live|test)_[0-9a-zA-Z]{16,}
GitHub Token ::: gh[pousr]_[0-9A-Za-z]{36,}|github_pat_[0-9A-Za-z_]{50,}
GitLab Token ::: glpat-[0-9a-zA-Z_\-]{20,}
OpenAI API Key ::: sk-[0-9a-zA-Z]{20,}
Anthropic API Key ::: sk-ant-[0-9A-Za-z\-]{20,}
NPM Token ::: npm_[0-9A-Za-z]{36,}
JWT ::: eyJ[A-Za-z0-9_\-]{8,}\.eyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}
Bearer Token ::: Bearer\s+[A-Za-z0-9._\-]{12,}
Credentials in URL ::: ://[^\s:/]+:[^\s@/]+@
DB/Service Connection String ::: (?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp|ftp)://[^\s"'\)\]]+
Generic Secret/Password Assignment ::: (?:api[_-]?key|apikey|access[_-]?key|client[_-]?secret|private[_-]?key|secret|token|password|passwd|pwd|auth[_-]?token)["']?\s*[:=]\s*["']?[A-Za-z0-9+/=_\-]{12,}["']?
Email Address ::: [A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}
PATTERNS

echo "Checklist: $OUT"
echo "Total items: $(grep -cE '^[[:space:]]*- \[ \]' "$OUT" | tr -d ' ')"

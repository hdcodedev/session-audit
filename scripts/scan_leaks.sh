#!/usr/bin/env bash
#
# scan_leaks.sh - scan Kilo cloud session exports for leaked secrets/PII,
# grouped by PROJECT (info.projectID + info.directory).
#
# Usage:
#   ./scan_leaks.sh [DIR] [REPORT_DIR] [all]
#     DIR         : folder with exported sessions (default ~/kilo-cloud-export)
#     REPORT_DIR  : output folder (default <DIR>/leak-reports)
#     all         : pass literal "all" to also include noisy categories
#                   (plain URL references + sensitive-keyword context)
#
# Uses ripgrep (rg) for fast matching and awk for grouping. Findings per
# project/category are shown in full (UNREDACTED) so you can assess leaks.
# WARNING: the report contains plaintext secrets - delete it and the export
# folder when done reviewing.

set -uo pipefail

DIR="${1:-$HOME/kilo-cloud-export}"
OUT="${2:-$DIR/leak-reports}"
ALL="${3:-}"
NOISE="excluded (pass 3rd arg 'all' to include)"

if [ ! -d "$DIR" ]; then echo "Directory not found: $DIR" >&2; exit 1; fi
if ! command -v rg >/dev/null 2>&1; then echo "ripgrep (rg) required: brew install ripgrep" >&2; exit 1; fi

mkdir -p "$OUT"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# --- 1) Build basename -> (pid|dir) map from one fast rg pass ---
rg -No --color=never -g '*.json' -r '$1|$2' -e '"(projectID|directory)":"([^"]*)"' "$DIR" 2>/dev/null \
| awk -F'[:|]' '{
    f=$1; sub(/.*\//, "", f)
    key=$2; val=$3
    if (key == "projectID") pid[f]=val
    else if (key == "directory") dir[f]=val
  }
  END { for (b in pid) print b "\t" pid[b] "\t" (b in dir ? dir[b] : "unknown") }' > "$TMP/projmap.tsv"

# --- 2) Scan each pattern, join with map, append to all.tsv ---
: > "$TMP/all.tsv"
while IFS= read -r line; do
  [ -z "$line" ] && continue
  label="${line%% ::: *}"
  rest="${line#* ::: }"
  pat="${rest%% ::: *}"
  noisy="${rest##* ::: }"
  [ "$noisy" = "yes" ] && [ "$ALL" != "all" ] && continue
  rg -No --color=never -g '*.json' -e "$pat" "$DIR" 2>/dev/null \
  | awk -F'\t' -v lbl="$label" -v map="$TMP/projmap.tsv" '
      BEGIN { while ((getline l < map) > 0) { split(l, a, "\t"); pid[a[1]]=a[2]; dir[a[1]]=a[3] } }
      {
        line=$0
        file=line; sub(/:.*/, "", file); sub(/.*\//, "", file)
        m=line; sub(/^[^:]*:/, "", m)
        print (file in pid ? pid[file] : "unknown") "\t" (file in dir ? dir[file] : "unknown") "\t" lbl "\t" m
      }' >> "$TMP/all.tsv"
done <<'PATTERNS'
AWS Access Key ID ::: AKIA[0-9A-Z]{16} ::: no
AWS Secret Access Key ::: (?:secretAccessKey|aws_secret_access_key)["']?\s*[:=]\s*["']?[A-Za-z0-9/+=]{32,}["']? ::: no
Private Key Block ::: -----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP |ENCRYPTED )?PRIVATE KEY----- ::: no
PGP Private Key Block ::: -----BEGIN PGP PRIVATE KEY BLOCK----- ::: no
Google API Key ::: AIza[0-9A-Za-z_\-]{35} ::: no
Slack Token ::: xox[baprs]-[0-9A-Za-z\-]{10,} ::: no
Stripe Key ::: sk_(live|test)_[0-9a-zA-Z]{16,}|pk_(live|test)_[0-9a-zA-Z]{16,} ::: no
GitHub Token ::: gh[pousr]_[0-9A-Za-z]{36,}|github_pat_[0-9A-Za-z_]{50,} ::: no
GitLab Token ::: glpat-[0-9a-zA-Z_\-]{20,} ::: no
OpenAI API Key ::: sk-[0-9a-zA-Z]{20,} ::: no
Anthropic API Key ::: sk-ant-[0-9A-Za-z\-]{20,} ::: no
NPM Token ::: npm_[0-9A-Za-z]{36,} ::: no
JWT ::: eyJ[A-Za-z0-9_\-]{8,}\.eyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,} ::: no
Bearer Token ::: Bearer\s+[A-Za-z0-9._\-]{12,} ::: no
Credentials in URL ::: ://[^\s:/]+:[^\s@/]+@ ::: no
DB/Service Connection String ::: (?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp|ftp)://[^\s"'\)\]]+ ::: no
Generic Secret/Password Assignment ::: (?:api[_-]?key|apikey|access[_-]?key|client[_-]?secret|private[_-]?key|secret|token|password|passwd|pwd|auth[_-]?token)["']?\s*[:=]\s*["']?[A-Za-z0-9+/=_\-]{12,}["']? ::: no
Email Address ::: [A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,} ::: no
URL Reference ::: https?://[^\s"'\)\]]+ ::: yes
Sensitive Keyword Context ::: (?:secret|password|passwd|pwd|token|api[_-]?key|access[_-]?key|client[_-]?secret|private[_-]?key|auth(?:entication)?|credential)\b.{0,100} ::: yes
PATTERNS

# --- 3) Aggregate with awk -> sum.tsv (pid|total|dir) and det.tsv (pid|label|count|samples) ---
awk -F'\t' -v sumf="$TMP/sum.tsv" -v detf="$TMP/det.tsv" '
{
  pid=$1; dir=$2; label=$3; m=$4
  D[pid]=dir
  k=pid SUBSEP label
  C[k]++; T[pid]++
  if (SC[k]+0 < 20) { SP[k] = (SP[k]=="" ? "" : SP[k] "\n") "     - " m; SC[k]++ }
}
END {
  for (p in T) print p "\t" T[p] "\t" D[p] > sumf
  for (k in C) { split(k, a, SUBSEP); print a[1] "\t" a[2] "\t" C[k] "\t" SP[k] > detf }
}
' "$TMP/all.tsv"

# --- 4) Assemble final report ---
PROJ_COUNT="$(wc -l < "$TMP/sum.tsv" | tr -d ' ')"
{
  echo "Leak scan by project"
  echo "Dir: $DIR"
  echo "Generated: $(date)"
  echo "Projects scanned: $PROJ_COUNT"
  echo "Noisy categories: $NOISE"
  echo
  echo "--- Summary (by total findings, descending) ---"
  sort -t$'\t' -k2,2nr "$TMP/sum.tsv" | awk -F'\t' '{printf "%7s  %s  (%s)\n", $2, $3, $1}'
  echo
  echo "========================================"
  sort -t$'\t' -k2,2nr "$TMP/sum.tsv" | cut -f1 | while IFS= read -r pid; do
    dir="$(awk -F'\t' -v p="$pid" '$1==p{print $3; exit}' "$TMP/sum.tsv")"
    tot="$(awk -F'\t' -v p="$pid" '$1==p{print $2; exit}' "$TMP/sum.tsv")"
    echo "### PROJECT: $dir"
    echo "projectID: $pid | findings: $tot"
    awk -F'\t' -v p="$pid" '$1==p {print "\n  ## " $2 ": " $3; print $4}' "$TMP/det.tsv"
    echo
  done
} > "$OUT/by_project.txt"

TOTAL="$(awk -F'\t' '{s+=$2} END{print s+0}' "$TMP/sum.tsv")"
echo "Report: $OUT/by_project.txt"
echo "Projects: $PROJ_COUNT | total findings: $TOTAL | noisy: $NOISE"

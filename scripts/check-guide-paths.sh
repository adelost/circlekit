#!/usr/bin/env bash
# Guide-paths gate (Mattias 2026-09-17: "dokumentation blir ju gammal om vi
# spårar ur"). Every backticked repo path in product-spec/GUIDE.md must exist,
# and every command line in its Commands block must name a script or package
# that exists. A guide line that points at nothing fails by line, so the guide
# cannot go stale silently. Placeholders in angle brackets (<name>) and paths
# that belong to a consuming product (appspec/..., app/src/...) are the
# product's to check, not this repo's, and are skipped by name.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"
GUIDE="${1:-product-spec/GUIDE.md}"
[ -f "$GUIDE" ] || { echo "check-guide-paths: FAIL: guide missing: $GUIDE" >&2; exit 2; }

status=0
line_no=0
while IFS= read -r line; do
  line_no=$((line_no + 1))
  # backticked tokens that look like repo paths: contain a slash or end in .sh/.md/.ts/.json/.kt
  while IFS= read -r token; do
    [ -n "$token" ] || continue
    case "$token" in
      *'<'*'>'*) continue ;;                       # placeholder
      appspec/*|app/src/*|*/appspec/*) continue ;; # the product's, not ours
      Generated*|\<product\>*) continue ;;
    esac
    if [ ! -e "$token" ]; then
      echo "check-guide-paths: FAIL: $GUIDE:$line_no names '$token', which does not exist (renamed? fix the line or the path)" >&2
      status=1
    fi
  done < <(grep -o '`[^`]*`' <<<"$line" | tr -d '`' | grep -E '/|\.(sh|md|ts|json|kt)$' || true)
done < "$GUIDE"

# Commands block: each non-comment line must start with an existing script or "cd <dir> &&".
in_block=0
line_no=0
while IFS= read -r line; do
  line_no=$((line_no + 1))
  # Only a plain ``` fence is a commands block; a ```ts fence is an example and is skipped whole.
  if [[ "$line" == '```'* ]]; then
    if [ "$in_block" -ne 0 ]; then in_block=0; elif [[ "$line" == '```' ]]; then in_block=1; else in_block=2; fi
    continue
  fi
  [ "$in_block" -eq 1 ] || continue
  cmd="${line%%#*}"; cmd="$(sed -E 's/^[[:space:]]+|[[:space:]]+$//g' <<<"$cmd")"
  cmd="${cmd#(}"; cmd="${cmd%)}"   # a subshell "(cd dir && ...)" is checked as its inner command
  [ -n "$cmd" ] || continue
  if [[ "$cmd" == cd\ * ]]; then
    dir="$(awk '{print $2}' <<<"$cmd")"
    case "$dir" in appspec*|app/*) continue ;; esac   # a product's directories are the product's to check
    [ -d "$dir" ] || { echo "check-guide-paths: FAIL: $GUIDE:$line_no: directory '$dir' does not exist" >&2; status=1; }
  else
    first="$(awk '{print $1}' <<<"$cmd")"
    [ -x "$first" ] || { echo "check-guide-paths: FAIL: $GUIDE:$line_no: '$first' is not an executable in this repo" >&2; status=1; }
  fi
done < "$GUIDE"

[ "$status" -eq 0 ] && echo "check-guide-paths: OK ($GUIDE)"
exit "$status"

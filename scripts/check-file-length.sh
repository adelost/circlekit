#!/usr/bin/env bash
# Manual, repo-wide production-file length ratchet.
#
# This is intentionally not wired into Gradle, git hooks, or hosted CI.
# Run it while changing CircleKit structure. New production Kotlin files may
# never exceed 500 lines; any audited legacy exception must be listed in the
# shrink-only baseline next to this script.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BASELINE_FILE="$SCRIPT_DIR/file-length-baseline.txt"
SETTINGS_FILE="$REPO_ROOT/settings.gradle.kts"
MAX=500

if [[ ! -f "$BASELINE_FILE" || ! -f "$SETTINGS_FILE" ]]; then
  echo "check-file-length: baseline or settings.gradle.kts is missing" >&2
  exit 2
fi

declare -a modules=()
while IFS= read -r line; do
  [[ "$line" =~ ^[[:space:]]*include\( ]] || continue
  remainder="$line"
  while [[ "$remainder" =~ \"(:[^\"]+)\" ]]; do
    match="${BASH_REMATCH[1]}"
    path="${match#:}"
    modules+=("${path//:/\/}")
    remainder="${remainder#*\"$match\"}"
  done
done < "$SETTINGS_FILE"

if [[ "${#modules[@]}" -eq 0 ]]; then
  echo "check-file-length: no Gradle modules parsed; refusing a false green" >&2
  exit 2
fi

declare -A declared=()
declare -A baselined=()
declare -a scan_roots=()
for module in "${modules[@]}"; do
  declared["$module"]=1
  if [[ ! -d "$REPO_ROOT/$module" ]]; then
    echo "check-file-length: declared module is missing: $module" >&2
    exit 2
  fi
  scan_roots+=("$REPO_ROOT/$module")
done

fail=0
while read -r path lines owner extra; do
  [[ -z "${path:-}" || "$path" == \#* ]] && continue
  if [[ -z "${owner:-}" || -n "${extra:-}" || ! "$lines" =~ ^[0-9]+$ ]]; then
    echo "FAIL malformed baseline row: $path ${lines:-} ${owner:-} ${extra:-}"
    fail=1
    continue
  fi
  baselined["$path"]="$lines"
  file="$REPO_ROOT/$path"
  if [[ ! -f "$file" ]]; then
    echo "FAIL missing baselined file: $path"
    fail=1
    continue
  fi
  actual="$(wc -l < "$file")"
  if (( actual > lines )); then
    echo "FAIL $path grew: $actual > $lines (owner $owner)"
    fail=1
  elif (( actual <= MAX )); then
    echo "FAIL $path is now $actual lines; delete its baseline row"
    fail=1
  elif (( actual < lines )); then
    echo "FAIL $path shrank: lower its baseline from $lines to $actual"
    fail=1
  fi
done < "$BASELINE_FILE"

while IFS= read -r file; do
  relative="${file#"$REPO_ROOT/"}"
  [[ -n "${baselined[$relative]:-}" ]] && continue
  actual="$(wc -l < "$file")"
  if (( actual > MAX )); then
    echo "FAIL new production file exceeds $MAX lines: $relative ($actual)"
    fail=1
  fi
done < <(find "${scan_roots[@]}" -path '*/src/main/*' -type f -name '*.kt' | sort)

# Source trees not declared in settings are otherwise invisible to every
# module-derived tool. Detect that direction as well.
while IFS= read -r main_dir; do
  module="${main_dir#"$REPO_ROOT/"}"
  module="${module%/src/main}"
  if [[ -z "${declared[$module]:-}" ]]; then
    echo "FAIL undeclared production source tree: $module/src/main"
    fail=1
  fi
done < <(
  find "$REPO_ROOT" \
    -type d \( -name build -o -name .git -o -name .gradle \) -prune -o \
    -type d -path '*/src/main' -print | sort
)

if (( fail != 0 )); then
  exit 1
fi
echo "PASS: ${#modules[@]} CircleKit modules have no production Kotlin file over $MAX lines"

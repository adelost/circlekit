#!/usr/bin/env bash
# Manual architecture check (row 1785): @v1d/arch-check 0.8.0 pinned by sha256, 500-line TypeScript and JavaScript files with a
# shrink-only baseline (arch.baseline.json), and packages that reach each other only by published name (no relative import out of a package).
#
# This is intentionally not wired into Gradle, git hooks, hosted CI or a release path, like the other scripts/check-*.sh.
# A raise of a known exception or a removed rule needs a named decision in arch.decisions.json. Kotlin files have their own
# manual ratchet, scripts/check-file-length.sh.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
[[ -d node_modules/@v1d/arch-check ]] || npm ci --silent
exec node scripts/arch/arch_check.mjs "$@"

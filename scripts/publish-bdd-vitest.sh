#!/usr/bin/env bash
# Public bdd-vitest release entrypoint: the package is the bdd-vitest repository's own committed build, copied here by scripts/sync-bdd-vitest.mjs (this repo keeps the manifest and the gate, never the files);
# the shared snapshot implementation preserves every other npm axis and every historical Maven payload.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CIRCLEKIT_RELEASE_AXIS=bdd-vitest exec "$SCRIPT_DIR/publish-maven.sh" "$@"

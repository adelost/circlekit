#!/usr/bin/env bash
# Public @v1d/engine release entrypoint: the package's dist/ is built from Cutkit's packages/engine by its tools/dev/publish-engine.mjs (this repo keeps the manifest and the gate, never the files);
# the shared snapshot implementation preserves every other npm axis and every historical Maven payload.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CIRCLEKIT_RELEASE_AXIS=engine exec "$SCRIPT_DIR/publish-maven.sh" "$@"

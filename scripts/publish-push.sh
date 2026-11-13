#!/usr/bin/env bash
# Public @v1d/push release entrypoint: the package's dist/ is built from Cutkit's tools/push by its tools/dev/publish-push.mjs (this repo keeps the manifest and the gate, never the files);
# the shared snapshot implementation preserves every other npm axis and every historical Maven payload.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CIRCLEKIT_RELEASE_AXIS=push exec "$SCRIPT_DIR/publish-maven.sh" "$@"

#!/usr/bin/env bash
# Public @v1d/web-kit release entrypoint. The package's dist/ is built from Cutkit's source by Cutkit's tools/dev/publish-web-kit.mjs, which calls this;
# the shared snapshot implementation preserves every other npm axis and every historical Maven payload.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CIRCLEKIT_RELEASE_AXIS=web-kit exec "$SCRIPT_DIR/publish-maven.sh" "$@"

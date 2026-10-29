#!/usr/bin/env bash
# Public @v1d/api-client release entrypoint: the package's dist/ is built from the ai-gateway repository's packages/api-client by its scripts/publish-api-client.mjs (this repo keeps the manifest and the gate, never the files);
# the shared snapshot implementation preserves every other npm axis and every historical Maven payload.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CIRCLEKIT_RELEASE_AXIS=api-client exec "$SCRIPT_DIR/publish-maven.sh" "$@"

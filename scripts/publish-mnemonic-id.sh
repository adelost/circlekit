#!/usr/bin/env bash
# Public mnemonic-id release entrypoint: the package is the npm registry's own tarball of that version, unpacked here by scripts/sync-mnemonic-id.mjs;
# the shared snapshot implementation preserves every other npm axis and every historical Maven payload.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CIRCLEKIT_RELEASE_AXIS=mnemonic-id exec "$SCRIPT_DIR/publish-maven.sh" "$@"

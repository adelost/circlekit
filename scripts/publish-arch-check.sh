#!/usr/bin/env bash
# Public @v1d/arch-check release entrypoint: the package is one dependency-free script, held in arch-check/ and gated by its own check;
# the shared snapshot implementation preserves every other npm axis and every historical Maven payload.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CIRCLEKIT_RELEASE_AXIS=arch-check exec "$SCRIPT_DIR/publish-maven.sh" "$@"

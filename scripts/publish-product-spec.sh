#!/usr/bin/env bash
# Public ProductSpec-only release entrypoint. The shared snapshot implementation
# preserves both npm axes and every historical Maven payload.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CIRCLEKIT_RELEASE_AXIS=product-spec exec "$SCRIPT_DIR/publish-maven.sh" "$@"

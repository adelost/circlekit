#!/usr/bin/env bash
# Public product-emit-only release entrypoint. The shared snapshot keeps all
# npm axes and historical Maven payloads intact.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CIRCLEKIT_RELEASE_AXIS=product-emit exec "$SCRIPT_DIR/publish-maven.sh" "$@"

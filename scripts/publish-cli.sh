#!/usr/bin/env bash
# Publish the CLI built from Cutkit through the shared cumulative Pages snapshot.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CIRCLEKIT_RELEASE_AXIS=cli exec "$SCRIPT_DIR/publish-maven.sh" "$@"

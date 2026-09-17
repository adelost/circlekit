#!/usr/bin/env bash
# What a new product pins today, read from what is actually served: the Maven repository, every published Android
# kit at its latest version, and the npm tarballs of product-spec and product-emit at this checkout's versions.
# A tarball that does not answer 200 is printed with its code and fails the run, so the line is never a guess.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REMOTE="${CIRCLEKIT_REMOTE_REPOSITORY:-https://circlekit.pages.dev}"
# The module list is publish-maven.sh's own, so the two cannot disagree.
eval "$(grep -m1 '^MODULES=' "$SCRIPT_DIR/publish-maven.sh")"

status=0
echo "maven repository: $REMOTE"
for module in "${MODULES[@]}"; do
  latest="$(curl -fsS "$REMOTE/io/v1d/circlekit/$module/maven-metadata.xml" | sed -n 's:.*<latest>\(.*\)</latest>.*:\1:p' || true)"
  if [ -z "$latest" ]; then echo "io.v1d.circlekit:$module: no maven-metadata.xml at $REMOTE" >&2; status=1; continue; fi
  echo "io.v1d.circlekit:$module:$latest"
done
for package in product-spec product-emit circlekit-assets; do
  version="$(node -p "require('$REPO_ROOT/$package/package.json').version")"
  url="$REMOTE/npm/v1d/$package/$version/v1d-$package-$version.tgz"
  code="$(curl -s -o /dev/null -w '%{http_code}' "$url")"
  echo "\"@v1d/$package\": \"$url\"$([ "$code" = 200 ] || echo "   <- HTTP $code, not published")"
  [ "$code" = 200 ] || status=1
done
exit "$status"

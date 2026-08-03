#!/usr/bin/env bash
# Build and publish one immutable CircleKit version without dropping older
# versions from the Cloudflare Pages snapshot.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REMOTE_REPOSITORY="${CIRCLEKIT_REMOTE_REPOSITORY:-https://circlekit.pages.dev}"
VERSION="${1:-}"
MODE="${2:-}"
MODULES=(designkit ringkit releasekit releasekit-ui servicekit)
EXTENSIONS=(aar pom module)
CHECKSUM_SUFFIXES=("" .md5 .sha1 .sha256 .sha512)
PRODUCT_SPEC_DIR="$REPO_ROOT/product-spec"
PRODUCT_SPEC_REMOTE_ROOT="$REMOTE_REPOSITORY/npm/v1d/product-spec"

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "usage: scripts/publish-maven.sh X.Y.Z [--prepare-only]" >&2
  exit 2
fi
if [[ -n "$MODE" && "$MODE" != "--prepare-only" ]]; then
  echo "unknown option: $MODE" >&2
  exit 2
fi
if ! git -C "$REPO_ROOT" diff --quiet ||
   ! git -C "$REPO_ROOT" diff --cached --quiet; then
  echo "publish-maven: tracked worktree must be clean" >&2
  exit 2
fi

source_sha="$(git -C "$REPO_ROOT" rev-parse HEAD)"
product_spec_version="$(node -p "require('$PRODUCT_SPEC_DIR/package.json').version")"
if [[ "$product_spec_version" != "$VERSION" ]]; then
  echo "publish-maven: product-spec version $product_spec_version must equal CircleKit $VERSION" >&2
  exit 1
fi
mkdir -p "$REPO_ROOT/build"
stage="$(mktemp -d "$REPO_ROOT/build/circlekit-maven-stage.XXXXXX")"
new_repository="$stage/new"
cumulative_repository="$stage/repository"
mkdir -p "$new_repository" "$cumulative_repository"

for module in "${MODULES[@]}"; do
  url="$REMOTE_REPOSITORY/io/v1d/circlekit/$module/$VERSION/$module-$VERSION.aar"
  status="$(curl -sS -o /dev/null -w '%{http_code}' "$url")"
  if [[ "$status" != 404 ]]; then
    echo "publish-maven: refusing immutable coordinate $module:$VERSION (HTTP $status)" >&2
    exit 1
  fi
done
product_spec_candidate="$PRODUCT_SPEC_REMOTE_ROOT/$VERSION/v1d-product-spec-$VERSION.tgz"
product_spec_candidate_status="$(curl -sS -o /dev/null -w '%{http_code}' "$product_spec_candidate")"
if [[ "$product_spec_candidate_status" != 404 ]]; then
  echo "publish-maven: refusing immutable product-spec $VERSION (HTTP $product_spec_candidate_status)" >&2
  exit 1
fi

npm_root="$cumulative_repository/npm/v1d/product-spec"
mkdir -p "$npm_root"
npm_versions_file="$stage/product-spec-versions.json"
npm_metadata_status="$(curl -sS -o "$npm_versions_file" -w '%{http_code}' "$PRODUCT_SPEC_REMOTE_ROOT/versions.json")"
declare -a previous_npm_versions=()
if [[ "$npm_metadata_status" == 200 ]]; then
  while IFS= read -r previous; do
    [[ -n "$previous" ]] && previous_npm_versions+=("$previous")
  done < <(node -e 'for (const v of JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).versions) console.log(v)' "$npm_versions_file")
elif [[ "$npm_metadata_status" != 404 ]]; then
  echo "publish-maven: product-spec metadata fetch failed (HTTP $npm_metadata_status)" >&2
  exit 1
fi
for previous in "${previous_npm_versions[@]}"; do
  [[ "$previous" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
    echo "publish-maven: unsafe product-spec version: $previous" >&2
    exit 1
  }
  previous_dir="$npm_root/$previous"
  mkdir -p "$previous_dir"
  previous_tarball="v1d-product-spec-$previous.tgz"
  curl -fsSL "$PRODUCT_SPEC_REMOTE_ROOT/$previous/$previous_tarball" -o "$previous_dir/$previous_tarball"
  curl -fsSL "$PRODUCT_SPEC_REMOTE_ROOT/$previous/$previous_tarball.sha256" -o "$previous_dir/$previous_tarball.sha256"
  expected="$(tr -d '\r\n ' < "$previous_dir/$previous_tarball.sha256")"
  actual="$(sha256sum "$previous_dir/$previous_tarball" | cut -d' ' -f1)"
  [[ "$actual" == "$expected" ]] || {
    echo "publish-maven: product-spec checksum mismatch for $previous" >&2
    exit 1
  }
done

product_spec_target="$npm_root/$VERSION"
mkdir -p "$product_spec_target"
npm ci --prefix "$PRODUCT_SPEC_DIR"
npm test --prefix "$PRODUCT_SPEC_DIR"
npm pack "$PRODUCT_SPEC_DIR" --pack-destination "$product_spec_target" >/dev/null
product_spec_tarball="$product_spec_target/v1d-product-spec-$VERSION.tgz"
[[ -s "$product_spec_tarball" ]] || {
  echo "publish-maven: missing packed product-spec $product_spec_tarball" >&2
  exit 1
}
sha256sum "$product_spec_tarball" | cut -d' ' -f1 > "$product_spec_tarball.sha256"
node -e '
  const fs = require("fs");
  const versions = process.argv.slice(2).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  fs.writeFileSync(process.argv[1], JSON.stringify({ latest: versions.at(-1), versions }, null, 2) + "\n");
' "$npm_root/versions.json" "${previous_npm_versions[@]}" "$VERSION"

"$REPO_ROOT/gradlew" \
  "-PcirclekitVersion=$VERSION" \
  "-PcirclekitPublishDir=$new_repository" \
  :designkit:publishReleasePublicationToCirclekitRepository \
  :ringkit:publishReleasePublicationToCirclekitRepository \
  :releasekit:publishReleasePublicationToCirclekitRepository \
  :releasekit-ui:publishReleasePublicationToCirclekitRepository \
  :servicekit:publishReleasePublicationToCirclekitRepository

updated="$(date -u +%Y%m%d%H%M%S)"
for module in "${MODULES[@]}"; do
  module_path="io/v1d/circlekit/$module"
  target_module="$cumulative_repository/$module_path"
  mkdir -p "$target_module"
  remote_metadata="$stage/$module-metadata.xml"
  metadata_status="$(
    curl -sS -o "$remote_metadata" -w '%{http_code}' \
      "$REMOTE_REPOSITORY/$module_path/maven-metadata.xml"
  )"

  declare -a previous_versions=()
  if [[ "$metadata_status" == 200 ]]; then
    while IFS= read -r line; do
      [[ "$line" =~ \<version\>([^<]+)\</version\> ]] || continue
      previous_versions+=("${BASH_REMATCH[1]}")
    done < "$remote_metadata"
  elif [[ "$metadata_status" != 404 ]]; then
    echo "publish-maven: metadata fetch failed for $module (HTTP $metadata_status)" >&2
    exit 1
  fi

  if [[ "${#previous_versions[@]}" -gt 0 ]]; then
    latest="${previous_versions[-1]}"
    greatest="$(printf '%s\n%s\n' "$latest" "$VERSION" | sort -V | tail -1)"
    if [[ "$greatest" != "$VERSION" || "$latest" == "$VERSION" ]]; then
      echo "publish-maven: $VERSION must be newer than published $latest" >&2
      exit 1
    fi
  fi

  for previous in "${previous_versions[@]}"; do
    if [[ ! "$previous" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      echo "publish-maven: unsafe published version in metadata: $previous" >&2
      exit 1
    fi
    target_version="$target_module/$previous"
    mkdir -p "$target_version"
    base="$module-$previous"
    for extension in "${EXTENSIONS[@]}"; do
      for suffix in "${CHECKSUM_SUFFIXES[@]}"; do
        curl -fsSL \
          "$REMOTE_REPOSITORY/$module_path/$previous/$base.$extension$suffix" \
          -o "$target_version/$base.$extension$suffix"
      done
    done
  done

  cp -a "$new_repository/$module_path/$VERSION" "$target_module/"

  metadata="$target_module/maven-metadata.xml"
  if [[ "${#previous_versions[@]}" -eq 0 ]]; then
    cp "$new_repository/$module_path/maven-metadata.xml" "$metadata"
  else
    cp "$remote_metadata" "$metadata"
    sed -i \
      -e "s#<latest>[^<]*</latest>#<latest>$VERSION</latest>#" \
      -e "s#<release>[^<]*</release>#<release>$VERSION</release>#" \
      -e "/<\\/versions>/i\\      <version>$VERSION</version>" \
      -e "s#<lastUpdated>[0-9]*</lastUpdated>#<lastUpdated>$updated</lastUpdated>#" \
      "$metadata"
  fi
  md5sum "$metadata" | cut -d' ' -f1 | tee "$metadata.md5" >/dev/null
  sha1sum "$metadata" | cut -d' ' -f1 | tee "$metadata.sha1" >/dev/null
  sha256sum "$metadata" | cut -d' ' -f1 | tee "$metadata.sha256" >/dev/null
  sha512sum "$metadata" | cut -d' ' -f1 | tee "$metadata.sha512" >/dev/null
done

payload_count=0
for module in "${MODULES[@]}"; do
  module_root="$cumulative_repository/io/v1d/circlekit/$module"
  while IFS= read -r version_dir; do
    version="${version_dir##*/}"
    base="$module-$version"
    for extension in "${EXTENSIONS[@]}"; do
      file="$version_dir/$base.$extension"
      [[ -s "$file" ]] || { echo "publish-maven: missing $file" >&2; exit 1; }
      for algorithm in md5 sha1 sha256 sha512; do
        actual="$("${algorithm}sum" "$file" | cut -d' ' -f1)"
        expected="$(tr -d '\r\n ' < "$file.$algorithm")"
        if [[ "$actual" != "$expected" ]]; then
          echo "publish-maven: checksum mismatch: $file.$algorithm" >&2
          exit 1
        fi
      done
      payload_count=$((payload_count + 1))
    done
  done < <(
    find "$module_root" -mindepth 1 -maxdepth 1 -type d \
      -name '[0-9]*.[0-9]*.[0-9]*' | sort -V
  )
done

echo "publish-maven: staged $payload_count verified immutable payloads at $cumulative_repository"
if [[ "$MODE" == "--prepare-only" ]]; then
  echo "STAGED_REPOSITORY=$cumulative_repository"
  exit 0
fi

env -u CLOUDFLARE_API_TOKEN npx wrangler pages deploy "$cumulative_repository" \
  --project-name=circlekit \
  --branch=main \
  "--commit-hash=$source_sha" \
  "--commit-message=CircleKit Maven $VERSION cumulative snapshot"

for module in "${MODULES[@]}"; do
  for extension in "${EXTENSIONS[@]}"; do
    url="$REMOTE_REPOSITORY/io/v1d/circlekit/$module/$VERSION/$module-$VERSION.$extension"
    status=000
    for attempt in {1..15}; do
      status="$(curl -sS -o /dev/null -w '%{http_code}' "$url")"
      [[ "$status" == 200 ]] && break
      sleep 2
    done
    [[ "$status" == 200 ]] || {
      echo "publish-maven: deployed URL is not reachable after 30 s: $url (HTTP $status)" >&2
      exit 1
    }
  done
done
product_spec_url="$PRODUCT_SPEC_REMOTE_ROOT/$VERSION/v1d-product-spec-$VERSION.tgz"
product_spec_status=000
for attempt in {1..15}; do
  product_spec_status="$(curl -sS -o /dev/null -w '%{http_code}' "$product_spec_url")"
  [[ "$product_spec_status" == 200 ]] && break
  sleep 2
done
[[ "$product_spec_status" == 200 ]] || {
  echo "publish-maven: product-spec is not reachable after 30 s: $product_spec_url (HTTP $product_spec_status)" >&2
  exit 1
}
echo "publish-maven: published CircleKit $VERSION from $source_sha"
echo "publish-maven: published @v1d/product-spec $VERSION at $product_spec_url"

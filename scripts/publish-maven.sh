#!/usr/bin/env bash
# Build and publish one immutable CircleKit version without dropping older
# versions from the Cloudflare Pages snapshot.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REMOTE_REPOSITORY="${CIRCLEKIT_REMOTE_REPOSITORY:-https://circlekit.pages.dev}"
VERSION="${1:-}"
MODE="${2:-}"
MODULES=(designkit ringkit releasekit servicekit)
EXTENSIONS=(aar pom module)
CHECKSUM_SUFFIXES=("" .md5 .sha1 .sha256 .sha512)

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

"$REPO_ROOT/gradlew" \
  "-PcirclekitVersion=$VERSION" \
  "-PcirclekitPublishDir=$new_repository" \
  :designkit:publishReleasePublicationToCirclekitRepository \
  :ringkit:publishReleasePublicationToCirclekitRepository \
  :releasekit:publishReleasePublicationToCirclekitRepository \
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
echo "publish-maven: published CircleKit $VERSION from $source_sha"

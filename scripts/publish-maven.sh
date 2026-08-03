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
NPM_DIRS=(product-spec circlekit-assets)
NPM_SLUGS=(product-spec circlekit-assets)
NPM_TARBALLS=(v1d-product-spec v1d-circlekit-assets)
NPM_GATES=(test check:designkit)

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
for package_dir in "${NPM_DIRS[@]}"; do
  package_version="$(node -p "require('$REPO_ROOT/$package_dir/package.json').version")"
  [[ "$package_version" == "$VERSION" ]] || {
    echo "publish-maven: $package_dir version $package_version must equal CircleKit $VERSION" >&2
    exit 1
  }
done
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
declare -a NPM_PUBLISHED_URLS=()
stage_npm_package() {
  local package_dir="$1" slug="$2" tarball_prefix="$3" gate="$4"
  local remote_root="$REMOTE_REPOSITORY/npm/v1d/$slug"
  local candidate="$remote_root/$VERSION/$tarball_prefix-$VERSION.tgz"
  local status metadata_status previous expected actual
  status="$(curl -sS -o /dev/null -w '%{http_code}' "$candidate")"
  [[ "$status" == 404 ]] || {
    echo "publish-maven: refusing immutable $slug $VERSION (HTTP $status)" >&2
    exit 1
  }

  local npm_root="$cumulative_repository/npm/v1d/$slug"
  local versions_file="$stage/$slug-versions.json"
  mkdir -p "$npm_root"
  metadata_status="$(curl -sS -o "$versions_file" -w '%{http_code}' "$remote_root/versions.json")"
  local -a previous_versions=()
  if [[ "$metadata_status" == 200 ]]; then
    while IFS= read -r previous; do
      [[ -n "$previous" ]] && previous_versions+=("$previous")
    done < <(node -e 'for (const v of JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).versions) console.log(v)' "$versions_file")
  elif [[ "$metadata_status" != 404 ]]; then
    echo "publish-maven: $slug metadata fetch failed (HTTP $metadata_status)" >&2
    exit 1
  fi
  for previous in "${previous_versions[@]}"; do
    [[ "$previous" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "publish-maven: unsafe $slug version: $previous" >&2; exit 1; }
    local previous_dir="$npm_root/$previous" previous_tarball="$tarball_prefix-$previous.tgz"
    mkdir -p "$previous_dir"
    curl -fsSL "$remote_root/$previous/$previous_tarball" -o "$previous_dir/$previous_tarball"
    curl -fsSL "$remote_root/$previous/$previous_tarball.sha256" -o "$previous_dir/$previous_tarball.sha256"
    expected="$(tr -d '\r\n ' < "$previous_dir/$previous_tarball.sha256")"
    actual="$(sha256sum "$previous_dir/$previous_tarball" | cut -d' ' -f1)"
    [[ "$actual" == "$expected" ]] || { echo "publish-maven: $slug checksum mismatch for $previous" >&2; exit 1; }
  done

  local target="$npm_root/$VERSION" tarball="$npm_root/$VERSION/$tarball_prefix-$VERSION.tgz"
  mkdir -p "$target"
  npm ci --prefix "$REPO_ROOT/$package_dir"
  npm run "$gate" --prefix "$REPO_ROOT/$package_dir"
  npm pack "$REPO_ROOT/$package_dir" --pack-destination "$target" >/dev/null
  [[ -s "$tarball" ]] || { echo "publish-maven: missing packed $slug $tarball" >&2; exit 1; }
  sha256sum "$tarball" | cut -d' ' -f1 > "$tarball.sha256"
  node -e '
    const fs = require("fs");
    const versions = process.argv.slice(2).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    fs.writeFileSync(process.argv[1], JSON.stringify({ latest: versions.at(-1), versions }, null, 2) + "\n");
  ' "$npm_root/versions.json" "${previous_versions[@]}" "$VERSION"
  NPM_PUBLISHED_URLS+=("$candidate")
}

for index in "${!NPM_DIRS[@]}"; do
  stage_npm_package "${NPM_DIRS[$index]}" "${NPM_SLUGS[$index]}" "${NPM_TARBALLS[$index]}" "${NPM_GATES[$index]}"
done

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
for npm_url in "${NPM_PUBLISHED_URLS[@]}"; do
  npm_status=000
  for attempt in {1..15}; do
    npm_status="$(curl -sS -o /dev/null -w '%{http_code}' "$npm_url")"
    [[ "$npm_status" == 200 ]] && break
    sleep 2
  done
  [[ "$npm_status" == 200 ]] || { echo "publish-maven: npm artifact is not reachable after 30 s: $npm_url (HTTP $npm_status)" >&2; exit 1; }
done
echo "publish-maven: published CircleKit $VERSION from $source_sha"
printf 'publish-maven: published npm artifact %s\n' "${NPM_PUBLISHED_URLS[@]}"

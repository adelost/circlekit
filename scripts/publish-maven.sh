#!/usr/bin/env bash
# Stage and publish one immutable release axis without dropping older npm or
# Maven payloads from the shared Cloudflare Pages snapshot.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REMOTE_REPOSITORY="${CIRCLEKIT_REMOTE_REPOSITORY:-https://circlekit.pages.dev}"
AXIS="${CIRCLEKIT_RELEASE_AXIS:-maven}"
VERSION="${1:-}"
MODE="${2:-}"
MODULES=(designkit ringkit releasekit releasekit-ui servicekit)
EXTENSIONS=(aar pom module)
CHECKSUM_SUFFIXES=("" .md5 .sha1 .sha256 .sha512)
NPM_DIRS=(product-spec circlekit-assets)
NPM_SLUGS=(product-spec circlekit-assets)
NPM_TARBALLS=(v1d-product-spec v1d-circlekit-assets)
NPM_GATES=(test check:designkit)

case "$AXIS" in
  maven) PUBLISHER="publish-maven" ;;
  product-spec) PUBLISHER="publish-product-spec" ;;
  *) echo "unknown CircleKit release axis: $AXIS" >&2; exit 2 ;;
esac

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "usage: scripts/$PUBLISHER.sh X.Y.Z [--prepare-only]" >&2
  exit 2
fi
if [[ -n "$MODE" && "$MODE" != "--prepare-only" ]]; then
  echo "unknown option: $MODE" >&2
  exit 2
fi
if ! git -C "$REPO_ROOT" diff --quiet ||
   ! git -C "$REPO_ROOT" diff --cached --quiet; then
  echo "$PUBLISHER: tracked worktree must be clean" >&2
  exit 2
fi

source_sha="$(git -C "$REPO_ROOT" rev-parse HEAD)"
release_package="circlekit-assets"
[[ "$AXIS" == product-spec ]] && release_package="product-spec"
package_version="$(node -p "require('$REPO_ROOT/$release_package/package.json').version")"
[[ "$package_version" == "$VERSION" ]] || {
  echo "$PUBLISHER: $release_package version $package_version must equal release $VERSION" >&2
  exit 1
}
mkdir -p "$REPO_ROOT/build"
stage="$(mktemp -d "$REPO_ROOT/build/circlekit-pages-stage.XXXXXX")"
new_repository="$stage/new"
cumulative_repository="$stage/repository"
mkdir -p "$new_repository" "$cumulative_repository"

if [[ "$AXIS" == maven ]]; then
  for module in "${MODULES[@]}"; do
    url="$REMOTE_REPOSITORY/io/v1d/circlekit/$module/$VERSION/$module-$VERSION.aar"
    status="$(curl -sS -o /dev/null -w '%{http_code}' "$url")"
    if [[ "$status" != 404 ]]; then
      echo "$PUBLISHER: refusing immutable coordinate $module:$VERSION (HTTP $status)" >&2
      exit 1
    fi
  done
fi
declare -a NPM_PUBLISHED_URLS=()
stage_npm_package() {
  local package_dir="$1" slug="$2" tarball_prefix="$3" gate="$4" release_version="${5:-}"
  local remote_root="$REMOTE_REPOSITORY/npm/v1d/$slug"
  local status metadata_status checksum_status previous expected actual
  local npm_root="$cumulative_repository/npm/v1d/$slug"
  local versions_file="$stage/$slug-versions.json"
  mkdir -p "$npm_root"
  metadata_status="$(curl -sS -o "$versions_file" -w '%{http_code}' "$remote_root/versions.json")"
  local -a previous_versions=()
  local release_in_metadata=false
  if [[ "$metadata_status" == 200 ]]; then
    while IFS= read -r previous; do
      [[ -n "$previous" ]] && previous_versions+=("$previous")
    done < <(node -e 'for (const v of JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).versions) console.log(v)' "$versions_file")
  elif [[ "$metadata_status" != 404 ]]; then
    echo "$PUBLISHER: $slug metadata fetch failed (HTTP $metadata_status)" >&2
    exit 1
  fi
  for previous in "${previous_versions[@]}"; do
    [[ -n "$release_version" && "$previous" == "$release_version" ]] && release_in_metadata=true
    [[ "$previous" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "$PUBLISHER: unsafe $slug version: $previous" >&2; exit 1; }
    local previous_dir="$npm_root/$previous" previous_tarball="$tarball_prefix-$previous.tgz"
    mkdir -p "$previous_dir"
    curl -fsSL "$remote_root/$previous/$previous_tarball" -o "$previous_dir/$previous_tarball"
    actual="$(sha256sum "$previous_dir/$previous_tarball" | cut -d' ' -f1)"
    checksum_status="$(curl -sS -o "$previous_dir/$previous_tarball.sha256" -w '%{http_code}' \
      "$remote_root/$previous/$previous_tarball.sha256")"
    if [[ "$checksum_status" == 200 ]]; then
      expected="$(tr -d '\r\n ' < "$previous_dir/$previous_tarball.sha256")"
      [[ "$actual" == "$expected" ]] || { echo "$PUBLISHER: $slug checksum mismatch for $previous" >&2; exit 1; }
    elif [[ "$checksum_status" == 404 ]]; then
      printf '%s\n' "$actual" > "$previous_dir/$previous_tarball.sha256"
    else
      echo "$PUBLISHER: $slug checksum fetch failed for $previous (HTTP $checksum_status)" >&2
      exit 1
    fi
  done

  if [[ -n "$release_version" ]]; then
    local candidate="$remote_root/$release_version/$tarball_prefix-$release_version.tgz"
    local target="$npm_root/$release_version"
    local tarball="$target/$tarball_prefix-$release_version.tgz"
    local candidate_dir="$stage/$slug-candidate"
    status="$(curl -sS -o /dev/null -w '%{http_code}' "$candidate")"
    if [[ "$status" == 200 && "$MODE" != --prepare-only ]]; then
      echo "$PUBLISHER: refusing immutable $slug $release_version (HTTP $status)" >&2
      exit 1
    elif [[ "$status" != 200 && "$status" != 404 ]]; then
      echo "$PUBLISHER: $slug candidate probe failed (HTTP $status)" >&2
      exit 1
    fi
    if [[ "$status" == 200 && "$release_in_metadata" != true ]]; then
      echo "$PUBLISHER: $slug payload $release_version exists but versions.json omits it" >&2
      exit 1
    fi
    if [[ "$status" == 404 && "$release_in_metadata" == true ]]; then
      echo "$PUBLISHER: $slug versions.json names missing payload $release_version" >&2
      exit 1
    fi

    npm ci --prefix "$REPO_ROOT/$package_dir"
    npm run "$gate" --prefix "$REPO_ROOT/$package_dir"
    if [[ "$status" == 200 ]]; then
      mkdir -p "$candidate_dir"
      npm pack "$REPO_ROOT/$package_dir" --pack-destination "$candidate_dir" >/dev/null
      local packed="$candidate_dir/$tarball_prefix-$release_version.tgz"
      expected="$(sha256sum "$tarball" | cut -d' ' -f1)"
      actual="$(sha256sum "$packed" | cut -d' ' -f1)"
      [[ "$actual" == "$expected" ]] || {
        echo "$PUBLISHER: local $slug $release_version differs from immutable published bytes" >&2
        exit 1
      }
      echo "$PUBLISHER: verified existing immutable $slug $release_version ($actual)"
    else
      mkdir -p "$target"
      npm pack "$REPO_ROOT/$package_dir" --pack-destination "$target" >/dev/null
      [[ -s "$tarball" ]] || { echo "$PUBLISHER: missing packed $slug $tarball" >&2; exit 1; }
      sha256sum "$tarball" | cut -d' ' -f1 > "$tarball.sha256"
      previous_versions+=("$release_version")
      NPM_PUBLISHED_URLS+=("$candidate")
    fi
  fi
  node -e '
    const fs = require("fs");
    const versions = [...new Set(process.argv.slice(2))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    fs.writeFileSync(process.argv[1], JSON.stringify({ latest: versions.at(-1), versions }, null, 2) + "\n");
  ' "$npm_root/versions.json" "${previous_versions[@]}"
}

if [[ "$AXIS" == product-spec ]]; then
  stage_npm_package "${NPM_DIRS[0]}" "${NPM_SLUGS[0]}" "${NPM_TARBALLS[0]}" "${NPM_GATES[0]}" "$VERSION"
  stage_npm_package "" "${NPM_SLUGS[1]}" "${NPM_TARBALLS[1]}" ""
else
  stage_npm_package "" "${NPM_SLUGS[0]}" "${NPM_TARBALLS[0]}" ""
  stage_npm_package "${NPM_DIRS[1]}" "${NPM_SLUGS[1]}" "${NPM_TARBALLS[1]}" "${NPM_GATES[1]}" "$VERSION"
fi

if [[ "$AXIS" == maven ]]; then
  "$REPO_ROOT/gradlew" \
    "-PcirclekitVersion=$VERSION" \
    "-PcirclekitPublishDir=$new_repository" \
    :designkit:publishReleasePublicationToCirclekitRepository \
    :ringkit:publishReleasePublicationToCirclekitRepository \
    :releasekit:publishReleasePublicationToCirclekitRepository \
    :releasekit-ui:publishReleasePublicationToCirclekitRepository \
    :servicekit:publishReleasePublicationToCirclekitRepository
else
  echo "$PUBLISHER: ProductSpec axis; Gradle/AAR publication skipped"
fi

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
    for algorithm in md5 sha1 sha256 sha512; do
      remote_metadata_checksum="$stage/$module-metadata.xml.$algorithm"
      curl -fsSL \
        "$REMOTE_REPOSITORY/$module_path/maven-metadata.xml.$algorithm" \
        -o "$remote_metadata_checksum"
      expected="$(tr -d '\r\n ' < "$remote_metadata_checksum")"
      actual="$("${algorithm}sum" "$remote_metadata" | cut -d' ' -f1)"
      [[ "$actual" == "$expected" ]] || {
        echo "$PUBLISHER: metadata checksum mismatch: $module.$algorithm" >&2
        exit 1
      }
    done
    while IFS= read -r line; do
      [[ "$line" =~ \<version\>([^<]+)\</version\> ]] || continue
      previous_versions+=("${BASH_REMATCH[1]}")
    done < "$remote_metadata"
  elif [[ "$metadata_status" != 404 ]]; then
    echo "$PUBLISHER: metadata fetch failed for $module (HTTP $metadata_status)" >&2
    exit 1
  fi

  if [[ "$AXIS" == maven && "${#previous_versions[@]}" -gt 0 ]]; then
    latest="${previous_versions[-1]}"
    greatest="$(printf '%s\n%s\n' "$latest" "$VERSION" | sort -V | tail -1)"
    if [[ "$greatest" != "$VERSION" || "$latest" == "$VERSION" ]]; then
      echo "$PUBLISHER: $VERSION must be newer than published $latest" >&2
      exit 1
    fi
  fi

  for previous in "${previous_versions[@]}"; do
    if [[ ! "$previous" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      echo "$PUBLISHER: unsafe published version in metadata: $previous" >&2
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

  metadata="$target_module/maven-metadata.xml"
  if [[ "$AXIS" == product-spec ]]; then
    if [[ "$metadata_status" == 200 ]]; then
      cp "$remote_metadata" "$metadata"
    fi
  else
    cp -a "$new_repository/$module_path/$VERSION" "$target_module/"
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
  fi
  if [[ -f "$metadata" ]]; then
    md5sum "$metadata" | cut -d' ' -f1 | tee "$metadata.md5" >/dev/null
    sha1sum "$metadata" | cut -d' ' -f1 | tee "$metadata.sha1" >/dev/null
    sha256sum "$metadata" | cut -d' ' -f1 | tee "$metadata.sha256" >/dev/null
    sha512sum "$metadata" | cut -d' ' -f1 | tee "$metadata.sha512" >/dev/null
  fi
done

payload_count=0
for module in "${MODULES[@]}"; do
  module_root="$cumulative_repository/io/v1d/circlekit/$module"
  while IFS= read -r version_dir; do
    version="${version_dir##*/}"
    base="$module-$version"
    for extension in "${EXTENSIONS[@]}"; do
      file="$version_dir/$base.$extension"
      [[ -s "$file" ]] || { echo "$PUBLISHER: missing $file" >&2; exit 1; }
      for algorithm in md5 sha1 sha256 sha512; do
        actual="$("${algorithm}sum" "$file" | cut -d' ' -f1)"
        expected="$(tr -d '\r\n ' < "$file.$algorithm")"
        if [[ "$actual" != "$expected" ]]; then
          echo "$PUBLISHER: checksum mismatch: $file.$algorithm" >&2
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

echo "$PUBLISHER: staged $payload_count verified immutable Maven payloads at $cumulative_repository"
if [[ "$MODE" == "--prepare-only" ]]; then
  echo "SOURCE_SHA=$source_sha"
  echo "RELEASE_AXIS=$AXIS"
  echo "STAGED_REPOSITORY=$cumulative_repository"
  exit 0
fi

commit_message="CircleKit Maven $VERSION cumulative snapshot"
[[ "$AXIS" == product-spec ]] && commit_message="ProductSpec $VERSION cumulative snapshot"
env -u CLOUDFLARE_API_TOKEN npx wrangler pages deploy "$cumulative_repository" \
  --project-name=circlekit \
  --branch=main \
  "--commit-hash=$source_sha" \
  "--commit-message=$commit_message"

if [[ "$AXIS" == maven ]]; then
  for module in "${MODULES[@]}"; do
    for extension in "${EXTENSIONS[@]}"; do
      url="$REMOTE_REPOSITORY/io/v1d/circlekit/$module/$VERSION/$module-$VERSION.$extension"
      status=000
      for _ in {1..15}; do
        status="$(curl -sS -o /dev/null -w '%{http_code}' "$url")"
        [[ "$status" == 200 ]] && break
        sleep 2
      done
      [[ "$status" == 200 ]] || {
        echo "$PUBLISHER: deployed URL is not reachable after 30 s: $url (HTTP $status)" >&2
        exit 1
      }
    done
  done
fi
for npm_url in "${NPM_PUBLISHED_URLS[@]}"; do
  npm_status=000
  for _ in {1..15}; do
    npm_status="$(curl -sS -o /dev/null -w '%{http_code}' "$npm_url")"
    [[ "$npm_status" == 200 ]] && break
    sleep 2
  done
  [[ "$npm_status" == 200 ]] || { echo "$PUBLISHER: npm artifact is not reachable after 30 s: $npm_url (HTTP $npm_status)" >&2; exit 1; }
done
echo "$PUBLISHER: published $AXIS $VERSION from $source_sha"
printf '%s: published npm artifact %s\n' "$PUBLISHER" "${NPM_PUBLISHED_URLS[@]}"

#!/usr/bin/env bash
# Build both installable showcase hosts from one clean, exact CircleKit SHA.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${1:-}"
SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-/home/adelost/android-dev/sdk}}"

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "usage: scripts/build-showcase-release.sh X.Y.Z" >&2
  exit 2
fi
if ! git -C "$ROOT" diff --quiet || ! git -C "$ROOT" diff --cached --quiet; then
  echo "showcase-release: tracked worktree must be clean" >&2
  exit 2
fi

source_sha="$(git -C "$ROOT" rev-parse HEAD)"
build_tools="$(find "$SDK/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
apksigner="$build_tools/apksigner"
aapt="$build_tools/aapt"
[[ -x "$apksigner" ]] || {
  echo "showcase-release: apksigner not found under $SDK/build-tools" >&2
  exit 2
}
[[ -x "$aapt" ]] || {
  echo "showcase-release: aapt not found under $SDK/build-tools" >&2
  exit 2
}

"$ROOT/gradlew" -PcirclekitVersion="$VERSION" \
  :showcase-phone:assembleRelease \
  :showcase-wear:assembleRelease

out="$ROOT/build/showcase-release/$VERSION"
mkdir -p "$out"
phone="$out/circlekit-showcase-phone-v$VERSION.apk"
wear="$out/circlekit-showcase-wear-v$VERSION.apk"
install -m 0644 \
  "$ROOT/showcase-phone/build/outputs/apk/release/showcase-phone-release.apk" \
  "$phone"
install -m 0644 \
  "$ROOT/showcase-wear/build/outputs/apk/release/showcase-wear-release.apk" \
  "$wear"

for apk in "$phone" "$wear"; do
  "$apksigner" verify --verbose --print-certs "$apk" >/dev/null
done

phone_badging_all="$($aapt dump badging "$phone")"
wear_badging_all="$($aapt dump badging "$wear")"
phone_badging="${phone_badging_all%%$'\n'*}"
wear_badging="${wear_badging_all%%$'\n'*}"
grep -Fq "name='io.v1d.circlekit.showcase.phone'" <<<"$phone_badging"
grep -Fq "name='io.v1d.circlekit.showcase.wear'" <<<"$wear_badging"
grep -Fq "versionName='$VERSION'" <<<"$phone_badging"
grep -Fq "versionName='$VERSION'" <<<"$wear_badging"
phone_code="$(sed -n "s/.*versionCode='\([^']*\)'.*/\1/p" <<<"$phone_badging")"
wear_code="$(sed -n "s/.*versionCode='\([^']*\)'.*/\1/p" <<<"$wear_badging")"
[[ -n "$phone_code" && -n "$wear_code" && "$phone_code" != "$wear_code" ]] || {
  echo "showcase-release: expected distinct monotonic Phone/Wear version codes" >&2
  exit 1
}

phone_sha="$(sha256sum "$phone" | cut -d' ' -f1)"
wear_sha="$(sha256sum "$wear" | cut -d' ' -f1)"
signer="$($apksigner verify --print-certs "$phone" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p')"
wear_signer="$($apksigner verify --print-certs "$wear" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p')"
[[ -n "$signer" && "$wear_signer" == "$signer" ]] || {
  echo "showcase-release: Phone/Wear signer mismatch" >&2
  exit 1
}

report="$out/PROVENANCE.txt"
{
  echo "CircleKit Showcase $VERSION"
  echo "SOURCE_SHA=$source_sha"
  echo "SIGNER_SHA256=$signer"
  echo "PHONE_APK=$(basename "$phone")"
  echo "PHONE_VERSION_NAME=$VERSION"
  echo "PHONE_VERSION_CODE=$phone_code"
  echo "PHONE_SHA256=$phone_sha"
  echo "WEAR_APK=$(basename "$wear")"
  echo "WEAR_VERSION_NAME=$VERSION"
  echo "WEAR_VERSION_CODE=$wear_code"
  echo "WEAR_SHA256=$wear_sha"
} > "$report"

cat "$report"
echo "showcase-release: artifacts at $out"

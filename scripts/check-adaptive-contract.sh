#!/usr/bin/env bash
# CircleKit adaptive-surface contract.
#
# These invariants moved here with the source they inspect. Skyvw's
# check-mobile-design-contract.sh used to assert them against
# designkit/ringkit paths; once those modules became pinned artifacts, every
# one of those greps would have read a missing file. A gate that cannot see
# its subject must not be the gate that reports on it.
#
# Two rules govern what belongs here:
#   1. the assertion is about CircleKit source, not a consumer's; and
#   2. a consumer could not check it at all, because it consumes an AAR.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

fail() { echo "check-adaptive-contract: FAIL: $1" >&2; exit 1; }

DESIGN="designkit/src/main/java/com/adelost/designkit/ui"
RING="ringkit/src/main/java/com/adelost/ringkit/ui"

PHONE_DESIGN="$DESIGN/PhoneSurfaceDesign.kt"
HOST_SHAPE="$DESIGN/SkyvwHostShape.kt"
COMPONENT_VIEWPORT="$DESIGN/SkyvwComponentViewport.kt"
SURFACE_SPEC="$DESIGN/SkyvwSurfaceSpec.kt"
UI_PROFILE="$DESIGN/SkyvwUiProfile.kt"
RING_SCREENS="$RING/RingScreens.kt"
PHONE_RING_SCREENS="$RING/PhoneRingScreens.kt"
ROUND_RING_SCREENS="$RING/RoundRingScreens.kt"

for f in "$PHONE_DESIGN" "$HOST_SHAPE" "$COMPONENT_VIEWPORT" "$SURFACE_SPEC" \
  "$UI_PROFILE" "$RING_SCREENS" "$PHONE_RING_SCREENS" "$ROUND_RING_SCREENS"; do
  [ -f "$f" ] || fail "contract source missing: $f (renamed? point this gate at its replacement)"
done

# --- the three surface classes and how capacity is resolved ----------------
grep -q 'enum class SkyvwSurfaceClass { ROUND, PHONE_COMPACT, PHONE_WIDE }' "$SURFACE_SPEC" \
  || fail "the three named surface classes are no longer one closed enum"
grep -q 'fun resolveSkyvwSurfaceLayout(' "$SURFACE_SPEC" \
  || fail "surface capacity is no longer resolved by a named function"

# Mattias 2026-07-18: a bigger watch shows the SAME layout larger. The host
# scales the canvas; atoms never scale themselves. Every profile must keep
# atomScale at 1, or a consumer inherits a second, silent sizing policy.
grep -q 'CANON_ROUND_CANVAS_DP = 192f' "$UI_PROFILE" \
  || fail "the canonical round canvas is no longer 192dp"
if grep -E 'atomScale = (0?\.[0-9]+|[2-9])' "$UI_PROFILE"; then
  fail "a profile scales atoms; the host scales the canvas, atoms stay at 1"
fi

# --- one renderer, one clipping boundary ----------------------------------
grep -q 'fun RenderRingScreen(' "$RING_SCREENS" \
  || fail "the single screen renderer is gone"
grep -q 'PhoneRingScreen(' "$RING_SCREENS" \
  || fail "ring menus lost their rectangular host translation"
grep -q 'when (val screen = nav.current)' "$PHONE_RING_SCREENS" \
  || fail "phone ring renderer no longer consumes the shared screen model"
grep -q 'SkyvwSurfaceClass.ROUND' "$HOST_SHAPE" \
  || fail "host clipping is no longer driven by surface data"
grep -q 'fun Modifier.skyvwHostClip()' "$HOST_SHAPE" \
  || fail "the one host-shape boundary is gone"

# --- declarative component sizing -----------------------------------------
grep -q 'sealed interface SkyvwContentScale' "$COMPONENT_VIEWPORT" \
  || fail "shared components lost their declarative content-scale vocabulary"
grep -q 'data class CanonicalFit' "$COMPONENT_VIEWPORT" \
  || fail "canonical component fit is no longer representable"
if grep -q 'altitudeDialDiameterDp' "$SURFACE_SPEC"; then
  fail "surface data regressed to a fixed dial diameter instead of a viewport spec"
fi

# --- touch geometry -------------------------------------------------------
grep -q 'actionDiameter = 56.dp' "$PHONE_DESIGN" \
  || fail "phone primary controls lost their comfortable touch geometry"
grep -q 'pillMinHeight = 48.dp' "$PHONE_DESIGN" \
  || fail "phone compact controls lost their minimum touch geometry"

# --- purity: no consumer package may be named from a shared module --------
# Skyvw's check-layer-imports.sh enforced this while it owned the source.
# CircleKit is the library now, so the rule travels with it.
if grep -rEn 'com\.adelost\.(skydivealtimeter|skyvwui|jumpcore|mapkit)' \
  designkit/src/main ringkit/src/main servicekit/src/main releasekit/src/main; then
  fail "a shared module names a consumer package; that is the end of reuse"
fi
if grep -rEn '^import io\.agentmux\.' \
  designkit/src/main ringkit/src/main servicekit/src/main releasekit/src/main; then
  fail "a shared module imports Agentmux Link; consumers stay downstream"
fi

echo "ok    adaptive contract holds: 3 surface classes, 192dp canon, atomScale 1,"
echo "      one renderer, one clip boundary, declarative viewports, pure modules"

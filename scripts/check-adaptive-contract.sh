#!/usr/bin/env bash
# CircleKit adaptive-surface contract.
#
# These invariants moved here with the source they inspect. Skyvw's
# check-mobile-design-contract.sh used to assert them against
# designkit/ringkit paths; once those modules became pinned artifacts, every
# one of those greps would have read a missing file. A gate that cannot see
# its subject must not be the gate that reports on it.
#
# Repointed 2026-07-28: the Skyvw* -> Circle* rename left every path and
# symbol below dangling, so the gate aborted on its own missing-file check
# and enforced nothing. The invariants are unchanged; the names caught up.
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
HOST_SHAPE="$DESIGN/CircleHostShape.kt"
COMPONENT_VIEWPORT="$DESIGN/CircleComponentViewport.kt"
SURFACE_SPEC="$DESIGN/CircleSurfaceSpec.kt"
UI_PROFILE="$DESIGN/CircleUiProfile.kt"
RING_SCREENS="$RING/RingScreens.kt"
PHONE_RING_SCREENS="$RING/PhoneRingScreens.kt"
ROUND_RING_SCREENS="$RING/RoundRingScreens.kt"

for f in "$PHONE_DESIGN" "$HOST_SHAPE" "$COMPONENT_VIEWPORT" "$SURFACE_SPEC" \
  "$UI_PROFILE" "$RING_SCREENS" "$PHONE_RING_SCREENS" "$ROUND_RING_SCREENS"; do
  [ -f "$f" ] || fail "contract source missing: $f (renamed? point this gate at its replacement)"
done

# --- the three surface classes and how capacity is resolved ----------------
grep -q 'enum class CircleSurfaceClass { ROUND, PHONE_COMPACT, PHONE_WIDE }' "$SURFACE_SPEC" \
  || fail "the three named surface classes are no longer one closed enum"
grep -q 'fun resolveCircleSurfaceLayout(' "$SURFACE_SPEC" \
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
grep -q 'CircleSurfaceClass.ROUND' "$HOST_SHAPE" \
  || fail "host clipping is no longer driven by surface data"
grep -q 'fun Modifier.circleHostClip()' "$HOST_SHAPE" \
  || fail "the one host-shape boundary is gone"

# --- declarative component sizing -----------------------------------------
grep -q 'sealed interface CircleContentScale' "$COMPONENT_VIEWPORT" \
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
  designkit/src/main ringkit/src/main servicekit/src/main releasekit/src/main releasekit-ui/src/main; then
  fail "a shared module names a consumer package; that is the end of reuse"
fi
if grep -rEn '^import io\.agentmux\.' \
  designkit/src/main ringkit/src/main servicekit/src/main releasekit/src/main releasekit-ui/src/main; then
  fail "a shared module imports Agentmux Link; consumers stay downstream"
fi

# --- the atoms themselves ---------------------------------------------------
# These arrived from Skyvw's check-ui-atoms.sh with the source they inspect.
# One renderer per shape is the whole point of a shared kit: a consumer that
# cannot see these files cannot be the thing that guards them.
RING_ATOMS="$RING/RingAtoms.kt"
CIRCULAR_ATOMS="$DESIGN/CircleCircularAtoms.kt"
MENU_SPEC="$RING/EdgeMenuSpec.kt"
SAFE_INSET_ATOM="$DESIGN/CircleRoundSafeInset.kt"

for f in "$RING_ATOMS" "$CIRCULAR_ATOMS" "$MENU_SPEC" "$SAFE_INSET_ATOM"; do
  [ -f "$f" ] || fail "atom source missing: $f"
done

for atom in 'fun Modifier\.holdProgressSweep\(' 'fun LabelProgressBar\(' 'fun ProgressRing\('; do
  grep -qE "^$atom" -r "$RING" --include='*.kt' \
    || fail "shared progress atom missing: ${atom//\\/}"
done

# StatRing is the health/value variant of CircleIconRing, not permission to
# fork stroke, icon and label metrics again. The back ring is one shared atom
# with hold semantics; no surface draws its own.
STAT_RING_SOURCE=$(sed -n '/^fun StatRing(/,/^}/p' "$RING_ATOMS")
if ! printf '%s\n' "$STAT_RING_SOURCE" | grep -q 'CircleIconRing(' \
  || printf '%s\n' "$STAT_RING_SOURCE" | grep -qE '(Canvas|drawCircle|\.border\()'; then
  fail "labelled circles must reuse CircleIconRing"
fi
grep -q 'fun BackRing(' "$RING/RingMenuAtoms.kt" \
  || fail "the shared back-ring atom is gone"
sed -n '/^fun BackRing(/,/^}/p' "$RING/RingMenuAtoms.kt" | grep -q 'HoldBackRing(' \
  || fail "BackRing no longer delegates to the hold-aware ring"

grep -q 'val kind: RowKind' "$MENU_SPEC" \
  || fail "menu options must declare RowKind, not a private enum"

# RATCHET: the declarative screen list may shrink, never grow by habit. A new
# case is justified only against the criterion documented in RingScreens.kt.
SCREEN_CASE_BASELINE=7
SCREEN_CASES=$(awk '/^sealed interface RingScreen \{/,/^\}/' "$RING_SCREENS" \
  | grep -cE '^    data class [A-Za-z]+\(' || true)
if [ "$SCREEN_CASES" -gt "$SCREEN_CASE_BASELINE" ]; then
  fail "RingScreen cases: $SCREEN_CASES > baseline $SCREEN_CASE_BASELINE — a surface earns its own case only if it is neither rows nor a launcher grid, owns interaction the row grammar cannot say, AND needs its own back-stack entry"
elif [ "$SCREEN_CASES" -lt "$SCREEN_CASE_BASELINE" ]; then
  echo "note  RingScreen cases: $SCREEN_CASES < baseline $SCREEN_CASE_BASELINE — ratchet DOWN in the SAME commit"
fi

# Chord geometry is matched by SHAPE, not by name: a name list once missed
# circleSafeTopInsetDp, the same chord solved for the other unknown.
CHORD_MATH=$(grep -rlE 'sqrt\([^)]*(diameter|Diameter|radius|Radius)' \
  "$RING" "$DESIGN" --include='*.kt' | grep -v 'CircleRoundSafeInset.kt' || true)
if [ -n "$CHORD_MATH" ]; then
  echo "$CHORD_MATH" >&2
  fail "chord/chrome clearance math outside CircleRoundSafeInset.kt"
fi

RENDER_LIST="renderkit/src/main/java/com/adelost/renderkit/list"
# Moved from Skyvw's check-mobile-design-contract.sh when #1036 made the
# linear list host and chip catalog CircleKit source (rules 1+2 above): the
# consumer now pins only its own pivot and fork detectors.
for src in "$RENDER_LIST/SkyvwLinearListHost.kt" "$RENDER_LIST/SkyvwListSpec.kt" "$RENDER_LIST/SkyvwFilterChip.kt"; do
  [ -f "$src" ] || fail "list contract source missing: $src (renamed? follow it)"
done
grep -q 'background(spec.policy.background.color())' "$RENDER_LIST/SkyvwLinearListHost.kt" \
  || fail "linear list host bypasses the declarative list background"
if grep -q 'background(GraphiteTokens.Canvas)' "$RENDER_LIST/SkyvwLinearListHost.kt"; then
  fail "linear list host regressed to an unconditional grey canvas"
fi
grep -q 'background: SkyvwListBackground = SkyvwListBackground.OLED' "$RENDER_LIST/SkyvwListSpec.kt" \
  || fail "shared lists lost the OLED-black default"
grep -q 'fun filterChipDesign(' "$RENDER_LIST/SkyvwFilterChip.kt" \
  || fail "filter-chip metrics are no longer a surface-keyed table"
grep -q 'horizontalScroll' "$RENDER_LIST/SkyvwFilterChip.kt" \
  || fail "filter chips lost their explicit scrollable row"

RENDER_GESTURES="renderkit/src/main/java/com/adelost/renderkit/gestures"
# Second wave of the #1036 follow: the pager gesture sources. Same two rules.
for src in "$RENDER_GESTURES/PagerFriendlyTap.kt" "$RENDER_GESTURES/PagerMapTransform.kt"; do
  [ -f "$src" ] || fail "pager gesture source missing: $src (renamed? follow it)"
done
grep -q 'PagerMapMotionIntent.PAN_ZOOM' "$RENDER_GESTURES/PagerMapTransform.kt" \
  || fail "pager transform lost its PAN_ZOOM motion intent"
grep -q 'PagerMapMotionIntent.ORBIT' "$RENDER_GESTURES/PagerMapTransform.kt" \
  || fail "pager transform lost its ORBIT motion intent"
grep -q 'awaitFirstDown(requireUnconsumed = false' "$RENDER_GESTURES/PagerMapTransform.kt" \
  || fail "pager transform no longer accepts an already-consumed first down"
if grep -q 'detectTransformGestures' "$RENDER_GESTURES/PagerMapTransform.kt"; then
  fail "pager transform forked back to detectTransformGestures"
fi

echo "ok    adaptive contract holds: 3 surface classes, 192dp canon, atomScale 1,"
echo "      one renderer, one clip boundary, declarative viewports, pure modules,"
echo "      one atom per shape, RingScreen cases $SCREEN_CASES (baseline $SCREEN_CASE_BASELINE)"

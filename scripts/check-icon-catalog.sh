#!/usr/bin/env bash
# Icon-catalog gate (Mattias 2026-07-21: "man får bara använda ikoner från
# icons ... så det finns någon datadriven referens dit").
#
# Every RingIcons vector must be enumerated in RING_ICON_CATALOG — the ICONS
# gallery and every consuming product share one registry. IconCatalogTest pins
# the accent side; this pins the vector side without a JVM.
#
# The consumer half of this rule — "no new Material icon imports in product
# UI" — stays with each product's own source, because the baseline it holds is
# the product's, not CircleKit's.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

fail() { echo "check-icon-catalog: FAIL: $1" >&2; exit 1; }

ICONS_KT="designkit/src/main/java/com/adelost/designkit/ui/RingIcons.kt"
# The list itself, not the file that re-exports it. RING_ICON_CATALOG became an alias
# for PORTABLE_RING_ICON_CATALOG in another file, and this gate kept counting the old
# location: sed matched nothing, grep -c returned 0, and set -e killed the script
# before it could print why. A gate that pins a path outlives the path.
CATALOG_KT="designkit/src/main/java/com/adelost/designkit/ui/RingIconPortableCatalog.kt"
CATALOG_DECL="PORTABLE_RING_ICON_CATALOG"

for f in "$ICONS_KT" "$CATALOG_KT"; do
  [ -f "$f" ] || fail "contract source missing: $f (renamed? point this gate at its replacement)"
done

declared=$(grep -c 'val [A-Za-z]*: ImageVector by lazy' "$ICONS_KT" || true)
cataloged=$(sed -n "/val $CATALOG_DECL/,/^)/p" "$CATALOG_KT" | grep -o 'RingIcons\.[A-Za-z]*' | sort -u | wc -l)
# Zero on either side means this gate stopped being able to look, which is a different
# failure from a real mismatch and must not read as one.
[ "$declared" -gt 0 ] || fail "found no icon declarations in $ICONS_KT (shape changed? update the pattern)"
[ "$cataloged" -gt 0 ] || fail "found no $CATALOG_DECL entries in $CATALOG_KT (moved? point this gate at it)"
[ "$declared" -eq "$cataloged" ] \
  || fail "RingIcons declares $declared vectors but RING_ICON_CATALOG enumerates $cataloged — every icon lives in the catalog or not at all"

echo "ok    icon catalog covers all $declared vectors"

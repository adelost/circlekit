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
CATALOG_KT="designkit/src/main/java/com/adelost/designkit/ui/RingIconAccentCatalog.kt"

for f in "$ICONS_KT" "$CATALOG_KT"; do
  [ -f "$f" ] || fail "contract source missing: $f (renamed? point this gate at its replacement)"
done

declared=$(grep -c 'val [A-Za-z]*: ImageVector by lazy' "$ICONS_KT")
cataloged=$(sed -n '/val RING_ICON_CATALOG/,/^)/p' "$CATALOG_KT" | grep -o 'RingIcons\.[A-Za-z]*' | sort -u | wc -l)
[ "$declared" -eq "$cataloged" ] \
  || fail "RingIcons declares $declared vectors but RING_ICON_CATALOG enumerates $cataloged — every icon lives in the catalog or not at all"

echo "ok    icon catalog covers all $declared vectors"

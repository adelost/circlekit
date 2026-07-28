package com.adelost.designkit.ui

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** User-selectable circle-grid density (DISPLAY → MENU GRID). REGULAR is the
 * calm 3-column composition; COMPACT trades ring size for a 4-column sweep. */
enum class CircleMenuDensity { REGULAR, COMPACT }

/** A menu surface carries two grids with distinct jobs: the logbook trio and
 * the settings launcher. ROUND sizes them differently; rectangular hosts do
 * not, but the role stays in the key so that stays a data decision. */
enum class MenuGridRole {
    LOGBOOK,
    SETTINGS,
    MAP_CONTROLS,
    COMPONENT_GALLERY,
}

@Immutable
data class MenuGridSpec(
    val columns: Int,
    val diameter: Dp,
    val horizontalGap: Dp,
    val verticalGap: Dp,
    /** Fraction of the host content column occupied by this menu grid.
     *
     * This is explicit layout policy, not a renderer guess based on
     * [contentMaxWidth]. The shared centred menu composition keeps its
     * symmetric margin on both round and rectangular hosts. */
    val contentWidthFraction: Float,
    /** Cap for the grid's content column on rectangular hosts. Null on ROUND,
     * where the physical face is its own boundary. */
    val contentMaxWidth: Dp?,
    /** Label text size under each ring. Cells are strict equal-width, so this
     * size must let the role's longest label fit the narrowest cell — on
     * ROUND that is "RECORDING" in the ~45.3 dp cell left by the declared
     * 75% width policy: (192 × 0.75 − 2 × 4) / 3. */
    val labelSize: TextUnit = 9.5.sp,
) {
    init {
        require(contentWidthFraction > 0f && contentWidthFraction <= 1f) {
            "Menu content width fraction must be in (0, 1]"
        }
    }
}

/** THE menu-grid layout table. Adding a surface class or density is a row
 * here — never an inline ternary in a renderer. [menuGridSpec] is an
 * exhaustive `when`, so a new enum value refuses to compile until its row
 * exists. */
object MenuGridCatalog {
    // ROUND is density-invariant AND role-invariant: the canonical face has
    // exactly one composition. Rings share the home rim buttons' 30 dp atom
    // (Mattias 2026-07-23: "gör dem mindre istället.. samma storlek som på
    // hemskärmen") — HOME_SLOT_BUTTON_DP app-side; one ring size across the
    // watch's home and menu surfaces.
    //
    // 6 sp labels with the tight 4 dp gap: the strict ~45.3 dp cell left by
    // the symmetric width policy shows even "RECORDING" (9 tracked glyphs)
    // unclipped (Mattias 2026-07-23: "går det få dem symmetriska?") — the
    // the dial's compact chrome typography remains readable on the round face.
    val RoundTrio = MenuGridSpec(
        columns = 3,
        diameter = MenuDesign.watchActionRingDiameter,
        horizontalGap = 4.dp,
        verticalGap = 4.dp,
        // 12.5% of the physical face on each side. The former 0.9 fraction
        // meant only 5% per side and still let the X@9 disc visually merge
        // with the first column.
        contentWidthFraction = MenuDesign.centeredGridWidthFraction,
        contentMaxWidth = null,
        labelSize = 6.sp,
    )

    // Phone portrait. ONE ring size on every rectangular surface — the start
    // screen's 56 dp action (Mattias 2026-07-21: "ikonerna på settings är
    // samma storlek som på framsidan.. det är nya standarden"). Density and
    // role change capacity and spacing, never the atom.
    val PhoneRegular = MenuGridSpec(
        columns = 3,
        diameter = 56.dp,
        horizontalGap = 34.dp,
        verticalGap = 20.dp,
        contentWidthFraction = MenuDesign.centeredGridWidthFraction,
        contentMaxWidth = 360.dp,
    )
    val PhoneCompact = MenuGridSpec(
        columns = 4,
        diameter = 56.dp,
        // Four 56 dp touch atoms still fit a 75% portrait content column.
        horizontalGap = 6.dp,
        verticalGap = 16.dp,
        contentWidthFraction = MenuDesign.centeredGridWidthFraction,
        contentMaxWidth = 380.dp,
        labelSize = 8.5.sp,
    )

    // Wide/tablet: capacity and content width grow, physical atom size never
    // does — same rule as PhoneSurfaceDesignCatalog.Wide.
    val WideRegular = PhoneRegular.copy(columns = 4, contentMaxWidth = 560.dp)
    val WideCompact = PhoneCompact.copy(
        columns = 6,
        horizontalGap = 24.dp,
        contentMaxWidth = 640.dp,
    )
}

fun menuGridSpec(
    surface: CircleSurfaceClass,
    density: CircleMenuDensity,
    role: MenuGridRole,
): MenuGridSpec = when (surface) {
    // Role deliberately does not branch here: on the watch both grids ARE the
    // same layout item. It stays in the signature so a future round-only
    // divergence is a row in the catalog, never an inline ternary.
    CircleSurfaceClass.ROUND -> MenuGridCatalog.RoundTrio
    CircleSurfaceClass.PHONE_COMPACT -> when (density) {
        CircleMenuDensity.REGULAR -> MenuGridCatalog.PhoneRegular
        CircleMenuDensity.COMPACT -> MenuGridCatalog.PhoneCompact
    }
    CircleSurfaceClass.PHONE_WIDE -> when (density) {
        CircleMenuDensity.REGULAR -> MenuGridCatalog.WideRegular
        CircleMenuDensity.COMPACT -> MenuGridCatalog.WideCompact
    }
}

/** Set once by the host from persisted settings; menu renderers read it. */
val LocalCircleMenuDensity = staticCompositionLocalOf { CircleMenuDensity.REGULAR }

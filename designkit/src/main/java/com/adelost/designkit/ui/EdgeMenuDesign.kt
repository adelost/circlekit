package com.adelost.designkit.ui

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

data class EdgeMenuLayout(
    val columns: Int,
    val ringDiameter: Dp,
    val horizontalGap: Dp,
    val verticalGap: Dp,
)

/** Shared geometry for a compact group of menu-option rings. */
object EdgeMenuDesign {
    val optionGapTop: Dp = 10.dp
    val optionGapBottom: Dp = 12.dp
    val optionSpacing: Dp = 14.dp
    /** 3 × 38 + 2 × 14 = 142 dp. Four rings required 194 dp and therefore
     * clipped both outside options on the canonical 192 dp round surface. */
    const val optionsPerRow: Int = 3

    /** Same 30 dp atom as the home rim buttons. */
    val optionRingDiameter: Dp = MenuDesign.watchActionRingDiameter

    /** Host translation for the same option group. */
    fun optionLayout(
        surfaceClass: CircleSurfaceClass,
        menuDensity: CircleMenuDensity,
    ): EdgeMenuLayout = when (surfaceClass) {
        CircleSurfaceClass.ROUND -> EdgeMenuLayout(
            columns = optionsPerRow,
            ringDiameter = optionRingDiameter,
            horizontalGap = optionSpacing,
            verticalGap = optionGapTop + optionGapBottom,
        )
        CircleSurfaceClass.PHONE_COMPACT,
        CircleSurfaceClass.PHONE_WIDE,
        -> {
            val grid = menuGridSpec(surfaceClass, menuDensity, MenuGridRole.SETTINGS)
            EdgeMenuLayout(
                columns = grid.columns,
                ringDiameter = grid.diameter,
                horizontalGap = grid.horizontalGap,
                verticalGap = grid.verticalGap,
            )
        }
    }

    /** Exact horizontal footprint before the round host clips the row. */
    fun optionRowWidth(optionCount: Int): Dp {
        require(optionCount >= 0)
        if (optionCount == 0) return 0.dp
        return optionRingDiameter * optionCount + optionSpacing * (optionCount - 1)
    }

}

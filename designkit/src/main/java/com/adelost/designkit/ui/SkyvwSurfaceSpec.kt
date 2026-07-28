package com.adelost.designkit.ui

import androidx.compose.runtime.staticCompositionLocalOf

/** Form-factor policy for ONE Skyvw visual language. Screens provide data; this chooses capacity. */
enum class SkyvwSurfaceClass { ROUND, PHONE_COMPACT, PHONE_WIDE }

data class SkyvwSurfaceLayout(
    val surfaceClass: SkyvwSurfaceClass,
    val contentMaxWidthDp: Float,
    val altitudeDialViewport: SkyvwComponentViewportSpec,
)

/** Root-host layout policy. Renderers consume it; they never measure or infer a product runtime. */
val LocalSkyvwSurfaceLayout = staticCompositionLocalOf {
    resolveSkyvwSurfaceLayout(
        shortSideDp = SkyvwUiProfiles.CANON_ROUND_CANVAS_DP,
        round = true,
    )
}

fun resolveSkyvwSurfaceLayout(shortSideDp: Float, round: Boolean): SkyvwSurfaceLayout {
    require(shortSideDp > 0f && shortSideDp.isFinite())
    return resolveSkyvwSurfaceLayout(
        widthDp = shortSideDp,
        heightDp = shortSideDp,
        round = round,
    )
}

/** Resolve capacity from the whole viewport; orientation is layout data, not a product fork. */
fun resolveSkyvwSurfaceLayout(
    widthDp: Float,
    heightDp: Float,
    round: Boolean,
): SkyvwSurfaceLayout {
    require(widthDp > 0f && widthDp.isFinite())
    require(heightDp > 0f && heightDp.isFinite())
    val shortSideDp = minOf(widthDp, heightDp)
    if (round) {
        return SkyvwSurfaceLayout(
            surfaceClass = SkyvwSurfaceClass.ROUND,
            contentMaxWidthDp = shortSideDp,
            altitudeDialViewport = SkyvwComponentViewportSpec(
                sideDp = shortSideDp,
                contentScale = SkyvwContentScale.CanonicalFit(
                    SkyvwUiProfiles.CANON_ROUND_CANVAS_DP,
                ),
            ),
        )
    }
    val compact = widthDp < 600f
    val contentMaxWidthDp = if (compact) 520f else 840f
    val availableDialSideDp = minOf(shortSideDp, contentMaxWidthDp) -
        PHONE_DIAL_HORIZONTAL_INSET_DP * 2f
    val dialSideDp = availableDialSideDp
        .coerceAtLeast(1f)
        .let { if (compact) it else it.coerceAtMost(PHONE_WIDE_DIAL_MAX_DP) }
    return SkyvwSurfaceLayout(
        surfaceClass = if (compact) SkyvwSurfaceClass.PHONE_COMPACT else SkyvwSurfaceClass.PHONE_WIDE,
        contentMaxWidthDp = contentMaxWidthDp,
        altitudeDialViewport = SkyvwComponentViewportSpec(
            sideDp = dialSideDp,
            contentScale = SkyvwContentScale.CanonicalFit(
                SkyvwUiProfiles.CANON_ROUND_CANVAS_DP,
            ),
            boundaryEdge = if (compact) {
                SkyvwViewportBoundaryEdge.BOTTOM
            } else {
                SkyvwViewportBoundaryEdge.END
            },
        ),
    )
}

/** OLED-black breathing room around a width-filling phone instrument. */
private const val PHONE_DIAL_HORIZONTAL_INSET_DP = 16f

/** Wide layouts reserve the remaining width for responsive phone capacity. */
private const val PHONE_WIDE_DIAL_MAX_DP = 420f

/** Keep instrument chrome geometrically stable when Android's body-text font scale changes. */
fun fixedSkyvwUiSp(baseSp: Float, fontScale: Float): Float {
    require(baseSp > 0f && baseSp.isFinite())
    require(fontScale > 0f && fontScale.isFinite())
    return baseSp / fontScale.coerceAtLeast(1f)
}

/** Stable semantic action catalog; icon and callback are renderer bindings, not product policy. */
data class SkyvwSurfaceActionSpec(
    val id: String,
    val label: String,
    val active: Boolean? = null,
)

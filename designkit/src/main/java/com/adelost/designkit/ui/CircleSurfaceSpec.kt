package com.adelost.designkit.ui

import androidx.compose.runtime.staticCompositionLocalOf

/** Form-factor policy for ONE Circle visual language. Screens provide data; this chooses capacity. */
enum class CircleSurfaceClass { ROUND, PHONE_COMPACT, PHONE_WIDE }

data class CircleSurfaceLayout(
    val surfaceClass: CircleSurfaceClass,
    val contentMaxWidthDp: Float,
    val altitudeDialViewport: CircleComponentViewportSpec,
)

/** Root-host layout policy. Renderers consume it; they never measure or infer a product runtime. */
val LocalCircleSurfaceLayout = staticCompositionLocalOf {
    resolveCircleSurfaceLayout(
        shortSideDp = CircleUiProfiles.CANON_ROUND_CANVAS_DP,
        round = true,
    )
}

fun resolveCircleSurfaceLayout(shortSideDp: Float, round: Boolean): CircleSurfaceLayout {
    require(shortSideDp > 0f && shortSideDp.isFinite())
    return resolveCircleSurfaceLayout(
        widthDp = shortSideDp,
        heightDp = shortSideDp,
        round = round,
    )
}

/** Resolve capacity from the whole viewport; orientation is layout data, not a product fork. */
fun resolveCircleSurfaceLayout(
    widthDp: Float,
    heightDp: Float,
    round: Boolean,
): CircleSurfaceLayout {
    require(widthDp > 0f && widthDp.isFinite())
    require(heightDp > 0f && heightDp.isFinite())
    val shortSideDp = minOf(widthDp, heightDp)
    if (round) {
        return CircleSurfaceLayout(
            surfaceClass = CircleSurfaceClass.ROUND,
            contentMaxWidthDp = shortSideDp,
            altitudeDialViewport = CircleComponentViewportSpec(
                sideDp = shortSideDp,
                contentScale = CircleContentScale.CanonicalFit(
                    CircleUiProfiles.CANON_ROUND_CANVAS_DP,
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
    return CircleSurfaceLayout(
        surfaceClass = if (compact) CircleSurfaceClass.PHONE_COMPACT else CircleSurfaceClass.PHONE_WIDE,
        contentMaxWidthDp = contentMaxWidthDp,
        altitudeDialViewport = CircleComponentViewportSpec(
            sideDp = dialSideDp,
            contentScale = CircleContentScale.CanonicalFit(
                CircleUiProfiles.CANON_ROUND_CANVAS_DP,
            ),
            boundaryEdge = if (compact) {
                CircleViewportBoundaryEdge.BOTTOM
            } else {
                CircleViewportBoundaryEdge.END
            },
        ),
    )
}

/** OLED-black breathing room around a width-filling phone instrument. */
private const val PHONE_DIAL_HORIZONTAL_INSET_DP = 16f

/** Wide layouts reserve the remaining width for responsive phone capacity. */
private const val PHONE_WIDE_DIAL_MAX_DP = 420f

/** Keep instrument chrome geometrically stable when Android's body-text font scale changes. */
fun fixedCircleUiSp(baseSp: Float, fontScale: Float): Float {
    require(baseSp > 0f && baseSp.isFinite())
    require(fontScale > 0f && fontScale.isFinite())
    return baseSp / fontScale.coerceAtLeast(1f)
}

/** Stable semantic action catalog; icon and callback are renderer bindings, not product policy. */
data class CircleSurfaceActionSpec(
    val id: String,
    val label: String,
    val active: Boolean? = null,
)

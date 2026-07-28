package com.adelost.designkit.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp

/**
 * Declarative internal sizing for a component hosted by a responsive layout.
 *
 * [FixedAtoms] is the normal responsive rule: the container may gain capacity,
 * while type, strokes and controls keep their approved physical size.
 * [CanonicalFit] treats the component as one designed viewport and scales its
 * complete subtree uniformly. This is appropriate for instruments and visual
 * scenes whose internal proportions are the design, such as the altitude dial.
 */
@Immutable
sealed interface SkyvwContentScale {
    @Immutable
    data object FixedAtoms : SkyvwContentScale

    @Immutable
    data class CanonicalFit(val canonicalSideDp: Float) : SkyvwContentScale {
        init {
            require(canonicalSideDp > 0f && canonicalSideDp.isFinite())
        }
    }

    fun scaleFor(renderedSideDp: Float): Float {
        require(renderedSideDp > 0f && renderedSideDp.isFinite())
        return when (this) {
            FixedAtoms -> 1f
            is CanonicalFit -> renderedSideDp / canonicalSideDp
        }
    }
}

/** Edge where a component's physical display ends and host controls begin. */
enum class SkyvwViewportBoundaryEdge { BOTTOM, END }

/** JSON-like layout data; renderers consume it without inferring a form factor. */
@Immutable
data class SkyvwComponentViewportSpec(
    val sideDp: Float,
    val contentScale: SkyvwContentScale,
    val boundaryEdge: SkyvwViewportBoundaryEdge? = null,
) {
    init {
        require(sideDp > 0f && sideDp.isFinite())
    }
}

/**
 * Hosts one square component at [spec]'s responsive outer size. Canonical
 * scaling is scoped to the subtree by density, so layout, Canvas strokes,
 * text, icons, spacing and touch targets grow together. Siblings and the rest
 * of the phone UI keep their normal atom sizes.
 */
@Composable
fun SkyvwComponentViewport(
    spec: SkyvwComponentViewportSpec,
    modifier: Modifier = Modifier,
    boundaryVisible: Boolean = true,
    content: @Composable () -> Unit,
) {
    val hostDensity = LocalDensity.current
    val scale = spec.contentScale.scaleFor(spec.sideDp)
    Box(modifier = modifier.size(spec.sideDp.dp)) {
        CompositionLocalProvider(
            LocalDensity provides Density(
                density = hostDensity.density * scale,
                fontScale = hostDensity.fontScale,
            ),
        ) {
            Box(Modifier.fillMaxSize()) { content() }
        }
        if (boundaryVisible) {
            when (spec.boundaryEdge) {
                SkyvwViewportBoundaryEdge.BOTTOM -> Box(
                    Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .height(MenuDesign.contourHairline)
                        .background(MenuDesign.ringNeutral),
                )

                SkyvwViewportBoundaryEdge.END -> Box(
                    Modifier
                        .align(Alignment.CenterEnd)
                        .fillMaxHeight()
                        .width(MenuDesign.contourHairline)
                        .background(MenuDesign.ringNeutral),
                )

                null -> Unit
            }
        }
    }
}

package com.adelost.renderkit.list

import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import kotlin.math.abs

const val SKYVW_LIST_EDGE_SCALE = 0.92f

/** Platform-neutral focus curve for lists that carry the Wear fisheye motion
 *  onto rectangular displays. Geometry is expressed in pixels so the same
 *  curve is independent of density and screen size. */
fun skyvwListFocusScale(
    itemCenterPx: Float,
    viewportStartPx: Float,
    viewportEndPx: Float,
    edgeScale: Float = SKYVW_LIST_EDGE_SCALE,
): Float {
    if (viewportEndPx <= viewportStartPx) return 1f
    val viewportCenter = (viewportStartPx + viewportEndPx) / 2f
    val halfViewport = (viewportEndPx - viewportStartPx) / 2f
    val distance = abs(itemCenterPx - viewportCenter)
    val centreProximity = (1f - distance / halfViewport).coerceIn(0f, 1f)
    return edgeScale + (1f - edgeScale) * centreProximity
}

internal fun Modifier.skyvwCenterFocusScale(
    state: LazyListState,
    itemIndex: Int,
): Modifier = graphicsLayer {
    val layout = state.layoutInfo
    val item = layout.visibleItemsInfo.firstOrNull { it.index == itemIndex }
    val scale = if (item == null) {
        1f
    } else {
        skyvwListFocusScale(
            itemCenterPx = item.offset + item.size / 2f,
            viewportStartPx = layout.viewportStartOffset.toFloat(),
            viewportEndPx = layout.viewportEndOffset.toFloat(),
        )
    }
    scaleX = scale
    scaleY = scale
}

package com.adelost.ringkit.ui

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.wear.compose.foundation.lazy.ScalingLazyListState
import com.adelost.designkit.ui.CircleScrollWindow
import com.adelost.designkit.ui.circleScrollPosition

/**
 * The position of Wear's ScalingLazyColumn, on the column's own modifier, so a fisheye list shows where it stands as
 * every other scroll does (docs/decisions/2026-10-12-every-scroll-shows-where-it-is.md). DesignKit knows no Wear
 * list; RingKit already does.
 */
@Composable
fun Modifier.circleScrollPosition(state: ScalingLazyListState): Modifier = circleScrollPosition(
    moved = { state.centerItemIndex to state.centerItemScrollOffset },
    window = { _ -> scalingWindow(state) },
)

/**
 * A fisheye list's window: the share of its items in view, standing as far along as the item at the centre line,
 * and how far past it the list has moved, is through the list. The ends are exact, from whether it can scroll on.
 */
internal fun scalingWindow(state: ScalingLazyListState): CircleScrollWindow? {
    val visible = state.layoutInfo.visibleItemsInfo
    val count = state.layoutInfo.totalItemsCount
    if (count <= 1 || visible.isEmpty() || (!state.canScrollBackward && !state.canScrollForward)) return null
    val share = visible.size.toFloat() / count
    if (share >= 1f) return null
    val itemPx = visible.sumOf { it.unadjustedSize }.toFloat() / visible.size
    val along = when {
        !state.canScrollBackward -> 0f
        !state.canScrollForward -> 1f
        else -> ((state.centerItemIndex + state.centerItemScrollOffset / itemPx) / (count - 1)).coerceIn(0f, 1f)
    }
    val from = along * (1f - share)
    return CircleScrollWindow(from, (from + share).coerceAtMost(1f))
}

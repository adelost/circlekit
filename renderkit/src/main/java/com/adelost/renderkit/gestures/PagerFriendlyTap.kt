package com.adelost.renderkit.gestures

import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.AwaitPointerEventScope
import androidx.compose.ui.input.pointer.PointerInputChange
import androidx.compose.ui.input.pointer.PointerInputScope
import androidx.compose.ui.input.pointer.pointerInput
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Tap/long-press observer for content inside a pager.
 *
 * `detectTapGestures` consumes the initial down event, which prevents the
 * parent pager from ever seeing a vertical swipe. This observer deliberately
 * consumes nothing: a stationary gesture remains a map tap, while a pager
 * that claims a drag cancels the local action.
 */
fun Modifier.pagerFriendlyTap(
    key: Any?,
    onTap: PointerInputScope.(Offset) -> Unit,
    onLongPress: (PointerInputScope.(Offset) -> Unit)? = null,
): Modifier = pointerInput(key, onTap, onLongPress) {
    val pointerScope = this
    awaitEachGesture {
        val down = awaitFirstDown(requireUnconsumed = false)
        val result = if (onLongPress == null) {
            awaitPagerTapResult(down, viewConfiguration.touchSlop)
        } else {
            withTimeoutOrNull(viewConfiguration.longPressTimeoutMillis) {
                awaitPagerTapResult(down, viewConfiguration.touchSlop)
            }
        }
        when (result) {
            is PagerTapResult.Up -> onTap(pointerScope, result.position)
            null ->
                onLongPress?.invoke(pointerScope, down.position)
            PagerTapResult.Cancelled -> Unit
        }
    }
}

private suspend fun AwaitPointerEventScope.awaitPagerTapResult(
    down: PointerInputChange,
    touchSlop: Float,
): PagerTapResult {
    while (true) {
        val change = awaitPointerEvent().changes.firstOrNull { it.id == down.id }
            ?: return PagerTapResult.Cancelled
        when (
            pagerTapSampleDisposition(
                distancePx = (change.position - down.position).getDistance(),
                pressed = change.pressed,
                consumed = change.isConsumed,
                touchSlop = touchSlop,
            )
        ) {
            PagerTapSampleDisposition.WAIT -> Unit
            PagerTapSampleDisposition.UP -> return PagerTapResult.Up(change.position)
            PagerTapSampleDisposition.CANCEL -> return PagerTapResult.Cancelled
        }
    }
}

internal fun pagerTapSampleDisposition(
    distancePx: Float,
    pressed: Boolean,
    consumed: Boolean,
    touchSlop: Float,
): PagerTapSampleDisposition = when {
    consumed || distancePx > touchSlop -> PagerTapSampleDisposition.CANCEL
    !pressed -> PagerTapSampleDisposition.UP
    else -> PagerTapSampleDisposition.WAIT
}

internal enum class PagerTapSampleDisposition { WAIT, UP, CANCEL }

private sealed interface PagerTapResult {
    data class Up(val position: Offset) : PagerTapResult
    data object Cancelled : PagerTapResult
}

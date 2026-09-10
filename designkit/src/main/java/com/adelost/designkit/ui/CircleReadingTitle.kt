package com.adelost.designkit.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import kotlin.math.roundToInt

/** Keep centred ink where it fits; a control reserves only the lines it meets. */
@Composable
internal fun CircleReadingTitle(text: String) {
    val viewport = LocalCircleReadingViewport.current
    val slots = LocalRoundChromeReservation.current
    val density = LocalDensity.current.density
    val style = circleTextStyle(RingTokens.Ink, MenuDesign.titleSize.value,
        FontWeight.Bold, MenuDesign.titleTracking.value, TextAlign.Center)
    val measurer = rememberTextMeasurer()
    var origin by remember { mutableStateOf<Offset?>(null) }
    BoxWithConstraints(Modifier.fillMaxWidth().onGloballyPositioned { origin = it.positionInRoot() }) {
        val widePx = constraints.maxWidth
        val full = measurer.measure(AnnotatedString(text), style,
            constraints = Constraints.fixedWidth(widePx))
        val legacy = viewport?.let {
            roundSafeRectHorizontalInsetsDp(it.width / density, it.height / density,
                it.height / density / 2f,
                (it.height / density - 2f * (MenuDesign.roundTitleTopPadding + MenuDesign.roundTitleHeight).value)
                    .coerceAtLeast(1f), slots, MenuDesign.backTouchTarget.value)
        }
        val fallbackPx = if (viewport != null && legacy != null) {
            ((viewport.width / density - legacy.start - legacy.end - 4f) * density)
                .roundToInt().coerceIn(1, widePx)
        } else widePx
        val narrow = measurer.measure(AnnotatedString(text), style,
            constraints = Constraints.fixedWidth(fallbackPx))
        val relative = if (viewport != null && origin != null) origin!! - viewport.topLeft else null
        fun shift(layout: androidx.compose.ui.text.TextLayoutResult, startPx: Float = 0f): Float? {
            if (relative == null || viewport == null) return null
            val lines = (0 until layout.lineCount).map { line ->
                Rect((relative.x + startPx + layout.getLineLeft(line)) / density,
                    (relative.y + layout.getLineTop(line)) / density,
                    (relative.x + startPx + layout.getLineRight(line)) / density,
                    (relative.y + layout.getLineBottom(line)) / density)
            }
            return readingInkShiftDp(viewport.width / density, viewport.height / density, lines, slots)
        }
        val fullShift = shift(full)
        val chosen = if (fullShift != null) full else narrow
        val narrowStart = (widePx - fallbackPx) / 2f
        val narrowShift = shift(narrow, narrowStart)
        val xDp = fullShift ?: narrowShift?.let { narrowStart / density + it } ?: if (relative != null && legacy != null) {
            (legacy.start - relative.x / density).coerceAtLeast(0f)
        } else (widePx - fallbackPx) / density
        // Both candidates are measured before placement. Holding the taller
        // height keeps later rows and scroll extent stable when a line passes
        // the control; no position/rewrap/height feedback loop.
        Box(Modifier.fillMaxWidth().height(maxOf(full.size.height, narrow.size.height).div(density).dp)) {
            BasicText(text, style = style,
                modifier = Modifier.width(chosen.layoutInput.constraints.maxWidth.div(density).dp)
                    .offset { IntOffset((xDp * density).roundToInt(), 0) })
        }
    }
}

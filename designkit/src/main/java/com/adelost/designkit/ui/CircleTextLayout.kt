package com.adelost.designkit.ui

import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.toSize

/** The text node's full bounds and actual lines, never its ink or a parent's scroll decoration. */
data class CircleTextLayout(
    val text: String,
    val role: CircleTextRole,
    val expectedFontSp: Float,
    val userContent: Boolean,
    val boundsInRoot: Rect,
    val layout: TextLayoutResult,
)

internal class CircleTextLayoutReporter(
    private val text: String,
    private val role: CircleTextRole,
    private val expectedFontSp: Float,
    private val userContent: Boolean,
    private val observer: (CircleTextLayout) -> Unit,
) {
    private var bounds: Rect? = null
    private var layout: TextLayoutResult? = null

    val modifier = Modifier.onGloballyPositioned {
        bounds = Rect(it.positionInRoot(), it.size.toSize())
        report()
    }

    fun laidOut(value: TextLayoutResult) { layout = value; report() }

    private fun report() {
        val bounds = bounds ?: return
        val layout = layout ?: return
        observer(CircleTextLayout(text, role, expectedFontSp, userContent, bounds, layout))
    }
}

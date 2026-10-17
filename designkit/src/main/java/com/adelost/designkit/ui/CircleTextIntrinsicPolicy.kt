package com.adelost.designkit.ui

import androidx.compose.ui.layout.IntrinsicMeasurable
import androidx.compose.ui.layout.IntrinsicMeasureScope
import androidx.compose.ui.layout.Measurable
import androidx.compose.ui.layout.MeasurePolicy
import androidx.compose.ui.layout.MeasureResult
import androidx.compose.ui.layout.MeasureScope
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.sp
import kotlin.math.ceil

/** Intrinsic readers ask the same text plan, without delegating into the constraint subcomposition. */
internal class CircleTextIntrinsicPolicy(
    private val text: String,
    private val style: TextStyle,
    private val trackingSp: Float,
    private val noWrap: Boolean,
    private val maxLines: Int,
    private val measurer: TextMeasurer,
) : MeasurePolicy {
    override fun MeasureScope.measure(measurables: List<Measurable>, constraints: Constraints): MeasureResult {
        val child = measurables.single().measure(constraints)
        return layout(child.width, child.height) { child.placeRelative(0, 0) }
    }

    override fun IntrinsicMeasureScope.minIntrinsicWidth(measurables: List<IntrinsicMeasurable>, height: Int): Int =
        ceil(if (noWrap) width(text, trackingSp) else text.split(Regex("\\s+"))
            .maxOfOrNull { width(it, trackingSp) } ?: 0f).toInt()

    override fun IntrinsicMeasureScope.maxIntrinsicWidth(measurables: List<IntrinsicMeasurable>, height: Int): Int =
        ceil(width(text, trackingSp)).toInt()

    override fun IntrinsicMeasureScope.minIntrinsicHeight(measurables: List<IntrinsicMeasurable>, width: Int): Int = height(width)

    override fun IntrinsicMeasureScope.maxIntrinsicHeight(measurables: List<IntrinsicMeasurable>, width: Int): Int = height(width)

    private fun width(words: String, tracking: Float): Float =
        measurer.measure(words, style.copy(letterSpacing = tracking.sp), softWrap = false)
            .multiParagraph.intrinsics.maxIntrinsicWidth

    private fun height(width: Int): Int {
        val fit = fitCircleRoleText(text, trackingSp, width.toFloat(), noWrap, ::width)
        return measurer.measure(fit.text, style.copy(letterSpacing = fit.trackingSp.sp),
            maxLines = if (noWrap) 1 else maxLines, softWrap = false,
            constraints = Constraints(maxWidth = width.coerceAtLeast(0))).size.height
    }
}

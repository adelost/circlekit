package com.adelost.designkit.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.TextUnit

/** Canvas draws this exact Compose layout, including its typed unit span, and reports the same bounds. */
class CircleMeasuredText internal constructor(
    val layout: TextLayoutResult,
    private val content: CircleTextContent,
    private val role: CircleTextRole,
    private val expectedFontSp: Float,
    private val observer: ((CircleTextLayout) -> Unit)?,
) {
    fun report(boundsInRoot: Rect) {
        observer?.invoke(CircleTextLayout(content.text, role, expectedFontSp,
            false, boundsInRoot, layout))
    }
}

class CircleRoleTextMeasurer internal constructor(
    private val measurer: TextMeasurer,
    private val words: Map<CircleTextRole, TextStyle>,
    private val numerals: Map<CircleTextRole, TextStyle>,
    private val units: Map<CircleTextRole, Pair<TextUnit, Int>>,
    private val observer: ((CircleTextLayout) -> Unit)?,
) {
    fun measure(content: CircleTextContent, role: CircleTextRole, color: Color): CircleMeasuredText {
        require(content is CircleTextValue || role is CircleWordRole) { "NUMBER requires a typed value" }
        val style = (if (content is CircleTextValue) numerals else words).getValue(role).copy(color = color)
        val text = buildAnnotatedString {
            if (content is CircleMeasurement) {
                append(content.value)
                content.unit?.takeIf(String::isNotBlank)?.let {
                    val (size, weight) = units.getValue(role)
                    withStyle(SpanStyle(fontSize = size, fontWeight = FontWeight(weight))) { append(" $it") }
                }
            } else append(content.text)
        }
        return CircleMeasuredText(measurer.measure(text, style, softWrap = false), content, role,
            (if (content is CircleTextValue) numerals else words).getValue(role).fontSize.value, observer)
    }
}

@Composable
fun rememberCircleTextMeasurer(): CircleRoleTextMeasurer {
    val measurer = rememberTextMeasurer()
    val words = CircleTextRole.entries.associateWith { circleRoleTextStyle(it, Color.Unspecified) }
    val numerals = CircleTextRole.entries.associateWith {
        circleRoleTextStyle(it, Color.Unspecified, content = CircleNumerals(""))
    }
    val units = CircleTextRole.entries.associateWith {
        val spec = circleRoleStyle(it)
        circleFixedSp(spec.unitSp) to spec.unitWeight
    }
    val observer = LocalCircleTextLayouts.current
    return remember(measurer, words, numerals, units, observer) {
        CircleRoleTextMeasurer(measurer, words, numerals, units, observer)
    }
}

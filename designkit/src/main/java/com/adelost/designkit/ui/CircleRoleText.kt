package com.adelost.designkit.ui

import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp

@Composable
fun circleRoleStyle(role: CircleTextRole): CircleRoleStyle =
    if (LocalCircleCanonicalText.current || LocalCircleUiProfile.current.surfaceClass == CircleSurfaceClass.ROUND)
        role.watch else role.phone

/** Canvas and measured layouts consume the same role metrics as the text atom. */
@Composable
fun circleRoleTextStyle(role: CircleTextRole, color: Color, textAlign: TextAlign? = null,
    numerals: Boolean = role == CircleTextRole.NUMBER): TextStyle =
    roleTextStyle(circleRoleStyle(role), color, textAlign, numerals || role == CircleTextRole.NUMBER)

/** Role metrics are the only type inputs. Product copy may overflow, never silently lose a word. */
@Composable
fun CircleText(
    text: String,
    role: CircleTextRole,
    color: Color,
    modifier: Modifier = Modifier,
    textAlign: TextAlign? = null,
    userContent: Boolean = false,
    numerals: Boolean = role == CircleTextRole.NUMBER,
    maxLines: Int = Int.MAX_VALUE,
    onTextLayout: ((TextLayoutResult) -> Unit)? = null,
    shadow: androidx.compose.ui.graphics.Shadow? = null,
) {
    val roleStyle = circleRoleStyle(role)
    val numeric = numerals || role == CircleTextRole.NUMBER
    val lineLimit = if (role == CircleTextRole.NUMBER) 1 else if (userContent) maxLines else Int.MAX_VALUE
    val style = roleTextStyle(roleStyle, color, textAlign, numeric).copy(shadow = shadow)
    val measurer = rememberTextMeasurer()
    val layouts = LocalCircleTextLayouts.current
    val reporter = remember(text, role, style.fontSize, userContent, layouts) {
        layouts?.let { CircleTextLayoutReporter(text, role, style.fontSize.value, userContent, it) }
    }
    val tracking = if (numeric) 0f else roleStyle.trackingEm * style.fontSize.value
    val intrinsic = remember(text, style, tracking, role, lineLimit, measurer) {
        CircleTextIntrinsicPolicy(text, style, tracking, role == CircleTextRole.NUMBER, lineLimit, measurer)
    }
    Layout(modifier = modifier, measurePolicy = intrinsic, content = {
      BoxWithConstraints(propagateMinConstraints = true) {
        val fit = remember(text, style, constraints.maxWidth, role) {
            fitCircleRoleText(text, tracking, constraints.maxWidth.toFloat(),
                noWrap = role == CircleTextRole.NUMBER,
                measure = { words, tracking ->
                    measurer.measure(words, style.copy(letterSpacing = tracking.sp), softWrap = false)
                        .multiParagraph.intrinsics.maxIntrinsicWidth
                })
        }
        BasicText(
            text = fit.text,
            modifier = reporter?.modifier ?: Modifier,
            style = style.copy(letterSpacing = fit.trackingSp.sp),
            softWrap = false,
            maxLines = lineLimit,
            overflow = if (userContent) TextOverflow.Ellipsis else TextOverflow.Visible,
            onTextLayout = { layout -> onTextLayout?.invoke(layout); reporter?.laidOut(layout) },
        )
      }
    })
}

/** A reading and its unit share one unbreakable line and one generated role. */
@Composable
fun CircleReading(
    value: String,
    unit: String?,
    color: Color,
    modifier: Modifier = Modifier,
    unitColor: Color = color,
    textAlign: TextAlign? = null,
) {
    val spec = circleRoleStyle(CircleTextRole.NUMBER)
    val unitSize = circleFixedSp(spec.unitSp)
    val text = buildAnnotatedString {
        append(value)
        unit?.takeIf(String::isNotBlank)?.let {
            withStyle(SpanStyle(color = unitColor, fontSize = unitSize, fontWeight = FontWeight(spec.unitWeight))) {
                append(" $it")
            }
        }
    }
    val layouts = LocalCircleTextLayouts.current
    val style = roleTextStyle(spec, color, textAlign, true)
    val reporter = remember(text, style.fontSize, layouts) {
        layouts?.let { CircleTextLayoutReporter(text.text, CircleTextRole.NUMBER, style.fontSize.value, false, it) }
    }
    BasicText(text, modifier.then(reporter?.modifier ?: Modifier), style = style, softWrap = false,
        maxLines = 1, overflow = TextOverflow.Visible, onTextLayout = { reporter?.laidOut(it) })
}

@Composable
private fun roleTextStyle(spec: CircleRoleStyle, color: Color, align: TextAlign?, numerals: Boolean): TextStyle = TextStyle(
    color = color,
    fontFamily = GraphiteType.forContent(numerals),
    fontWeight = FontWeight(spec.weight),
    fontSize = circleFixedSp(spec.sp),
    letterSpacing = if (numerals || spec.trackingEm == 0f) 0.sp else circleFixedSp(spec.sp * spec.trackingEm),
    textAlign = align ?: TextAlign.Unspecified,
    platformStyle = PlatformTextStyle(includeFontPadding = false),
)

internal data class CircleRoleTextFit(val text: String, val trackingSp: Float)

/** Prefer the largest one-line tracking. When zero cannot fit, wrap only between whole words. */
internal fun fitCircleRoleText(
    text: String,
    trackingSp: Float,
    widthPx: Float,
    noWrap: Boolean,
    measure: (String, Float) -> Float,
): CircleRoleTextFit {
    if (noWrap || measure(text, trackingSp) <= widthPx) return CircleRoleTextFit(text, trackingSp)
    if ('\n' !in text && measure(text, 0f) <= widthPx) {
        var low = 0f
        var high = trackingSp
        repeat(16) {
            val middle = (low + high) / 2
            if (measure(text, middle) <= widthPx) low = middle else high = middle
        }
        return CircleRoleTextFit(text, low)
    }
    val wrapped = text.split('\n').joinToString("\n") { paragraph ->
        val lines = mutableListOf<String>()
        var line = ""
        paragraph.split(Regex("\\s+")).filter(String::isNotEmpty).forEach { word ->
            val next = if (line.isEmpty()) word else "$line $word"
            if (line.isNotEmpty() && measure(next, trackingSp) > widthPx) {
                lines += line
                line = word
            } else line = next
        }
        (lines + line).joinToString("\n")
    }
    return CircleRoleTextFit(wrapped, trackingSp)
}

package com.adelost.designkit.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.max

@Immutable
data class CircleDiscSecondaryLabel(
    val text: String,
    val color: Color,
)

/** Pure visual data shared by passive instruments and interactive value discs. */
@Immutable
data class CircleDiscArtworkSpec(
    val primaryValue: String,
    val unit: String? = null,
    val primaryColor: Color,
    val unitColor: Color = primaryColor,
    val background: Color = Color.Transparent,
    val contour: Color,
    /** A secondary value owns the complete rim or none of it; this is not progress. */
    val secondaryRimColor: Color? = null,
    val secondaryLabel: CircleDiscSecondaryLabel? = null,
)

@Immutable
data class CircleDiscTextBudget(
    val maximumPrimarySp: Float,
    val minimumPrimarySp: Float = 9f,
    val stepSp: Float = 0.5f,
    val unitScale: Float = 0.52f,
    val horizontalFraction: Float = 0.76f,
) {
    init {
        require(maximumPrimarySp >= minimumPrimarySp && minimumPrimarySp > 0f)
        require(stepSp > 0f)
        require(unitScale in 0f..1f)
        require(horizontalFraction in 0f..1f)
    }
}

@Immutable
data class CircleDiscTextFit(
    val primarySp: Float,
    val unitSp: Float,
    val measuredWidthPx: Float,
    val fits: Boolean,
)

/**
 * Fits by measured glyph width. Character count is deliberately absent: `1111`
 * and `1008.1` are not the same width in the product typeface.
 */
fun fitCircleDiscText(
    primaryValue: String,
    unit: String?,
    availableWidthPx: Float,
    budget: CircleDiscTextBudget,
    measureWidthPx: (text: String, sizeSp: Float) -> Float,
): CircleDiscTextFit {
    require(availableWidthPx > 0f)
    var primarySp = budget.maximumPrimarySp
    while (true) {
        val unitSp = primarySp * budget.unitScale
        val primaryWidth = measureWidthPx(primaryValue, primarySp)
        val unitWidth = unit?.takeIf(String::isNotBlank)?.let {
            measureWidthPx(" ", unitSp) + measureWidthPx(it, unitSp)
        } ?: 0f
        val measured = primaryWidth + unitWidth
        val fits = measured <= availableWidthPx
        if (fits || primarySp <= budget.minimumPrimarySp) {
            return CircleDiscTextFit(primarySp, unitSp, measured, fits)
        }
        primarySp = max(budget.minimumPrimarySp, primarySp - budget.stepSp)
    }
}

/**
 * Layout boundary between Compose constraints and the strict text fitter.
 * A list row outside the round chord can legitimately be measured at zero;
 * that means no visible content, not malformed text input.
 */
internal fun fitCircleDiscTextForBounds(
    primaryValue: String,
    unit: String?,
    containerWidthPx: Float,
    containerHeightPx: Float,
    budget: CircleDiscTextBudget,
    measureWidthPx: (text: String, sizeSp: Float) -> Float,
): CircleDiscTextFit? {
    if (
        !containerWidthPx.isFinite() || containerWidthPx <= 0f ||
        !containerHeightPx.isFinite() || containerHeightPx <= 0f
    ) {
        return null
    }
    val availableWidthPx = containerWidthPx * budget.horizontalFraction
    if (!availableWidthPx.isFinite() || availableWidthPx <= 0f) return null
    return fitCircleDiscText(
        primaryValue = primaryValue,
        unit = unit,
        availableWidthPx = availableWidthPx,
        budget = budget,
        measureWidthPx = measureWidthPx,
    )
}

/**
 * Shared, gesture-free disc artwork. Callers may place it in an app-owned dial;
 * only the artwork and measured fitting stay authoritative here.
 */
@Composable
fun CircleDiscArtwork(
    spec: CircleDiscArtworkSpec,
    modifier: Modifier = Modifier,
    textBudget: CircleDiscTextBudget = CircleDiscTextBudget(maximumPrimarySp = 18f),
) {
    val density = LocalDensity.current
    val fontScale = density.fontScale
    val measurer = rememberTextMeasurer()
    BoxWithConstraints(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .clip(CircleShape)
            .background(spec.background)
            .circleRingContour(spec.secondaryRimColor ?: spec.contour),
    ) {
        val containerWidthPx = with(density) { maxWidth.toPx() }
        val containerHeightPx = with(density) { maxHeight.toPx() }
        val fit = remember(
            spec.primaryValue,
            spec.unit,
            containerWidthPx,
            containerHeightPx,
            textBudget,
            fontScale,
        ) {
            fitCircleDiscTextForBounds(
                primaryValue = spec.primaryValue,
                unit = spec.unit,
                containerWidthPx = containerWidthPx,
                containerHeightPx = containerHeightPx,
                budget = textBudget,
                measureWidthPx = { text, sizeSp ->
                    measurer.measure(
                        text = AnnotatedString(text),
                        style = TextStyle(
                            fontFamily = GraphiteType.Sans,
                            fontWeight = FontWeight.Bold,
                            fontSize = fixedCircleUiSp(sizeSp, fontScale).sp,
                            fontFeatureSettings = GraphiteType.TABULAR_NUMERALS,
                        ),
                        maxLines = 1,
                    ).size.width.toFloat()
                },
            )
        } ?: return@BoxWithConstraints
        Row(verticalAlignment = Alignment.CenterVertically) {
            BasicText(
                text = spec.primaryValue,
                style = discTextStyle(spec.primaryColor, fit.primarySp, fontScale, FontWeight.Bold),
                maxLines = 1,
                overflow = TextOverflow.Clip,
            )
            spec.unit?.takeIf(String::isNotBlank)?.let { unit ->
                BasicText(
                    text = " $unit",
                    style = discTextStyle(spec.unitColor, fit.unitSp, fontScale, FontWeight.SemiBold),
                    maxLines = 1,
                    overflow = TextOverflow.Clip,
                )
            }
        }
        spec.secondaryLabel?.let { secondary ->
            BasicText(
                text = secondary.text,
                style = discTextStyle(secondary.color, 7f, fontScale, FontWeight.Bold),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth(0.72f)
                    .padding(bottom = 4.dp),
            )
        }
    }
}

/** Passive wrapper for a value instrument; contains no tap or progress channel. */
@Composable
fun CircleInstrumentDisc(
    spec: CircleDiscArtworkSpec,
    contentDescription: String,
    modifier: Modifier = Modifier,
    diameter: Dp = MenuDesign.backDiameter,
    textBudget: CircleDiscTextBudget = CircleDiscTextBudget(maximumPrimarySp = 18f),
) {
    CircleDiscArtwork(
        spec = spec,
        textBudget = textBudget,
        modifier = modifier
            .size(diameter)
            .semantics { this.contentDescription = contentDescription },
    )
}

private fun discTextStyle(
    color: Color,
    sizeSp: Float,
    fontScale: Float,
    weight: FontWeight,
): TextStyle = TextStyle(
    color = color,
    fontFamily = GraphiteType.Sans,
    fontSize = fixedCircleUiSp(sizeSp, fontScale).sp,
    fontWeight = weight,
    textAlign = TextAlign.Center,
    fontFeatureSettings = GraphiteType.TABULAR_NUMERALS,
)

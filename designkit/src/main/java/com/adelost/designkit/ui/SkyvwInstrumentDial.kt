package com.adelost.designkit.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.adelost.designkit.R
import com.adelost.designkit.measurement.MeasurementText
import kotlin.math.min

/**
 * The approved altitude instrument, shared by the real Wear face and every
 * phone composition. Callers resolve sensor and safety policy into this data;
 * this file is the single place where that data becomes geometry and type.
 */
@Immutable
data class SkyvwInstrumentDialSpec(
    val altitude: MeasurementText,
    val motionLabel: String,
    val altitudeColor: Color,
    val segments: List<SkyvwDialSegment> = emptyList(),
    val altitudeDialDirection: SkyvwAltitudeDialDirection = SkyvwAltitudeDialDirection.DEFAULT,
    val simulatorLabel: String? = null,
    val simulatorIcon: ImageVector? = null,
    val reachLabel: String? = null,
    val reachColor: Color = RingTokens.Dim,
    /** One scale for every radial bar: altitude, NORTH, WIND and HOME. */
    val barWeightScale: Float = 1f,
) {
    init {
        require(barWeightScale > 0f && barWeightScale.isFinite())
    }
}

@Immutable
data class SkyvwDialSegment(
    val color: Color,
    val emphasis: SkyvwDialSegmentEmphasis,
    val fillFraction: Float = 1f,
    val fillFromStart: Boolean = false,
) {
    init {
        require(fillFraction in 0f..1f)
    }
}

enum class SkyvwDialSegmentEmphasis { HIDDEN, CURRENT, VISIBLE }

/** Barlow Semi Condensed is part of the instrument atom, not an app-local theme choice. */
val SkyvwInstrumentFamily: FontFamily = FontFamily(
    Font(R.font.barlow_semi_condensed_semibold, weight = FontWeight.SemiBold),
    Font(R.font.barlow_semi_condensed_bold, weight = FontWeight.Bold),
)

@Composable
fun SkyvwInstrumentDial(
    spec: SkyvwInstrumentDialSpec,
    modifier: Modifier = Modifier,
    dimmed: Boolean = false,
    directionalContent: @Composable BoxScope.() -> Unit = {},
) {
    val ringStroke = canonicalDialDp(
        SkyvwRadialBarDesign.CanonicalInstrumentStrokeDp * spec.barWeightScale,
    )
    Box(
        modifier = modifier.background(Color.Black),
    ) {
        Canvas(Modifier.fillMaxSize()) {
            drawSkyvwAltitudeRing(spec.segments, spec.altitudeDialDirection, ringStroke)
        }
        directionalContent()
        SkyvwDialCenterStack(
            spec = spec,
            dimmed = dimmed,
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = canonicalDialDp(SkyvwDialDesign.CenterHorizontalPaddingDp)),
        )
    }
}

/**
 * Pins the dominant altitude's visible glyph mass to the exact dial centre.
 *
 * Motion and reach are annotations around the hero, not members of one
 * vertically-centred column. Centring their combined height pushed the hero
 * down even when the motion label was intentionally empty; the displacement
 * also scaled up on responsive phone canvases. Keeping all three children in
 * one measured layout preserves their gaps without letting optional copy move
 * the safety-critical number. A small font-specific optical correction
 * compensates for Barlow's asymmetric line-box whitespace.
 */
@Composable
private fun SkyvwDialCenterStack(
    spec: SkyvwInstrumentDialSpec,
    dimmed: Boolean,
    modifier: Modifier = Modifier,
) {
    val motionHeroGap = canonicalDialDp(SkyvwDialDesign.MotionHeroGapDp)
    val reachOffsetY = canonicalDialDp(SkyvwDialDesign.ReachOffsetYDp)
    val heroOpticalOffsetY = canonicalDialDp(SkyvwDialDesign.HeroOpticalOffsetYDp)
    Layout(
        content = {
            SkyvwMotionLabel(spec)
            SkyvwAltitudeReadout(
                altitude = spec.altitude,
                dimmed = dimmed,
                color = spec.altitudeColor,
            )
            if (spec.reachLabel != null) {
                BasicText(
                    text = spec.reachLabel,
                    style = instrumentStyle(
                        color = spec.reachColor,
                        fontSize = canonicalDialSp(SkyvwDialDesign.ReachSp),
                        weight = FontWeight.SemiBold,
                        tracking = 0.08.em,
                    ),
                )
            } else {
                Spacer(Modifier.size(0.dp))
            }
        },
        modifier = modifier,
    ) { measurables, constraints ->
        val loose = constraints.copy(minWidth = 0, minHeight = 0)
        val motion = measurables[0].measure(loose)
        val hero = measurables[1].measure(loose)
        val reach = measurables[2].measure(loose)
        val placement = skyvwDialCenterStackPlacement(
            containerHeight = constraints.maxHeight,
            motionHeight = motion.height,
            heroHeight = hero.height,
            reachHeight = reach.height,
            motionHeroGap = motionHeroGap.roundToPx(),
            reachOffsetY = reachOffsetY.roundToPx(),
            heroOpticalOffsetY = heroOpticalOffsetY.roundToPx(),
        )
        layout(constraints.maxWidth, constraints.maxHeight) {
            motion.place(
                x = (constraints.maxWidth - motion.width) / 2,
                y = placement.motionY,
            )
            hero.place(x = 0, y = placement.heroY)
            reach.place(
                x = (constraints.maxWidth - reach.width) / 2,
                y = placement.reachY,
            )
        }
    }
}

data class SkyvwDialCenterStackPlacement(
    val motionY: Int,
    val heroY: Int,
    val reachY: Int,
)

fun skyvwDialCenterStackPlacement(
    containerHeight: Int,
    motionHeight: Int,
    heroHeight: Int,
    reachHeight: Int,
    motionHeroGap: Int,
    reachOffsetY: Int,
    heroOpticalOffsetY: Int,
): SkyvwDialCenterStackPlacement {
    require(containerHeight >= 0)
    require(motionHeight >= 0 && heroHeight >= 0 && reachHeight >= 0)
    val heroY = ((containerHeight - heroHeight) / 2 + heroOpticalOffsetY)
        .coerceIn(0, (containerHeight - heroHeight).coerceAtLeast(0))
    return SkyvwDialCenterStackPlacement(
        motionY = (heroY - motionHeroGap - motionHeight).coerceAtLeast(0),
        heroY = heroY,
        reachY = (heroY + heroHeight + reachOffsetY)
            .coerceIn(0, (containerHeight - reachHeight).coerceAtLeast(0)),
    )
}

@Composable
private fun SkyvwMotionLabel(spec: SkyvwInstrumentDialSpec) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(
            canonicalDialDp(SkyvwDialDesign.MotionItemGapDp),
            Alignment.CenterHorizontally,
        ),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        spec.simulatorLabel?.let { simulator ->
            BasicText(
                text = simulator,
                style = instrumentStyle(
                    color = RingTokens.Dim,
                    fontSize = canonicalDialSp(SkyvwDialDesign.MotionSp),
                    weight = FontWeight.SemiBold,
                    tracking = 0.02.em,
                ),
            )
            spec.simulatorIcon?.let { icon ->
                Image(
                    imageVector = icon,
                    contentDescription = null,
                    colorFilter = ColorFilter.tint(RingTokens.Dim),
                    modifier = Modifier.size(canonicalDialDp(SkyvwDialDesign.MotionIconDp)),
                )
            }
            BasicText(
                text = "•",
                style = instrumentStyle(
                    color = RingTokens.Dim,
                    fontSize = canonicalDialSp(SkyvwDialDesign.MotionSp),
                    weight = FontWeight.SemiBold,
                ),
            )
        }
        BasicText(
            text = spec.motionLabel,
            style = instrumentStyle(
                color = RingTokens.Dim,
                fontSize = canonicalDialSp(SkyvwDialDesign.MotionSp),
                weight = FontWeight.SemiBold,
                tracking = 0.02.em,
                textAlign = TextAlign.Center,
            ),
        )
    }
}

/**
 * The hero whole-number remains optically centred. Decimal, unit and optional
 * sign hang outside it and can therefore never move the dominant digits.
 */
@Composable
private fun SkyvwAltitudeReadout(altitude: MeasurementText, dimmed: Boolean, color: Color) {
    val negative = altitude.value.startsWith('-') && altitude.value.any { it in '1'..'9' }
    val unsigned = altitude.value.removePrefix("-").removePrefix("−")
    val wholeValue = unsigned.substringBefore('.')
    val decimal = unsigned.substringAfter('.', missingDelimiterValue = "")
    val heroSize = canonicalDialSp(skyvwAltitudeHeroSizeSp(wholeValue.length))
    val sideGap = canonicalDialDp(SkyvwDialDesign.AltitudeSideGapDp)

    Layout(
        content = {
            BasicText(
                text = wholeValue,
                style = instrumentStyle(
                    color = color,
                    fontSize = heroSize,
                    weight = FontWeight.SemiBold,
                    tracking = (-0.01).em,
                ),
            )
            Column(horizontalAlignment = Alignment.Start) {
                BasicText(
                    text = decimal.takeIf(String::isNotEmpty)?.let { ".$it" }.orEmpty(),
                    style = instrumentStyle(
                        color = color.copy(alpha = 0.72f),
                        fontSize = canonicalDialSp(SkyvwDialDesign.DecimalSp),
                        weight = FontWeight.Bold,
                    ),
                )
                BasicText(
                    text = altitude.unit,
                    style = instrumentStyle(
                        color = color.copy(alpha = 0.72f),
                        fontSize = canonicalDialSp(SkyvwDialDesign.UnitSp),
                        weight = FontWeight.Bold,
                    ),
                )
            }
            BasicText(
                text = if (negative) "−" else "",
                style = instrumentStyle(
                    color = color,
                    fontSize = heroSize,
                    weight = FontWeight.SemiBold,
                    tracking = (-0.01).em,
                ),
            )
        },
        modifier = Modifier.alpha(if (dimmed) 0.30f else 1f),
    ) { measurables, constraints ->
        val loose = constraints.copy(minWidth = 0, minHeight = 0)
        val whole = measurables[0].measure(loose)
        val side = measurables[1].measure(loose)
        val minus = measurables[2].measure(loose)
        val placement = skyvwAltitudeReadoutPlacement(
            containerWidth = constraints.maxWidth,
            wholeWidth = whole.width,
            sideGapWidth = sideGap.roundToPx(),
            minusWidth = minus.width,
        )
        val height = whole.height
        val sideY = ((height - side.height) / 2).coerceAtLeast(0)
        layout(constraints.maxWidth, height) {
            if (negative) minus.place(placement.minusX, 0)
            whole.place(placement.wholeX, 0)
            side.place(placement.sideX, sideY)
        }
    }
}

data class SkyvwAltitudeReadoutPlacement(
    val minusX: Int,
    val wholeX: Int,
    val sideX: Int,
)

fun skyvwAltitudeReadoutPlacement(
    containerWidth: Int,
    wholeWidth: Int,
    sideGapWidth: Int,
    minusWidth: Int,
): SkyvwAltitudeReadoutPlacement {
    val wholeX = ((containerWidth - wholeWidth) / 2).coerceAtLeast(0)
    return SkyvwAltitudeReadoutPlacement(
        minusX = wholeX - minusWidth,
        wholeX = wholeX,
        sideX = wholeX + wholeWidth + sideGapWidth,
    )
}

/**
 * Normal live altitude can legitimately have five or more digits. Keep its
 * visual width close to the established four-digit hero instead of changing
 * the measurement into km/kft merely to make the typography fit.
 */
fun skyvwAltitudeHeroSizeSp(digitCount: Int): Float = when {
    digitCount <= 3 -> SkyvwDialDesign.HeroSp
    digitCount == 4 -> SkyvwDialDesign.FourDigitHeroSp
    else -> SkyvwDialDesign.FourDigitHeroSp * 4f / digitCount
}

private fun DrawScope.drawSkyvwAltitudeRing(
    segments: List<SkyvwDialSegment>,
    direction: SkyvwAltitudeDialDirection,
    ringStroke: Dp,
) {
    if (segments.isEmpty()) return
    val center = Offset(size.width / 2f, size.height / 2f)
    val radius = min(size.width, size.height) * SkyvwDialDesign.AltitudeRingRadiusFraction
    val ringStrokePx = ringStroke.toPx()
    val arcTopLeft = Offset(center.x - radius, center.y - radius)
    val arcSize = Size(radius * 2f, radius * 2f)
    segments.forEachIndexed { index, segment ->
        val alpha = when (segment.emphasis) {
            SkyvwDialSegmentEmphasis.HIDDEN -> 0f
            SkyvwDialSegmentEmphasis.CURRENT -> 1f
            SkyvwDialSegmentEmphasis.VISIBLE -> SkyvwDialDesign.VisibleSegmentAlpha
        }
        // Progress is already expressed by colour, alpha and partial fill.
        // Changing radial weight on CURRENT made neighbouring bars and compass
        // cues look as if they belonged to different component families.
        val stroke = ringStrokePx
        val fill = if (segment.emphasis == SkyvwDialSegmentEmphasis.CURRENT) {
            segment.fillFraction
        } else {
            1f
        }
        val arc = skyvwAltitudeDialArc(
            index = index,
            segmentCount = segments.size,
            fillFraction = fill,
            fillFromStart = segment.fillFromStart,
            direction = direction,
        )
        if (fill > 0f) {
            drawArc(
                color = segment.color.copy(alpha = alpha),
                startAngle = arc.startAngleDeg,
                sweepAngle = arc.sweepAngleDeg,
                useCenter = false,
                topLeft = arcTopLeft,
                size = arcSize,
                style = Stroke(width = stroke, cap = StrokeCap.Butt),
            )
        }
    }
}

@Composable
private fun canonicalDialDp(value: Float): Dp =
    (value * LocalSkyvwUiProfile.current.atomScale).dp

@Composable
private fun canonicalDialSp(value: Float): TextUnit =
    (value * LocalSkyvwUiProfile.current.atomScale / LocalDensity.current.fontScale).sp

private fun instrumentStyle(
    color: Color,
    fontSize: TextUnit,
    weight: FontWeight,
    tracking: TextUnit = TextUnit.Unspecified,
    textAlign: TextAlign = TextAlign.Unspecified,
): TextStyle = TextStyle(
    color = color,
    fontFamily = SkyvwInstrumentFamily,
    fontSize = fontSize,
    fontWeight = weight,
    fontFeatureSettings = GraphiteType.TABULAR_NUMERALS,
    letterSpacing = tracking,
    textAlign = textAlign,
)

/** Approved 192 dp geometry expressed directly in canonical dp/sp. */
object SkyvwDialDesign {
    const val AltitudeRingRadiusFraction = 0.475f
    const val SegmentGapDeg = 3f
    const val VisibleSegmentAlpha = 0.55f
    const val CenterHorizontalPaddingDp = 22.5f
    const val MotionHeroGapDp = 1.5f
    const val MotionItemGapDp = 2.25f
    const val MotionIconDp = 7.5f
    const val MotionSp = 7.5f
    const val HeroSp = 55.5f
    const val FourDigitHeroSp = 54f
    /** Barlow's visible digit mass sits 2.75 canonical dp below its line box. */
    const val HeroOpticalOffsetYDp = -2.75f
    const val DecimalSp = 13.5f
    const val UnitSp = 11.25f
    const val AltitudeSideGapDp = 6f
    const val ReachSp = 8.25f
    const val ReachOffsetYDp = -3f
}

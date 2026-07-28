package com.adelost.designkit.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * THE ring contour — the one drawing behind every icon ring: start-screen
 * actions, menu launchers and settings rows. An edge arc on a
 * circle-clipped box; the clip takes the outer half of the stroke, leaving
 * the approved hairline. Colour is the caller's single decision (neutral at
 * rest, [MenuDesign.ringActive] for an ON toggle). The host box MUST carry
 * `clip(CircleShape)` — without the clip the full stroke renders and the
 * ring reads twice as heavy.
 */
fun Modifier.circleRingContour(
    color: Color,
    strokeWidth: Dp = MenuDesign.iconRingStroke,
): Modifier = drawBehind {
    drawArc(
        color = color,
        startAngle = -90f,
        sweepAngle = 360f,
        useCenter = false,
        style = Stroke(width = strokeWidth.toPx()),
    )
}

/** Resolved visual state for a label-free circular action. */
@Immutable
data class CircleActionDiscChrome(
    val fill: Color,
    val contour: Color,
    val scale: Float,
)

/**
 * One feedback law for icon-only and value-only circles. A circle without an
 * external label must never paint [circleLabelProgress] across its glyph or
 * value; the surface and contour answer instead.
 */
fun circleActionDiscChrome(
    enabled: Boolean,
    active: Boolean,
    pressed: Boolean,
    scrim: Boolean,
    activeContour: Color = MenuDesign.ringActive,
): CircleActionDiscChrome = CircleActionDiscChrome(
    fill = when {
        pressed -> RingTokens.ProgressSurface.copy(alpha = 0.78f)
        scrim -> RingTokens.ProgressSurface.copy(alpha = 0.58f)
        else -> Color.Transparent
    },
    contour = when {
        !enabled -> RingTokens.Off
        pressed -> RingTokens.OutlineStrong
        active -> activeContour
        else -> MenuDesign.ringNeutral
    },
    scale = if (pressed) MenuDesign.backPressScale else 1f,
)

/**
 * THE label-free icon action. Product icons stay in [RING_ICON_CATALOG]; this
 * atom owns the circle, hold feedback and active contour on every host.
 */
@Composable
fun CircleIconDisc(
    icon: ImageVector,
    contentDescription: String,
    /**
     * The verb the centre cue prints while the control is held.
     *
     * Stated, never derived from [contentDescription]: a screen reader wants a
     * sentence ("Place the cutaway point here") and the cue wants a verb
     * ("PLACE"). While this defaulted to the description, writing a proper
     * accessibility string was a layout regression — the sentence wrapped
     * across the middle of the watch face — and the trap stayed hidden for as
     * long as every caller happened to pass something short.
     */
    actionLabel: String,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
    diameter: Dp = MenuDesign.iconRingDiameter,
    iconSize: Dp = MenuDesign.iconSize,
    active: Boolean = false,
    enabled: Boolean = true,
    /** Defaults to whatever the surface declared: over imagery a transparent
     *  rest fill leaves the glyph fighting the tile behind it. */
    scrim: Boolean = LocalChromeOverImagery.current,
    iconTint: Color? = null,
    accent: CircleAccent = ringIconAccent(icon),
    choiceState: CircleChoiceState? = null,
    timing: CircleActionTiming = CircleActionTiming.DELIBERATE,
) {
    val feedback = rememberCircleActionFeedbackState()
    val activeContour = circleBrandColor()
    val cue = rememberCircleActionCueController(
        icon = icon,
        label = actionLabel,
        timing = timing,
        pressed = feedback.pressed,
    )
    val chrome = circleActionDiscChrome(
        enabled = enabled,
        active = active,
        pressed = feedback.pressed,
        scrim = scrim,
        activeContour = activeContour,
    )
    val scale by animateFloatAsState(chrome.scale, label = "circleIconDiscPress")
    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .size(diameter)
            .scale(scale)
            .clip(CircleShape)
            .background(chrome.fill)
            .circleRingContour(chrome.contour)
            .circleSafeTap(
                feedback = feedback,
                enabled = enabled,
                holdMs = timing.holdMs,
                onTap = {
                    cue.confirm()
                    onTap()
                },
            )
            .semantics { this.contentDescription = contentDescription },
    ) {
        CircleStyledIcon(
            style = ringIconStyle(icon, accent),
            contentDescription = contentDescription,
            tintOverride = iconTint,
            modifier = Modifier.size(iconSize),
        )
        choiceState?.let { state ->
            CircleChoiceIndicator(
                state = state,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(bottom = 4.dp)
                    .size(width = (state.optionCount * 5 + 5).dp, height = 7.dp),
            )
        }
    }
}

/**
 * THE label-free value action, used by host/dev selectors. Its value remains
 * readable throughout the short hold; feedback lives on the disc, never as a
 * tiny progress stripe through the number.
 */
@Composable
fun CircleValueDisc(
    value: String,
    contentDescription: String,
    /** The verb the centre cue prints. Stated, never derived — see
     *  [CircleIconDisc]'s parameter of the same name for what derivation cost. */
    actionLabel: String,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
    diameter: Dp = MenuDesign.backDiameter,
    valueSize: TextUnit = MenuDesign.textActionSize,
    active: Boolean = false,
    enabled: Boolean = true,
    timing: CircleActionTiming = CircleActionTiming.DELIBERATE,
) {
    val fontScale = LocalDensity.current.fontScale
    val feedback = rememberCircleActionFeedbackState()
    val activeContour = circleBrandColor()
    val cue = rememberCircleActionCueController(
        icon = RingIcons.Gauge,
        label = actionLabel,
        timing = timing,
        pressed = feedback.pressed,
    )
    val chrome = circleActionDiscChrome(
        enabled = enabled,
        active = active,
        pressed = feedback.pressed,
        scrim = false,
        activeContour = activeContour,
    )
    val scale by animateFloatAsState(chrome.scale, label = "circleValueDiscPress")
    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .size(diameter)
            .scale(scale)
            .clip(CircleShape)
            .background(chrome.fill)
            .circleRingContour(chrome.contour)
            .circleSafeTap(
                feedback = feedback,
                enabled = enabled,
                holdMs = timing.holdMs,
                onTap = {
                    cue.confirm()
                    onTap()
                },
            )
            .semantics { this.contentDescription = contentDescription },
    ) {
        BasicText(
            text = value,
            style = TextStyle(
                color = when {
                    !enabled -> RingTokens.Off
                    active || feedback.pressed -> RingTokens.Ink
                    else -> RingTokens.Dim
                },
                fontSize = fixedCircleUiSp(valueSize.value, fontScale).sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
            ),
            maxLines = 1,
        )
    }
}

/** The shared circle action used verbatim by Wear launchers and phone navigation. */
@Composable
fun CircleIconRing(
    icon: ImageVector,
    label: String,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
    diameter: Dp = MenuDesign.launcherDiameter,
    active: Boolean? = null,
    accent: CircleAccent = ringIconAccent(icon),
    fontFamily: FontFamily? = null,
    labelSize: TextUnit = 9.5.sp,
    /** Optional value rendered under the icon. Data-source rings use this
     * variant instead of maintaining a second ring/label implementation. */
    centerValue: String? = null,
    /** Optional semantic contour (for example source health). Navigation
     * rings keep deriving their contour from [accent] and [active]. */
    contourColor: Color? = null,
    iconRotationDegrees: Float = 0f,
    /** Finite-state position for a cycling action. Boolean state still lives
     * in [active]; this compact rail/dot mark distinguishes ordered choices. */
    choiceState: CircleChoiceState? = null,
    /** Optional second line under the label — a consequence or state note
     *  (e.g. "Counts until deleted") that must be visible BEFORE a
     *  confirming tap, not only in a result screen. Null renders nothing
     *  extra, so every existing ring is unaffected. */
    sub: String? = null,
    timing: CircleActionTiming = CircleActionTiming.DELIBERATE,
) {
    val fontScale = LocalDensity.current.fontScale
    val feedback = rememberCircleActionFeedbackState()
    val activeContour = circleBrandColor()
    val cue = rememberCircleActionCueController(
        icon = icon,
        label = label,
        timing = timing,
        pressed = feedback.pressed,
    )
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = modifier) {
        Box(
            modifier = Modifier
                .size(diameter)
                .clip(CircleShape)
                .circleSafeTap(
                    feedback = feedback,
                    holdMs = timing.holdMs,
                    onTap = {
                        cue.confirm()
                        onTap()
                    },
                ),
            contentAlignment = Alignment.Center,
        ) {
            // [contourColor] (data-state rings: source health) keeps the
            // full-stroke circle because that ring IS the datum; everything
            // else draws the one shared contour — neutral at rest,
            // ringActive only for an ON toggle.
            if (contourColor != null) {
                Canvas(Modifier.size(diameter)) {
                    drawCircle(
                        color = contourColor,
                        radius = size.minDimension / 2f - 2.dp.toPx(),
                        style = Stroke(width = RingMetrics.StrokeWidth.toPx()),
                    )
                }
            } else {
                Box(
                    Modifier
                        .size(diameter)
                        .circleRingContour(if (active == true) activeContour else MenuDesign.ringNeutral),
                )
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                // Full-strength tint like the start screen's actions (Mattias
                // 2026-07-21: "samma ljusstyrka som på huvudsidan"); state
                // lives in the ring, never in a dimmed icon.
                CircleStyledIcon(
                    style = ringIconStyle(icon, accent),
                    contentDescription = label,
                    tintOverride = RingTokens.Ink.takeIf { centerValue != null },
                    modifier = Modifier
                        .size(
                            diameter * if (centerValue != null) {
                                RingMetrics.StatIconFraction
                            } else {
                                RingMetrics.IconFraction
                            },
                        )
                        .rotate(iconRotationDegrees),
                )
                centerValue?.let { value ->
                    BasicText(
                        text = value,
                        style = TextStyle(
                            color = RingTokens.Ink,
                            fontSize = fixedCircleUiSp(MenuDesign.statValueSize.value, fontScale).sp,
                            fontFamily = fontFamily,
                            fontWeight = FontWeight.Black,
                            textAlign = TextAlign.Center,
                        ),
                        maxLines = 1,
                    )
                }
            }
            choiceState?.let { state ->
                CircleChoiceIndicator(
                    state = state,
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 5.dp)
                        .size(width = (state.optionCount * 5 + 5).dp, height = 7.dp),
                )
            }
        }
        BasicText(
            text = label,
            style = TextStyle(
                color = RingTokens.Dim,
                fontSize = fixedCircleUiSp(labelSize.value, fontScale).sp,
                fontFamily = fontFamily,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
                textAlign = TextAlign.Center,
            ),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 4.dp),
        )
        sub?.let {
            BasicText(
                text = it,
                style = TextStyle(
                    color = RingTokens.Dim,
                    fontSize = fixedCircleUiSp(labelSize.value * 0.72f, fontScale).sp,
                    fontFamily = fontFamily,
                    textAlign = TextAlign.Center,
                ),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 1.dp),
            )
        }
    }
}

/** Shared back artwork. Gesture owners can provide tap or hold semantics without forking the visual. */
@Composable
fun CircleBackDisc(
    enabled: Boolean,
    pressed: Boolean,
    scrim: Boolean,
    diameter: Dp,
    modifier: Modifier = Modifier,
    chevronSize: Dp = 18.dp,
    pressScale: Float = 0.93f,
    scrimColor: Color = RingTokens.ProgressSurface.copy(alpha = 0.62f),
) {
    val dip by animateFloatAsState(if (pressed) pressScale else 1f, label = "circleBackPress")
    Box(
        modifier = modifier
            .size(diameter)
            .scale(dip)
            .clip(CircleShape)
            .then(if (scrim) Modifier.background(scrimColor) else Modifier)
            .border(
                MenuDesign.contourStroke,
                when {
                    !enabled -> RingTokens.Off
                    pressed -> RingTokens.OutlineStrong
                    else -> RingTokens.Outline
                },
                CircleShape,
            ),
        contentAlignment = Alignment.Center,
    ) {
        Image(
            imageVector = RingIcons.ChevronLeft,
            contentDescription = "Back",
            colorFilter = ColorFilter.tint(
                when {
                    !enabled -> RingTokens.NeutralRing
                    pressed -> RingTokens.Ink
                    else -> RingTokens.Dim
                },
            ),
            modifier = Modifier.size(chevronSize),
        )
    }
}

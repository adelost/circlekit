package com.adelost.designkit.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.text.font.FontFamily
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
    /** Optional asynchronous work on the same contour as the action. */
    labelProgress: CircleLabelProgress? = null,
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
    val progressSweep = rememberCircleFeedbackSweep(
        progress = labelProgress,
        pressed = feedback.pressed,
        pressHoldMs = timing.holdMs,
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
            .circleProgressContour(progressSweep.takeIf { it > 0f }, circleBrandColor())
            .circleSafeTap(
                feedback = feedback,
                enabled = enabled,
                // A trailing icon is its own action, never also its parent row.
                consumeDown = true,
                holdMs = timing.holdMs,
                label = contentDescription,
                onTap = {
                    cue.confirm()
                    onTap()
                },
            ),
    ) {
        CircleStyledIcon(
            style = ringIconStyle(icon, accent),
            // The labelled action parent owns this exact name.
            contentDescription = null,
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
                label = contentDescription,
                onTap = {
                    cue.confirm()
                    onTap()
                },
            ),
    ) {
        CircleDiscArtwork(
            spec = CircleDiscArtworkSpec(
                primaryValue = value,
                primaryColor = when {
                    !enabled -> RingTokens.Off
                    active || feedback.pressed -> RingTokens.Ink
                    else -> RingTokens.Dim
                },
                contour = Color.Transparent,
            ),
            textBudget = CircleDiscTextBudget(
                maximumPrimarySp = valueSize.value,
                minimumPrimarySp = minOf(9f, valueSize.value),
            ),
            modifier = Modifier.fillMaxSize(),
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
    enabled: Boolean = true,
    semanticColor: Color? = null,
) {
    val feedback = rememberCircleActionFeedbackState()
    val cue = rememberCircleActionCueController(
        icon = icon,
        label = label,
        timing = timing,
        pressed = feedback.pressed,
    )
    CircleRingRowActionContent {
        CircleIconRingFrame(
            icon = icon,
            label = label,
            modifier = modifier,
            diameter = diameter,
            active = active,
            accent = accent,
            semanticColor = semanticColor,
            fontFamily = fontFamily,
            labelSize = labelSize,
            centerValue = centerValue,
            contourColor = contourColor,
            iconRotationDegrees = iconRotationDegrees,
            choiceState = choiceState,
            sub = sub,
            enabled = enabled,
            gestureModifier = Modifier.circleSafeTap(
                feedback = feedback,
                enabled = enabled,
                holdMs = timing.holdMs,
                label = circleRingRowAccessibilityLabel(label, sub.orEmpty()),
                onTap = {
                    cue.confirm()
                    onTap()
                },
            ),
        )
    }
}

/**
 * The same icon-ring artwork with continuous press/release semantics.
 * Progress, activation and release are one gesture contract; callers cannot
 * accidentally layer a decorative no-op hold over a different real action.
 */
@Composable
fun CirclePressIconRing(
    icon: ImageVector,
    label: String,
    enabled: Boolean,
    active: Boolean,
    onBegin: () -> Boolean,
    onRelease: () -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier,
    diameter: Dp = MenuDesign.launcherDiameter,
    accent: CircleAccent = ringIconAccent(icon),
    fontFamily: FontFamily? = null,
    labelSize: TextUnit = 9.5.sp,
    centerValue: String? = null,
    sub: String? = null,
    holdMs: Long = MenuDesign.tapHoldMs,
) {
    val feedback = rememberCircleActionFeedbackState()
    val timing = if (holdMs == 0L) CircleActionTiming.IMMEDIATE else CircleActionTiming.DELIBERATE
    rememberCircleActionCueController(
        ordinaryTap = false,
        icon = icon,
        label = label,
        timing = timing,
        pressed = feedback.pressed && !active,
        holdDurationMs = holdMs,
    )
    CircleIconRingFrame(
        icon = icon,
        label = label,
        modifier = modifier,
        diameter = diameter,
        active = active,
        accent = accent,
        fontFamily = fontFamily,
        labelSize = labelSize,
        centerValue = centerValue,
        contourColor = null,
        iconRotationDegrees = 0f,
        choiceState = null,
        sub = sub,
        enabled = enabled,
        gestureModifier = Modifier.circlePressLifecycle(
            feedback = feedback,
            enabled = enabled,
            holdMs = holdMs,
            onBegin = onBegin,
            onRelease = onRelease,
            onCancel = onCancel,
        ),
    )
}

/** Shared back artwork. Gesture owners can provide tap or hold semantics without forking the visual. */
@Composable
fun CircleBackDisc(
    enabled: Boolean,
    pressed: Boolean,
    scrim: Boolean,
    diameter: Dp,
    contentDescription: String?,
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
            contentDescription = contentDescription,
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

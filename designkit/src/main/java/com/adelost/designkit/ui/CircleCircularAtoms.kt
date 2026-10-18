package com.adelost.designkit.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
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
import androidx.compose.ui.graphics.PathEffect
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
 *
 * [suggested] is a control the product proposed rather than one a person chose: its ring is drawn solid in the dimmed
 * weight of its own colour ([circleSuggestedContour]). Style C (skydive-altimeter docs/plans/2026-10-17-skyvw-style-c.md,
 * "Osäkert är dämpat, aldrig streckat"): uncertainty is dimmed, never dashed. It stays apart from a disabled control,
 * whose ring is the off grey, because it keeps its own colour.
 */
fun Modifier.circleRingContour(
    color: Color,
    strokeWidth: Dp = MenuDesign.iconRingStroke,
    suggested: Boolean = false,
): Modifier = drawBehind {
    drawArc(
        color = circleSuggestedContour(color, suggested),
        startAngle = -90f,
        sweepAngle = 360f,
        useCenter = false,
        style = Stroke(width = strokeWidth.toPx()),
    )
}

/** A contour's colour, dimmed when the product only suggests the control: the decision apart from the drawing. */
fun circleSuggestedContour(color: Color, suggested: Boolean): Color =
    if (suggested) color.copy(alpha = color.alpha * MenuDesign.suggestedContourShare) else color

/** Resolved visual state for a label-free circular action. */
@Immutable
data class CircleActionDiscChrome(
    val fill: Color,
    val contour: Color,
    val scale: Float,
    val iconTint: Color? = null,
)

/**
 * One feedback law for icon-only and value-only circles. A circle without an
 * external label must never paint [circleLabelProgress] across its glyph or
 * value; the surface and contour answer instead.
 *
 * At rest a disc is drawn as [circleDiscLook] says, in its kind's [tones]. Over a picture it keeps its dark disc and a
 * neutral edge, and only the icon speaks its kind (style C, the plan's "Knapp över en bild").
 */
fun circleActionDiscChrome(
    enabled: Boolean,
    active: Boolean,
    pressed: Boolean,
    scrim: Boolean,
    tones: CircleTones = CircleStyleTokens.NeutralTones,
    iconTint: Color? = null,
): CircleActionDiscChrome {
    // An action disc that is not lit is at rest, not off; only an unavailable one wears off.
    val look = circleDiscLook(operable = true, active = if (!enabled) false else active.takeIf { it }, tones = tones)
    return CircleActionDiscChrome(
        fill = when {
            pressed -> RingTokens.ProgressSurface.copy(alpha = 0.78f)
            scrim -> RingTokens.ProgressSurface.copy(alpha = 0.58f)
            else -> look.ground
        },
        contour = when {
            pressed -> RingTokens.OutlineStrong
            scrim && enabled && !active -> MenuDesign.ringNeutral
            else -> requireNotNull(look.contour)
        },
        scale = if (pressed) MenuDesign.backPressScale else 1f,
        // Unavailable actions must not look enabled through a semantic/custom tint.
        iconTint = if (enabled) iconTint else look.icon,
    )
}

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
    /** For a switch: the answer [icon] and [actionLabel] name, drawn as dots in the cue. */
    cueChoiceState: CircleChoiceState? = null,
    /** Optional asynchronous work on the same contour as the action. */
    labelProgress: CircleLabelProgress? = null,
    timing: CircleActionTiming = CircleActionTiming.DELIBERATE,
    /** See [CircleActionEffect]: the default fails towards the lock, which is why it may have one. */
    effect: CircleActionEffect = CircleActionEffect.ACTS,
) {
    val feedback = rememberCircleActionFeedbackState()
    val tones = circleAccentTones(accent)
    // ONE resolution, handed to the cue and to the gate. Nothing downstream sees the declaration.
    val resolved = circleResolvedTiming(timing, effect = effect)
    val cue = rememberCircleActionCueController(
        icon = icon,
        label = actionLabel,
        timing = resolved,
        pressed = feedback.pressed,
        choiceState = cueChoiceState,
    )
    val chrome = circleActionDiscChrome(
        enabled = enabled,
        active = active,
        pressed = feedback.pressed,
        scrim = scrim,
        tones = tones,
        iconTint = iconTint,
    )
    val progressSweep = rememberCircleFeedbackSweep(progress = labelProgress, feedback = feedback)
    val scale by animateFloatAsState(chrome.scale, label = "circleIconDiscPress")
    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .size(diameter)
            .scale(scale)
            .clip(CircleShape)
            .background(chrome.fill)
            .circleRingContour(chrome.contour)
            .circleProgressContour(progressSweep, circleBrandColor())
            .circleSafeTap(
                feedback = feedback,
                enabled = enabled,
                // A trailing icon is its own action, never also its parent row.
                consumeDown = true,
                timing = resolved,
                label = contentDescription,
                // The contour above is this disc's own cue, and it merges the press with asynchronous
                // work on one circle. Row 215 leaves the gesture's copy off rather than drawing two.
                cue = CirclePressCue.OWNED,
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
            tintOverride = chrome.iconTint,
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
    valueRole: CircleTextRole = CircleTextRole.NUMBER,
    active: Boolean = false,
    enabled: Boolean = true,
    timing: CircleActionTiming = CircleActionTiming.DELIBERATE,
    /** See [CircleActionEffect]: the default fails towards the lock, which is why it may have one. */
    effect: CircleActionEffect = CircleActionEffect.ACTS,
) {
    val feedback = rememberCircleActionFeedbackState()
    val resolved = circleResolvedTiming(timing, effect = effect)
    val cue = rememberCircleActionCueController(
        icon = RingIcons.Gauge,
        label = actionLabel,
        timing = resolved,
        pressed = feedback.pressed,
    )
    val chrome = circleActionDiscChrome(
        enabled = enabled,
        active = active,
        pressed = feedback.pressed,
        scrim = false,
    )
    val scale by animateFloatAsState(chrome.scale, label = "circleValueDiscPress")
    val textStyle = circleRoleTextStyle(valueRole, RingTokens.Ink)
    val textWidth = androidx.compose.ui.text.rememberTextMeasurer().measure(value, textStyle, softWrap = false).size.width
    val density = androidx.compose.ui.platform.LocalDensity.current
    val fittedDiameter = maxOf(diameter, with(density) { ((textWidth + 2) / CIRCLE_DISC_TEXT_WIDTH_FRACTION).toDp() })
    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .size(fittedDiameter)
            .scale(scale)
            .clip(CircleShape)
            .background(chrome.fill)
            .circleRingContour(chrome.contour)
            .circleSafeTap(
                feedback = feedback,
                enabled = enabled,
                timing = resolved,
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
                primaryRole = valueRole,
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
    /** Optional value rendered under the icon. Data-source rings use this
     * variant instead of maintaining a second ring/label implementation. */
    centerValue: String? = null,
    /** The state of [centerValue] (for example source health): the scale's colour on the value. The disc and the
     * icon keep the ring's kind, so a state has no other way onto a ring (style C). Null reads as ink. */
    centerValueColor: Color? = null,
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
    /** See [CircleActionEffect]: the default fails towards the lock, which is why it may have one. */
    effect: CircleActionEffect = CircleActionEffect.ACTS,
    enabled: Boolean = true,
    semanticColor: Color? = null,
    /** The product proposed this, a person did not choose it: the ring is
     *  dimmed in its own colour, never dashed ([circleSuggestedContour]). */
    suggested: Boolean = false,
    centerUnit: String? = null,
    centerNumerals: Boolean = true,
    subColor: Color? = null,
) {
    val feedback = rememberCircleActionFeedbackState()
    val resolved = circleResolvedTiming(timing, effect = effect)
    val cue = rememberCircleActionCueController(
        icon = icon,
        label = label,
        timing = resolved,
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
            centerValue = centerValue,
            centerValueColor = centerValueColor,
            centerUnit = centerUnit,
            centerNumerals = centerNumerals,
            subColor = subColor,
            iconRotationDegrees = iconRotationDegrees,
            choiceState = choiceState,
            sub = sub,
            enabled = enabled,
            suggested = suggested,
            gestureModifier = Modifier.circleSafeTap(
                feedback = feedback,
                enabled = enabled,
                timing = resolved,
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
    centerValue: String? = null,
    sub: String? = null,
    /** No millisecond: the kind IS the declaration, and this used to read it back off a duration. */
    timing: CircleResolvedTiming = circleResolvedTiming(CircleActionTiming.DELIBERATE),
) {
    val feedback = rememberCircleActionFeedbackState()
    rememberCircleActionCueController(
        ordinaryTap = false,
        icon = icon,
        label = label,
        timing = timing,
        pressed = feedback.pressed && !active,
    )
    CircleIconRingFrame(
        icon = icon,
        label = label,
        modifier = modifier,
        diameter = diameter,
        active = active,
        accent = accent,
        centerValue = centerValue,
        iconRotationDegrees = 0f,
        choiceState = null,
        sub = sub,
        enabled = enabled,
        gestureModifier = Modifier.circlePressLifecycle(
            feedback = feedback,
            enabled = enabled,
            timing = timing,
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
    /**
     * HOW MUCH OF ITS GATE THE FINGER ON THIS DISC HAS SPENT, read in the draw phase.
     *
     * No default, because this is the one thing the disc could not say. It has always answered a touch
     * with a dip and a brighter contour, which is a BOOLEAN: the wearer is told a finger landed and
     * never told how much of the wait is left, so a press about to be refused looks exactly like one
     * about to act until the moment it does not. That is the silence row 212 measured, on the back
     * button of every screen (row 215).
     *
     * A hold-guarded back reports its progress to the caller's centre overlay instead, because the
     * finger covers the disc there; it passes a zero here and says so.
     */
    holdProgress: () -> Float,
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
            // The same renderer the gesture's own cue uses, so a back ring cannot answer a press in a
            // different language from every other gated control: one stroke inside the contour, in the
            // product's accent, nothing at all at zero.
            .circleHoldCue(holdProgress, circleBrandColor())
            // The same contour as every icon ring beside it, so the escape reads as one of the circles and not a
            // heavier one (Mattias 2026-10-09: "cirklarna ... Det ska ju vara konsekvent"). It drew a full 1 dp
            // border in a brighter grey: 5 px against 3 px at his 320 dp preview.
            .circleRingContour(
                when {
                    !enabled -> RingTokens.Off
                    pressed -> RingTokens.OutlineStrong
                    else -> MenuDesign.ringNeutral
                },
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

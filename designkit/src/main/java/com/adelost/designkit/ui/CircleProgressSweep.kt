package com.adelost.designkit.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.runtime.withFrameMillis

/**
 * Declarative work feedback for a label. `null` means idle; an explicit
 * [Indeterminate] value means work is running without an honest percentage.
 * Keeping those states distinct prevents a screen from inventing a fake 0%.
 */
sealed interface CircleLabelProgress {
    data object Indeterminate : CircleLabelProgress

    data class Determinate(val fraction: Float) : CircleLabelProgress {
        init {
            require(fraction.isFinite() && fraction in 0f..1f) {
                "Label progress must be a finite fraction in 0..1"
            }
        }
    }
}

internal sealed interface CircleLabelFeedbackMode {
    data object Idle : CircleLabelFeedbackMode
    data class Press(val holdMs: Long) : CircleLabelFeedbackMode {
        init {
            require(holdMs >= 0L) { "Press feedback duration cannot be negative" }
        }
    }
    data object Indeterminate : CircleLabelFeedbackMode
    data class Determinate(val fraction: Float) : CircleLabelFeedbackMode
}

internal fun resolveCircleLabelFeedbackMode(
    progress: CircleLabelProgress?,
    pressed: Boolean,
    pressHoldMs: Long,
): CircleLabelFeedbackMode {
    require(pressHoldMs >= 0L) { "Press feedback duration cannot be negative" }
    return when (progress) {
        is CircleLabelProgress.Determinate -> CircleLabelFeedbackMode.Determinate(progress.fraction)
        CircleLabelProgress.Indeterminate -> CircleLabelFeedbackMode.Indeterminate
        null -> if (pressed) CircleLabelFeedbackMode.Press(pressHoldMs) else CircleLabelFeedbackMode.Idle
    }
}

/**
 * The shared, layout-free left-to-right wash used for short tap feedback and
 * deliberate holds. Keeping the primitive in designkit lets any shared
 * component use the same motion language without depending on a host UI.
 */
fun Modifier.circleProgressSweep(
    progress: Float?,
    color: Color = RingTokens.ProgressArc.copy(alpha = 0.30f),
): Modifier = drawBehind {
    val clipped = progress?.coerceIn(0f, 1f) ?: 0f
    if (clipped > 0f) {
        drawRect(color = color, size = Size(size.width * clipped, size.height))
    }
}

/**
 * The circular equivalent of [circleProgressSweep]. Rows that already own an
 * icon ring put action/work feedback on that contour instead of painting a
 * rectangular wash through their label.
 */
fun Modifier.circleProgressContour(
    progress: Float?,
    color: Color = RingTokens.ProgressArc,
): Modifier = drawBehind {
    val clipped = progress?.coerceIn(0f, 1f) ?: 0f
    if (clipped > 0f) {
        drawArc(
            color = color,
            startAngle = -90f,
            sweepAngle = 360f * clipped,
            useCenter = false,
            style = Stroke(
                width = MenuDesign.iconRingStroke.toPx(),
                cap = StrokeCap.Round,
            ),
        )
    }
}

/** One animation law feeds both label-only actions and circular row actions. */
@Composable
internal fun rememberCircleFeedbackSweep(
    progress: CircleLabelProgress?,
    pressed: Boolean,
    pressHoldMs: Long,
): Float {
    val sweep = remember { Animatable(0f) }
    val mode = resolveCircleLabelFeedbackMode(progress, pressed, pressHoldMs)
    LaunchedEffect(mode) {
        when (mode) {
            // Determinate input already is the measured truth (including
            // HoldFillBox's frame-by-frame hold fraction). Smoothing every
            // sample with another fixed tween makes long holds visibly lag
            // and short holds finish early.
            is CircleLabelFeedbackMode.Determinate -> sweep.snapTo(mode.fraction)
            CircleLabelFeedbackMode.Indeterminate -> while (true) {
                val remaining = (1f - sweep.value).coerceIn(0f, 1f)
                if (remaining > 0f) {
                    sweep.animateTo(
                        1f,
                        tween(
                            (LABEL_WORK_SWEEP_MS * remaining).toInt().coerceAtLeast(1),
                            easing = LinearEasing,
                        ),
                    )
                }
                sweep.snapTo(0f)
            }
            is CircleLabelFeedbackMode.Press -> {
                val remaining = (1f - sweep.value).coerceIn(0f, 1f)
                sweep.animateTo(
                    1f,
                    tween(
                        (mode.holdMs * remaining).toInt().coerceAtLeast(1),
                        easing = LinearEasing,
                    ),
                )
            }
            CircleLabelFeedbackMode.Idle -> {
                sweep.animateTo(0f, tween(LABEL_RELEASE_MS, easing = LinearEasing))
            }
        }
    }
    return sweep.value
}

/**
 * The one action-progress renderer for text labels. It merges the standard
 * [MenuDesign.tapHoldMs] safe-tap delay with optional asynchronous work
 * supplied as data.
 * Async state wins once work starts, making press → checking → download one
 * continuous visual language without a screen-owned progress composable.
 */
@Composable
fun Modifier.circleLabelProgress(
    progress: CircleLabelProgress? = null,
    pressed: Boolean = false,
    pressHoldMs: Long = MenuDesign.tapHoldMs,
    color: Color? = null,
): Modifier {
    val sweep = rememberCircleFeedbackSweep(
        progress = progress,
        pressed = pressed,
        pressHoldMs = pressHoldMs,
    )
    return circleProgressSweep(
        progress = sweep.takeIf { it > 0f },
        color = color ?: circleBrandColor().copy(alpha = 0.30f),
    )
}

private const val LABEL_RELEASE_MS = 90
private const val LABEL_WORK_SWEEP_MS = 900

/**
 * WHAT A HELD CONTROL SHOWS WHILE IT IS BEING HELD, and the one law that says it.
 *
 * Row 212 measured the hole this closes, on the instrument rather than by reading: a finger resting on a
 * run seat changed 0 pixels, against a calibration the same frame read CAN see (the seat's own active
 * ring, 438), and the kit's haptic sits on the success path only. So a press released before the gate was
 * a dead seat, not a seat that says hold: the wearer is told nothing while the 200 ms passes and nothing
 * when it is refused. Row 215, lsrc:0's call under Mattias's UX handover of 2026-09-19.
 *
 * It lives beside the other two progress renderers because it IS one: the same fraction, drawn on the
 * control's own bounds by the gesture that owns the gate, so a control cannot be built that takes a hold
 * and forgets to say so. What was there before was a convention, and every hand-rolled control that never
 * heard it drew nothing.
 *
 * THE BRUSH MINIMUM is the other half. A sleeve, a graze and a passing thumb all put a finger on the
 * glass for a few milliseconds, and a cue that answers those flickers on a wrist all day. Nothing is
 * drawn for the first [CIRCLE_CUE_BRUSH_MIN_MS]; the cue then APPEARS AT THE FRACTION IT HAS ACTUALLY
 * SPENT rather than fading in from zero, because the ring means how much of the gate is gone and a ring
 * that starts at zero at 40 ms says something false about the finger that is already there.
 *
 * A control with no gate ([holdMs] at or under the brush minimum, which is what IMMEDIATE is) draws
 * nothing: there is no wait to report, and a ring that completes in the same frame is noise.
 */
/**
 * HOW MUCH OF THE GATE A PRESS HAS SPENT after [elapsedMs], which is all the cue ever draws.
 *
 * THE BRUSH MINIMUM is the first half. A sleeve, a graze and a passing thumb all put a finger on the
 * glass for a few milliseconds, and a cue that answers those flickers on a wrist all day; nothing is
 * drawn for the first [CIRCLE_CUE_BRUSH_MIN_MS]. The cue then APPEARS AT THE FRACTION IT HAS ACTUALLY
 * SPENT rather than fading in from zero, because the ring means how much of the gate is gone and a ring
 * starting at zero at 40 ms says something false about the finger that is already there.
 *
 * A control with no gate (a [holdMs] at or under the brush minimum, which is what IMMEDIATE is) draws
 * nothing at any length: there is no wait to report, and a ring that completes in the same frame is
 * noise. The caller never has to know that; asking here answers it.
 */
fun circleHoldCueFraction(elapsedMs: Long, holdMs: Long): Float = when {
    holdMs <= CIRCLE_CUE_BRUSH_MIN_MS -> 0f
    elapsedMs < CIRCLE_CUE_BRUSH_MIN_MS -> 0f
    else -> (elapsedMs.toFloat() / holdMs.toFloat()).coerceIn(0f, 1f)
}

/**
 * Which of the two shapes a control's own bounds take, MEASURED rather than declared.
 *
 * The alternative is a parameter every caller can get wrong in the direction this row exists to end.
 * Bounds square within [CIRCLE_CUE_ROUND_ASPECT] are a disc or a seat and take the RING, which is the
 * contour this kit already draws for work on the same circle; anything wider is a row and takes the
 * left-to-right FILL, which is the wash this kit already draws under a row's label. Neither shape is
 * new. What is new is that the gesture draws one of them without being asked.
 */
internal fun circleHoldCueIsRing(width: Float, height: Float): Boolean =
    width <= height * CIRCLE_CUE_ROUND_ASPECT

/**
 * The one clock the cue runs on: real frames, and [circleHoldCueFraction] deciding what they mean.
 *
 * It reads the elapsed time off the frame clock rather than handing a tween a duration, so the cue and
 * the GATE cannot drift: the gate times the finger and so does this. It also stops at 1 and it only
 * runs while a finger is down, which is what makes the cue cost nothing on a face that is only being
 * looked at.
 */
internal suspend fun runCircleHoldCue(hold: Animatable<Float, *>, pressed: Boolean, holdMs: Long) {
    if (!pressed) {
        if (hold.value > 0f) hold.animateTo(0f, tween(CIRCLE_CUE_RELEASE_MS, easing = LinearEasing))
        return
    }
    if (holdMs <= CIRCLE_CUE_BRUSH_MIN_MS) return
    val downAtMs = withFrameMillis { it }
    while (true) {
        val fraction = circleHoldCueFraction(withFrameMillis { it } - downAtMs, holdMs)
        if (fraction > 0f) hold.snapTo(fraction)
        if (fraction >= 1f) return
    }
}

/**
 * The cue itself, on the gated control's OWN bounds, in the shape [circleHoldCueIsRing] measures.
 *
 * It draws NOTHING at zero, which is what makes it free on a face that is only being looked at.
 */
internal fun Modifier.circleHoldCue(progress: () -> Float, color: Color): Modifier = drawBehind {
    val fraction = progress().coerceIn(0f, 1f)
    if (fraction <= 0f) return@drawBehind
    if (circleHoldCueIsRing(size.width, size.height)) {
        drawArc(
            color = color,
            startAngle = -90f,
            sweepAngle = 360f * fraction,
            useCenter = false,
            style = Stroke(width = MenuDesign.iconRingStroke.toPx(), cap = StrokeCap.Round),
        )
    } else {
        drawRect(color = color.copy(alpha = color.alpha * 0.30f), size = Size(size.width * fraction, size.height))
    }
}

/** Who paints the press cue for a gated control. */
enum class CirclePressCue {
    /** The gesture paints it on its own bounds. Every control that does not say otherwise. */
    AUTO,

    /**
     * The COMPONENT paints it, from [CircleActionFeedbackState.holdProgress] or from its own sweep.
     *
     * For a control that already draws the wait somewhere the gesture's bounds are not: a row whose
     * LABEL carries the wash while the gesture sits on the whole row, or a disc that merges the press
     * with asynchronous work on one contour. Saying this is how a component keeps ONE cue; a component
     * that forgets it now draws TWO, which is a defect anyone can see, and the silence row 212 measured
     * was one nobody could.
     */
    OWNED,
}

/** Below this, a finger has only brushed the glass and the control says nothing (row 215). */
const val CIRCLE_CUE_BRUSH_MIN_MS = 40L

/** Bounds this square are a disc or a seat and take the ring; wider ones take the fill. */
private const val CIRCLE_CUE_ROUND_ASPECT = 1.2f

private const val CIRCLE_CUE_RELEASE_MS = 90

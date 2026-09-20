package com.adelost.designkit.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
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

/**
 * ASYNCHRONOUS WORK ON A LABEL, which is the only thing a component still times for itself.
 *
 * The press used to be a fourth case here, with its own duration, and that is what row 215 removed: a
 * control drew the wait from a millisecond value it was handed while the GATE counted a different one.
 * There is no press duration on this side any more. The press arrives as a fraction the gesture has
 * already measured ([CircleActionFeedbackState.holdProgress]), so the two cannot be handed different
 * numbers because there is only one number.
 */
internal sealed interface CircleLabelWorkMode {
    /** Nothing of the component's own: the one cue is the press the gesture is timing. */
    data object None : CircleLabelWorkMode
    data object Indeterminate : CircleLabelWorkMode
    data class Determinate(val fraction: Float) : CircleLabelWorkMode
}

internal fun circleLabelWorkMode(progress: CircleLabelProgress?): CircleLabelWorkMode = when (progress) {
    is CircleLabelProgress.Determinate -> CircleLabelWorkMode.Determinate(progress.fraction)
    CircleLabelProgress.Indeterminate -> CircleLabelWorkMode.Indeterminate
    null -> CircleLabelWorkMode.None
}

/**
 * ONE NUMBER FOR ONE CUE: the work this control is doing, or else the gate its finger is spending.
 *
 * Work wins while there is work, which is the shipped behaviour: press, then checking, then downloading
 * is one continuous sweep rather than two renderers handing over. [work] keeps winning while its own
 * release ramp is still running, so a sweep that has just finished does not jump to a finger's zero.
 */
internal fun circleOneCueFraction(work: Float, holdProgress: Float, hasWork: Boolean): Float =
    if (hasWork || work > 0f) work else holdProgress

/**
 * The shared, layout-free left-to-right wash used for short tap feedback and
 * deliberate holds. Keeping the primitive in designkit lets any shared
 * component use the same motion language without depending on a host UI.
 */
fun Modifier.circleProgressSweep(
    /**
     * Read in the DRAW phase, on purpose. A fraction read in composition is the fraction of the frame
     * BEFORE this one: the gesture writes it from a frame callback, and that write lands after the
     * frame's composition has been scheduled. Measured 2026-09-20: a wash reading it in composition
     * first appeared at 64 ms of finger against the gesture's own cue at 48, one frame late all the
     * way to the gate. It also keeps a press from recomposing the whole control sixty times a second.
     */
    progress: () -> Float,
    color: Color = RingTokens.ProgressArc.copy(alpha = 0.30f),
): Modifier = drawBehind {
    val clipped = progress().coerceIn(0f, 1f)
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
    /** See [circleProgressSweep]: read in the draw phase, so the ring is never a frame behind. */
    progress: () -> Float,
    color: Color = RingTokens.ProgressArc,
): Modifier = drawBehind {
    val clipped = progress().coerceIn(0f, 1f)
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

/**
 * THE ONE FRACTION A COMPONENT DRAWS, whether it is doing work or keeping a wearer waiting.
 *
 * [holdProgress] comes from the gesture that owns the gate. A component that paints its own cue
 * ([CirclePressCue.OWNED]) reads it rather than timing a second animation beside the one deciding
 * whether the press counts: two clocks for one wait is how a cue and a gate drift apart, and the cue
 * always loses, because a tween cannot start until the press has reached composition two frames later.
 */
@Composable
internal fun rememberCircleFeedbackSweep(
    progress: CircleLabelProgress?,
    feedback: CircleActionFeedbackState?,
): () -> Float {
    val work = remember { Animatable(0f) }
    val mode = circleLabelWorkMode(progress)
    LaunchedEffect(mode) {
        when (mode) {
            // Determinate input already is the measured truth (including
            // HoldFillBox's frame-by-frame hold fraction). Smoothing every
            // sample with another fixed tween makes long holds visibly lag
            // and short holds finish early.
            is CircleLabelWorkMode.Determinate -> work.snapTo(mode.fraction)
            CircleLabelWorkMode.Indeterminate -> while (true) {
                val remaining = (1f - work.value).coerceIn(0f, 1f)
                if (remaining > 0f) {
                    work.animateTo(
                        1f,
                        tween(
                            (LABEL_WORK_SWEEP_MS * remaining).toInt().coerceAtLeast(1),
                            easing = LinearEasing,
                        ),
                    )
                }
                work.snapTo(0f)
            }
            CircleLabelWorkMode.None -> {
                work.animateTo(0f, tween(LABEL_RELEASE_MS, easing = LinearEasing))
            }
        }
    }
    val hasWork = mode != CircleLabelWorkMode.None
    return remember(work, feedback, hasWork) {
        { circleOneCueFraction(work.value, feedback?.holdProgress ?: 0f, hasWork) }
    }
}

/**
 * The one action-progress renderer for text labels. It merges the standard
 * [MenuDesign.wornTouchCostMs] worn-host delay with optional asynchronous work
 * supplied as data.
 * Async state wins once work starts, making press → checking → download one
 * continuous visual language without a screen-owned progress composable.
 */
@Composable
fun Modifier.circleLabelProgress(
    progress: CircleLabelProgress? = null,
    /**
     * The gesture whose wait this label draws, or explicit null when nothing is being held here.
     *
     * Required-but-nullable, the same contract as circleSafeTap's [label]: every caller states who owns
     * the press it is painting. It takes the STATE and not a duration on purpose. A duration on this
     * side is a second clock, and a defaulted one decides for controls nobody has thought about, which
     * is how Link shipped a phone row that drew half a second and committed in one millisecond.
     */
    feedback: CircleActionFeedbackState?,
    color: Color? = null,
): Modifier {
    val sweep = rememberCircleFeedbackSweep(progress = progress, feedback = feedback)
    return circleProgressSweep(
        progress = sweep,
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
 * The one clock the cue runs on: the FINGER'S OWN ZERO, sampled on real frames.
 *
 * Measured on the first build of this (2026-09-20, a 192 dp seat under a 200 ms gate): reading the zero
 * off the first frame instead made the ring start at 0.24 rather than 0.2, and FREEZE AT 0.88 when the
 * gate fired. Two frames pass between the finger landing and this effect's first frame, because the
 * press has to reach composition first, and a ring that is two frames behind a 200 ms gate can never
 * complete. "Completes at holdMs" is the row's own sentence, so the zero has to be the pointer's.
 *
 * [pressedAtMs] is the down event's own uptime and [withFrameMillis] is the frame clock. On Android both
 * are CLOCK_MONOTONIC, so they are comparable, but that is a platform detail rather than a promise: if
 * the first frame does not land inside the gate's own window after that zero, the two clocks are not the
 * same one, and the cue falls back to the frame it CAN trust. That degrades to a cue up to two frames
 * late, never to a ring that is already full.
 *
 * It reads elapsed time off the clock rather than handing a tween a duration, so the cue and the GATE
 * cannot drift: the gate times the finger and so does this. It stops at 1 and runs only while a finger
 * is down, which is what makes the cue cost nothing on a face that is only being looked at.
 */
internal suspend fun runCircleHoldCue(
    hold: Animatable<Float, *>,
    pressed: Boolean,
    timing: CircleResolvedTiming,
    pressedAtMs: Long,
) {
    if (!pressed) {
        if (hold.value > 0f) hold.animateTo(0f, tween(CIRCLE_CUE_RELEASE_MS, easing = LinearEasing))
        return
    }
    if (timing.holdMs <= CIRCLE_CUE_BRUSH_MIN_MS) return
    val firstFrameMs = withFrameMillis { it }
    val zeroMs = if (firstFrameMs - pressedAtMs in 0..timing.holdMs) pressedAtMs else firstFrameMs
    var fraction = circleHoldCueFraction(firstFrameMs - zeroMs, timing.holdMs)
    while (true) {
        if (fraction > 0f) hold.snapTo(fraction)
        if (fraction >= 1f) return
        fraction = circleHoldCueFraction(withFrameMillis { it } - zeroMs, timing.holdMs)
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
        // INSIDE the control's own contour, not on it. Measured on a run seat at 192 dp (2026-09-20):
        // drawn on the bounds, the arc lands exactly where the pressed contour is already a bright ring,
        // so a teal accent over white read as a tint and the frames before and after were hard to tell
        // apart. One stroke in, it sits on the fill and the wearer can see how much of the gate is left.
        val stroke = MenuDesign.iconRingStroke.toPx()
        val inset = stroke
        drawArc(
            color = color,
            startAngle = -90f,
            sweepAngle = 360f * fraction,
            useCenter = false,
            topLeft = Offset(inset, inset),
            size = Size(size.width - 2f * inset, size.height - 2f * inset),
            style = Stroke(width = stroke, cap = StrokeCap.Round),
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

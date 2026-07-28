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

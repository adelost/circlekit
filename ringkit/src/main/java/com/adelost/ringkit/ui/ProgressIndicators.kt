package com.adelost.ringkit.ui

import com.adelost.designkit.ui.*

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.adelost.ringkit.data.Progress

/**
 * A quiet left-to-right light wash for deliberate-hold feedback. The modifier
 * belongs on the label/value itself, never on the pressed +/- or rim target.
 * Unlike a separate progress bar, it adds no layout and disappears completely
 * at rest.
 */
fun Modifier.holdProgressSweep(
    progress: Float?,
    color: Color = RingTokens.ProgressArc.copy(alpha = 0.30f),
): Modifier = skyvwProgressSweep(progress = progress, color = color)

/**
 * The one linear renderer for measured background progress. Hold gestures use
 * [holdProgressSweep] instead: a hold is transient feedback inside a label,
 * not a second UI element beneath it. A null [progress] renders the shared
 * indeterminate sweep — work is running but has no honest percentage.
 */
@Composable
fun LabelProgressBar(
    progress: Float?,
    modifier: Modifier = Modifier,
    width: Dp = 44.dp,
    height: Dp = 2.dp,
    trackColor: Color = RingTokens.ProgressTrack,
    fillColor: Color? = null,
) {
    val resolvedFill = fillColor ?: skyvwBrandColor()
    Box(
        modifier = modifier
            .width(width)
            .height(height)
            .clip(CircleShape)
            .background(trackColor),
        contentAlignment = Alignment.CenterStart,
    ) {
        if (progress == null) {
            val sweep = rememberInfiniteTransition(label = "labelProgressSweep")
            val phase by sweep.animateFloat(
                initialValue = 0f,
                targetValue = 1f,
                animationSpec = infiniteRepeatable(
                    animation = tween(LABEL_PROGRESS_SWEEP_MS, easing = LinearEasing),
                ),
                label = "labelProgressSweepPhase",
            )
            val segment = width * LABEL_PROGRESS_SWEEP_FRACTION
            Box(
                Modifier
                    .offset(x = (width + segment) * phase - segment)
                    .width(segment)
                    .height(height)
                    .background(resolvedFill, CircleShape),
            )
        } else {
            Box(
                Modifier
                    .fillMaxWidth(progress.coerceIn(0f, 1f))
                    .height(height)
                    .background(resolvedFill, CircleShape),
            )
        }
    }
}

private const val LABEL_PROGRESS_SWEEP_MS = 900
private const val LABEL_PROGRESS_SWEEP_FRACTION = 0.35f

/**
 * The one radial progress renderer for fetch, hold and countdown feedback.
 * A null [progress] keeps the track visible without inventing progress.
 */
@Composable
fun ProgressRing(
    progress: Float?,
    modifier: Modifier = Modifier,
    diameter: Dp = 34.dp,
    trackWidth: Dp = 2.5.dp,
    progressWidth: Dp = trackWidth,
    trackColor: Color = RingTokens.ProgressTrack,
    progressColor: Color? = null,
    surfaceColor: Color = Color.Transparent,
    progressCap: StrokeCap = StrokeCap.Butt,
) {
    val resolvedProgress = progressColor ?: skyvwBrandColor()
    Canvas(modifier = modifier.size(diameter)) {
        if (surfaceColor != Color.Transparent) {
            drawCircle(
                color = surfaceColor,
                radius = size.minDimension / 2f - 0.5.dp.toPx(),
            )
        }
        drawArc(
            color = trackColor,
            startAngle = -90f,
            sweepAngle = 360f,
            useCenter = false,
            style = Stroke(width = trackWidth.toPx()),
        )
        progress?.let {
            drawArc(
                color = resolvedProgress,
                startAngle = -90f,
                sweepAngle = 360f * it.coerceIn(0f, 1f),
                useCenter = false,
                style = Stroke(width = progressWidth.toPx(), cap = progressCap),
            )
        }
    }
}

/** Fetch-progress molecule: data contract in, shared radial atom out. */
@Composable
fun ProgressArcRing(
    progress: Progress?,
    modifier: Modifier = Modifier,
    diameter: Dp = 34.dp,
    content: @Composable () -> Unit,
) {
    val fraction = progress
        ?.takeIf { it.total > 0 }
        ?.let { it.done.toFloat() / it.total.toFloat() }
    Box(modifier = modifier.size(diameter), contentAlignment = Alignment.Center) {
        ProgressRing(
            progress = fraction,
            diameter = diameter,
            trackWidth = 2.5.dp,
            progressWidth = 3.dp,
            surfaceColor = RingTokens.ProgressSurface,
            progressCap = StrokeCap.Round,
        )
        content()
    }
}

/** Projects a fetch contract onto the single action-label language. */
fun measuredWorkLabelProgress(
    progress: Progress?,
    inFlight: Boolean,
): SkyvwLabelProgress? {
    if (!inFlight) return null
    return progress
        ?.takeIf { it.total > 0 }
        ?.let {
            SkyvwLabelProgress.Determinate(
                (it.done.toFloat() / it.total.toFloat()).coerceIn(0f, 1f),
            )
        }
        ?: SkyvwLabelProgress.Indeterminate
}

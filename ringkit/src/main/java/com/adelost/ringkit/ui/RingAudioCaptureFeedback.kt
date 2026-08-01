package com.adelost.ringkit.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Text
import com.adelost.designkit.ui.RingTokens
import com.adelost.designkit.ui.CircleSurfaceClass
import com.adelost.designkit.ui.LocalCircleSurfaceLayout
import com.adelost.designkit.ui.circleBrandColor
import com.adelost.designkit.ui.roundSafeContentInset

/** Normalized recent audio energy plus honest elapsed capture time. */
data class RingAudioCaptureFeedbackSpec(
    val elapsedMs: Long,
    val levels: List<Float>,
    val active: Boolean,
) {
    init {
        require(elapsedMs >= 0L)
        require(levels.all { it.isFinite() && it in 0f..1f })
    }
}

/**
 * Shared capture feedback shown above the pressed control, never under the
 * finger. Products feed real meter samples; CircleKit owns the waveform.
 */
@Composable
fun RingAudioCaptureFeedback(
    spec: RingAudioCaptureFeedbackSpec,
    modifier: Modifier = Modifier,
) {
    val round = LocalCircleSurfaceLayout.current.surfaceClass == CircleSurfaceClass.ROUND
    val samples = spec.levels.takeLast(AUDIO_WAVEFORM_BARS)
    val pigment = if (spec.active) circleBrandColor() else RingTokens.Dim
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = formatCaptureDuration(spec.elapsedMs),
            color = RingTokens.Ink,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
        )
        BoxWithConstraints(
            modifier = Modifier.fillMaxWidth().roundSafeContentInset(enabled = round),
            contentAlignment = Alignment.Center,
        ) {
            val waveformWidth = captureWaveformWidthDp(maxWidth.value).dp
            Box(Modifier.widthIn(max = waveformWidth)) {
                Canvas(Modifier.fillMaxWidth().height(38.dp)) {
                    val count = AUDIO_WAVEFORM_BARS
                    val step = size.width / (count - 1).coerceAtLeast(1)
                    val centerY = size.height / 2f
                    repeat(count) { index ->
                        val sourceIndex = index - (count - samples.size)
                        val level = samples.getOrNull(sourceIndex) ?: 0f
                        val halfHeight = 2.dp.toPx() + level * (centerY - 3.dp.toPx())
                        drawLine(
                            color = pigment.copy(alpha = 0.38f + level * 0.62f),
                            start = Offset(index * step, centerY - halfHeight),
                            end = Offset(index * step, centerY + halfHeight),
                            strokeWidth = 3.dp.toPx(),
                            cap = StrokeCap.Round,
                        )
                    }
                }
            }
        }
    }
}

internal fun captureWaveformWidthDp(availableWidthDp: Float): Float {
    require(availableWidthDp >= 0f && availableWidthDp.isFinite())
    return availableWidthDp.coerceAtMost(MAX_AUDIO_WAVEFORM_WIDTH_DP)
}

internal fun formatCaptureDuration(elapsedMs: Long): String {
    require(elapsedMs >= 0L)
    val seconds = elapsedMs / 1_000L
    return "%d:%02d".format(seconds / 60L, seconds % 60L)
}

private const val AUDIO_WAVEFORM_BARS = 24
private const val MAX_AUDIO_WAVEFORM_WIDTH_DP = 220f

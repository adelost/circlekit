package com.adelost.ringkit.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.adelost.designkit.ui.LocalSkyvwSurfaceLayout
import com.adelost.designkit.ui.MenuDesign
import com.adelost.designkit.ui.RingIcons
import com.adelost.designkit.ui.RingTokens
import com.adelost.designkit.ui.SkyvwActionTiming
import com.adelost.designkit.ui.SkyvwText
import com.adelost.designkit.ui.SkyvwIconDisc
import com.adelost.designkit.ui.phoneSurfaceDesignFor
import com.adelost.designkit.ui.skyvwBrandColor

enum class RingPlaybackState {
    READY,
    PLAYING,
    PAUSED,
    COMPLETE,
    FAILED,
}

/**
 * Product-neutral playback truth. A zero duration means the player has not
 * resolved media length yet; the UI never invents a denominator.
 */
data class RingPlaybackSpec(
    val title: String,
    val state: RingPlaybackState,
    val positionMs: Long,
    val durationMs: Long,
    val onPlayPause: () -> Unit,
    val onStop: () -> Unit,
) {
    init {
        require(positionMs >= 0L)
        require(durationMs >= 0L)
    }
}

/**
 * One adaptive mini-player for spoken replies, recordings and previews.
 * Products provide player truth; CircleKit owns controls, timing and geometry.
 */
@Composable
fun RingPlaybackControls(
    spec: RingPlaybackSpec,
    modifier: Modifier = Modifier,
) {
    val surface = LocalSkyvwSurfaceLayout.current.surfaceClass
    val phoneDesign = phoneSurfaceDesignFor(surface)
    val controlDiameter = phoneDesign?.rowIconDiameter ?: MenuDesign.watchActionRingDiameter
    val controlIconSize = phoneDesign?.rowIconSize ?: MenuDesign.iconSize
    val horizontalPadding = phoneDesign?.screenPadding ?: MenuDesign.rowInsetH
    val progress = playbackProgressFraction(spec.positionMs, spec.durationMs)
    val brand = skyvwBrandColor()
    val playing = spec.state == RingPlaybackState.PLAYING
    val canStop = spec.state == RingPlaybackState.PLAYING ||
        spec.state == RingPlaybackState.PAUSED

    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = horizontalPadding, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(phoneDesign?.controlGap ?: 8.dp),
    ) {
        SkyvwIconDisc(
            icon = if (playing) RingIcons.Pause else RingIcons.Play,
            contentDescription = if (playing) "Pause playback" else "Play audio",
            actionLabel = if (playing) "PAUSE" else "PLAY",
            onTap = spec.onPlayPause,
            diameter = controlDiameter,
            iconSize = controlIconSize,
            active = playing,
            timing = SkyvwActionTiming.IMMEDIATE,
        )
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            SkyvwText(
                text = spec.title,
                color = RingTokens.Ink,
                fontSizeSp = phoneDesign?.rowTitleSize?.value ?: MenuDesign.titleSize.value,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
            )
            SkyvwText(
                text = playbackTimeLabel(spec.positionMs, spec.durationMs),
                color = RingTokens.Dim,
                fontSizeSp = phoneDesign?.metadataSize?.value ?: MenuDesign.subSize.value,
                tabularNumerals = true,
                maxLines = 1,
            )
            Canvas(Modifier.fillMaxWidth().height(3.dp)) {
                val centerY = size.height / 2f
                drawLine(
                    color = RingTokens.NeutralRing,
                    start = Offset(0f, centerY),
                    end = Offset(size.width, centerY),
                    strokeWidth = size.height,
                    cap = StrokeCap.Round,
                )
                if (progress > 0f) {
                    drawLine(
                        color = brand,
                        start = Offset(0f, centerY),
                        end = Offset(size.width * progress, centerY),
                        strokeWidth = size.height,
                        cap = StrokeCap.Round,
                    )
                }
            }
        }
        if (canStop) {
            SkyvwIconDisc(
                icon = RingIcons.Stop,
                contentDescription = "Stop playback",
                actionLabel = "STOP",
                onTap = spec.onStop,
                diameter = controlDiameter,
                iconSize = controlIconSize,
                timing = SkyvwActionTiming.IMMEDIATE,
                modifier = Modifier.size(controlDiameter),
            )
        }
    }
}

fun playbackProgressFraction(positionMs: Long, durationMs: Long): Float {
    require(positionMs >= 0L)
    require(durationMs >= 0L)
    if (durationMs == 0L) return 0f
    return (positionMs.toDouble() / durationMs.toDouble()).toFloat().coerceIn(0f, 1f)
}

fun playbackTimeLabel(positionMs: Long, durationMs: Long): String {
    require(positionMs >= 0L)
    require(durationMs >= 0L)
    val position = formatPlaybackDuration(positionMs)
    return if (durationMs == 0L) position else "$position / ${formatPlaybackDuration(durationMs)}"
}

private fun formatPlaybackDuration(valueMs: Long): String {
    val totalSeconds = valueMs / 1_000L
    return "%d:%02d".format(totalSeconds / 60L, totalSeconds % 60L)
}

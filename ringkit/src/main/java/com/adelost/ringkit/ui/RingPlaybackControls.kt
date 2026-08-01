package com.adelost.ringkit.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.adelost.designkit.ui.LocalCircleSurfaceLayout
import com.adelost.designkit.ui.CircleSurfaceClass
import com.adelost.designkit.ui.MenuDesign
import com.adelost.designkit.ui.RingIcons
import com.adelost.designkit.ui.RingTokens
import com.adelost.designkit.ui.CircleActionTiming
import com.adelost.designkit.ui.CircleText
import com.adelost.designkit.ui.CircleIconDisc
import com.adelost.designkit.ui.phoneSurfaceDesignFor
import com.adelost.designkit.ui.circleBrandColor

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
    val surface = LocalCircleSurfaceLayout.current.surfaceClass
    val phoneDesign = phoneSurfaceDesignFor(surface)
    val controlDiameter = phoneDesign?.rowIconDiameter ?: MenuDesign.watchActionRingDiameter
    val controlIconSize = phoneDesign?.rowIconSize ?: MenuDesign.iconSize
    val horizontalPadding = phoneDesign?.screenPadding ?: MenuDesign.rowInsetH
    val progress = playbackProgressFraction(spec.positionMs, spec.durationMs)
    val brand = circleBrandColor()
    val playing = spec.state == RingPlaybackState.PLAYING
    val canStop = spec.state == RingPlaybackState.PLAYING ||
        spec.state == RingPlaybackState.PAUSED
    val statusColor = when (spec.state) {
        RingPlaybackState.FAILED -> RingTokens.Broken
        RingPlaybackState.COMPLETE -> RingTokens.Fresh
        else -> RingTokens.Dim
    }

    if (surface == CircleSurfaceClass.ROUND) {
        RoundPlaybackControls(
            spec = spec,
            playing = playing,
            canStop = canStop,
            progress = progress,
            statusColor = statusColor,
            modifier = modifier,
        )
        return
    }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = horizontalPadding, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(phoneDesign?.controlGap ?: 8.dp),
    ) {
        CircleIconDisc(
            icon = if (playing) RingIcons.Pause else RingIcons.Play,
            contentDescription = if (playing) "Pause playback" else "Play audio",
            actionLabel = if (playing) "PAUSE" else "PLAY",
            onTap = spec.onPlayPause,
            diameter = controlDiameter,
            iconSize = controlIconSize,
            active = playing,
            timing = CircleActionTiming.IMMEDIATE,
        )
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            CircleText(
                text = spec.title,
                color = RingTokens.Ink,
                fontSizeSp = phoneDesign?.rowTitleSize?.value ?: MenuDesign.titleSize.value,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
            )
            CircleText(
                text = playbackStatusLabel(spec.state, spec.positionMs, spec.durationMs),
                color = statusColor,
                fontSizeSp = phoneDesign?.metadataSize?.value ?: MenuDesign.subSize.value,
                tabularNumerals = true,
                maxLines = 1,
            )
            PlaybackProgress(progress = progress, pigment = brand)
        }
        if (canStop) {
            CircleIconDisc(
                icon = RingIcons.Stop,
                contentDescription = "Stop playback",
                actionLabel = "STOP",
                onTap = spec.onStop,
                diameter = controlDiameter,
                iconSize = controlIconSize,
                timing = CircleActionTiming.IMMEDIATE,
                modifier = Modifier.size(controlDiameter),
            )
        }
    }
}

@Composable
private fun RoundPlaybackControls(
    spec: RingPlaybackSpec,
    playing: Boolean,
    canStop: Boolean,
    progress: Float,
    statusColor: androidx.compose.ui.graphics.Color,
    modifier: Modifier,
) {
    Column(
        modifier = modifier.width(MenuDesign.roundMediaContentWidth),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(MenuDesign.mediaContentGap),
    ) {
        CircleText(
            text = spec.title,
            color = RingTokens.Ink,
            fontSizeSp = MenuDesign.titleSize.value,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
        )
        CircleText(
            text = playbackStatusLabel(spec.state, spec.positionMs, spec.durationMs),
            color = statusColor,
            fontSizeSp = MenuDesign.subSize.value,
            tabularNumerals = true,
            maxLines = 1,
        )
        PlaybackProgress(progress = progress, pigment = circleBrandColor())
        Row(
            horizontalArrangement = Arrangement.spacedBy(MenuDesign.iconTextGap),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PlaybackAction(playing = playing, onTap = spec.onPlayPause)
            if (canStop) {
                CircleIconDisc(
                    icon = RingIcons.Stop,
                    contentDescription = "Stop playback",
                    actionLabel = "STOP",
                    onTap = spec.onStop,
                    diameter = MenuDesign.watchActionRingDiameter,
                    iconSize = MenuDesign.iconSize,
                    timing = CircleActionTiming.IMMEDIATE,
                )
            }
        }
    }
}

@Composable
private fun PlaybackAction(playing: Boolean, onTap: () -> Unit) {
    CircleIconDisc(
        icon = if (playing) RingIcons.Pause else RingIcons.Play,
        contentDescription = if (playing) "Pause playback" else "Play audio",
        actionLabel = if (playing) "PAUSE" else "PLAY",
        onTap = onTap,
        diameter = MenuDesign.watchActionRingDiameter,
        iconSize = MenuDesign.iconSize,
        active = playing,
        timing = CircleActionTiming.IMMEDIATE,
    )
}

@Composable
private fun PlaybackProgress(
    progress: Float,
    pigment: androidx.compose.ui.graphics.Color,
) {
    Canvas(Modifier.fillMaxWidth().height(MenuDesign.mediaTrackHeight)) {
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
                color = pigment,
                start = Offset(0f, centerY),
                end = Offset(size.width * progress, centerY),
                strokeWidth = size.height,
                cap = StrokeCap.Round,
            )
        }
    }
}

fun playbackStatusLabel(
    state: RingPlaybackState,
    positionMs: Long,
    durationMs: Long,
): String = "${state.name} · ${playbackTimeLabel(positionMs, durationMs)}"

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

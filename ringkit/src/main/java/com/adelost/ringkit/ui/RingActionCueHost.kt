package com.adelost.ringkit.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Icon
import androidx.wear.compose.material.Text
import com.adelost.designkit.ui.CircleActionCue
import com.adelost.designkit.ui.CircleActionCueEvent
import com.adelost.designkit.ui.LocalCircleActionCuePublisher
import com.adelost.designkit.ui.MenuDesign
import com.adelost.designkit.ui.RingTokens
import com.adelost.designkit.ui.circleBrandColor
import kotlinx.coroutines.delay

/** Durable ownership state for the single centre action cue. */
internal data class RingCueHostState(
    val cue: CircleActionCue? = null,
    val owner: Any? = null,
    val settledOwner: Any? = null,
)

/** A committed receipt survives disposal of the control that published it. */
internal fun nextRingCueHostState(
    current: RingCueHostState,
    event: CircleActionCueEvent,
): RingCueHostState {
    val cue = event.cue
    return when {
        cue != null -> RingCueHostState(
            cue = cue,
            owner = event.owner,
            settledOwner = event.owner.takeIf { cue.confirmed || cue.lingers } ?: current.settledOwner,
        )
        current.settledOwner === event.owner -> current
        current.owner === event.owner -> RingCueHostState(settledOwner = current.settledOwner)
        else -> current
    }
}

/** A dwell may clear only the exact confirmed receipt that scheduled it. */
internal fun ringCueReceiptStillCurrent(
    current: RingCueHostState,
    scheduledOwner: Any,
    scheduledCue: CircleActionCue,
): Boolean = current.settledOwner === scheduledOwner &&
    current.owner === scheduledOwner &&
    current.cue == scheduledCue &&
    (current.cue.confirmed || current.cue.lingers)

/**
 * One host for CircleKit action progress on rectangular and round surfaces.
 * Phone and Wear mount the same host once; controls only publish semantic cue
 * data and can never invent a second progress renderer.
 */
@Composable
fun RingActionCueHost(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    var state by remember { mutableStateOf(RingCueHostState()) }
    val publish = remember {
        { event: CircleActionCueEvent -> state = nextRingCueHostState(state, event) }
    }
    val settledCue = state.cue?.takeIf { it.confirmed || it.lingers }
    LaunchedEffect(state.settledOwner, settledCue) {
        val scheduledOwner = state.settledOwner ?: return@LaunchedEffect
        val scheduledCue = settledCue ?: return@LaunchedEffect
        delay(scheduledCue.dwellMs)
        if (ringCueReceiptStillCurrent(state, scheduledOwner, scheduledCue)) {
            state = RingCueHostState()
        }
    }
    CompositionLocalProvider(LocalCircleActionCuePublisher provides publish) {
        Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            content()
            state.cue?.let { cue ->
                Box(Modifier.fillMaxSize().background(MenuDesign.actionCueScrim))
                when (ringCueSurface(cue)) {
                    RingCueSurface.ACTION -> RingActionCue(cue)
                    RingCueSurface.EXPLANATION -> RingExplanationCue(cue)
                }
            }
        }
    }
}

internal enum class RingCueSurface { ACTION, EXPLANATION }

/** Explanatory copy has one deliberate entry point and one shared renderer. */
internal fun ringCueSurface(cue: CircleActionCue): RingCueSurface =
    if (cue.hint == null) RingCueSurface.ACTION else RingCueSurface.EXPLANATION

@Composable
private fun RingExplanationCue(cue: CircleActionCue) {
    val round = com.adelost.designkit.ui.LocalCircleSurfaceLayout.current.surfaceClass ==
        com.adelost.designkit.ui.CircleSurfaceClass.ROUND
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.widthIn(max = if (round) 150.dp else 340.dp).padding(horizontal = 12.dp),
    ) {
        Icon(
            imageVector = cue.icon,
            contentDescription = cue.label,
            tint = RingTokens.Ink,
            modifier = Modifier.size(24.dp),
        )
        Text(
            text = cue.label,
            color = RingTokens.Ink,
            fontSize = if (round) 11.sp else 18.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.5.sp,
            textAlign = TextAlign.Center,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
        cue.value?.let { value ->
            Text(
                text = value,
                color = circleBrandColor(),
                fontSize = if (round) 10.sp else 14.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Text(
            text = requireNotNull(cue.hint),
            color = RingTokens.Dim,
            fontSize = if (round) 9.sp else 16.sp,
            textAlign = TextAlign.Center,
            maxLines = 5,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 5.dp),
        )
        cue.infoAction?.let { action ->
            HoldPill(
                text = action.label,
                onConfirm = action.onInvoke,
                holdMs = MenuDesign.holdDeliberateMs,
                modifier = Modifier.padding(top = 7.dp),
            )
        }
    }
}

/** The canonical centre ring used for deliberate progress and confirmation. */
@Composable
private fun RingActionCue(cue: CircleActionCue) {
    val round = com.adelost.designkit.ui.LocalCircleSurfaceLayout.current.surfaceClass ==
        com.adelost.designkit.ui.CircleSurfaceClass.ROUND
    val ringSize = if (round) 64.dp else 80.dp
    val pigment = if (cue.confirmed) RingTokens.Fresh else circleBrandColor()
    val ink = if (cue.confirmed) RingTokens.Fresh else RingTokens.Ink
    // The ring and its caption own disjoint measured bounds. An offset inside
    // a fixed ring lets a second label line cross its stroke on every host.
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier.widthIn(max = if (round) 132.dp else 280.dp),
    ) {
        Box(contentAlignment = Alignment.Center) {
            ProgressRing(
                progress = cue.progress,
                diameter = ringSize,
                trackWidth = 4.dp,
                progressWidth = 4.dp,
                progressColor = pigment,
                modifier = Modifier.semantics {
                    progressBarRangeInfo = ProgressBarRangeInfo(cue.progress, 0f..1f)
                },
            )
            Icon(
                imageVector = cue.icon,
                contentDescription = null,
                tint = ink,
                modifier = Modifier.size(28.dp),
            )
        }
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = cue.label,
                color = ink,
                fontSize = if (round) 11.sp else 16.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 0.5.sp,
                textAlign = TextAlign.Center,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            cue.value?.takeIf { cue.confirmed }?.let { value ->
                Text(
                    text = value,
                    color = pigment,
                    fontSize = if (round) 10.sp else 14.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.5.sp,
                    textAlign = TextAlign.Center,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

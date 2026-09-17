package com.adelost.ringkit.ui

import androidx.compose.ui.draw.rotate

import androidx.compose.foundation.background
import androidx.activity.compose.BackHandler
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
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
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
import com.adelost.designkit.ui.CircleActionTiming
import com.adelost.designkit.ui.CircleIconDisc
import com.adelost.designkit.ui.CircleText
import com.adelost.designkit.ui.RingIcons
import com.adelost.designkit.ui.circleSafeTap
import com.adelost.designkit.ui.rememberCircleActionFeedbackState
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
        event.updateOnly && current.owner !== event.owner -> current
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

/**
 * Does this settled cue leave on its own?
 *
 * Only an explicitly OPENED answer waits for the reader: it is theirs to
 * close. A confirmation that happens to carry a sentence is still a receipt,
 * and a receipt that never leaves is a card the reader must dismiss after
 * every tap on a row that explains itself.
 */
internal fun ringCueDwellsOut(cue: CircleActionCue): Boolean = !cue.isInformation

/** A dwell may clear only the exact confirmed receipt that scheduled it. */
internal fun ringCueReceiptStillCurrent(
    current: RingCueHostState,
    scheduledOwner: Any,
    scheduledCue: CircleActionCue,
): Boolean = current.settledOwner === scheduledOwner &&
    current.owner === scheduledOwner &&
    current.cue == scheduledCue &&
    (current.cue.confirmed || current.cue.lingers)

/** The cue that owns the centre right now, for a host that dims behind it or
 *  places the cue itself. Empty outside a [RingActionCueHost]. */
val LocalRingActionCue = staticCompositionLocalOf<State<CircleActionCue?>> { mutableStateOf(null) }

/** Clears the cue: the reader's CLOSE, and a modal that dismisses its own. */
val LocalRingActionCueDismiss = staticCompositionLocalOf<() -> Unit> { {} }

/**
 * A separate window (a modal dialog) draws the cue above its own opaque
 * surface while it is mounted, so the host underneath must not draw a second
 * one behind it. Registering is how the covered host knows.
 */
val LocalRingActionCueWindow = staticCompositionLocalOf<((Any, Boolean) -> Unit)?> { null }

/**
 * One host for CircleKit action progress on rectangular and round surfaces.
 * Phone and Wear mount the same host once; controls only publish semantic cue
 * data and can never invent a second progress renderer.
 *
 * [rendersCue] is false for a host whose product places the cue itself, in a
 * declared component slot or in a window of its own: the host still owns the
 * cue, its ownership rules and its dwell, and [LocalRingActionCue] is where
 * that one cue is read.
 */
@Composable
fun RingActionCueHost(
    modifier: Modifier = Modifier,
    rendersCue: Boolean = true,
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
        if (!ringCueDwellsOut(scheduledCue)) return@LaunchedEffect
        delay(scheduledCue.dwellMs)
        if (ringCueReceiptStillCurrent(state, scheduledOwner, scheduledCue)) {
            state = RingCueHostState()
        }
    }
    val cueState = rememberUpdatedState(state.cue)
    val dismiss = remember { { state = RingCueHostState() } }
    var windowOwners by remember { mutableStateOf(emptySet<Any>()) }
    val mountWindow = remember {
        { owner: Any, mounted: Boolean ->
            windowOwners = if (mounted) windowOwners + owner else windowOwners - owner
        }
    }
    CompositionLocalProvider(
        LocalCircleActionCuePublisher provides publish,
        LocalRingActionCue provides cueState,
        LocalRingActionCueDismiss provides dismiss,
        LocalRingActionCueWindow provides mountWindow,
    ) {
        Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            content()
            // The opaque window is the presentation while it is mounted; a
            // second copy in the covered host is one the reader cannot close.
            if (rendersCue && windowOwners.isEmpty()) RingActionCueSurface(state.cue)
        }
    }
}

/**
 * The one centre-cue drawing: the host's own, a product's declared slot and a
 * modal window all render THIS, so a cue cannot look like two different things
 * depending on which surface published it.
 */
@Composable
fun RingActionCueSurface(cue: CircleActionCue?, modifier: Modifier = Modifier) {
    if (cue == null) return
    val dismiss = LocalRingActionCueDismiss.current
    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        if (cue.isInformation) RingActionExplanation(cue, dismiss) else RingActionCueContent(cue)
    }
}

/** Same closeable information surface for instrument hosts and menu hosts. */
@Composable
fun RingActionExplanation(cue: CircleActionCue, onDismiss: () -> Unit) {
    require(cue.hint != null) { "An information surface needs explanatory copy" }
    BackHandler(onBack = onDismiss)
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Box(Modifier.fillMaxSize().background(MenuDesign.actionCueScrim).circleSafeTap(
            feedback = rememberCircleActionFeedbackState(),
            holdMs = 0L, consumeDown = true, label = null, onTap = onDismiss,
        ))
        RingExplanationCue(cue, onDismiss)
    }
}

@Composable
private fun RingExplanationCue(cue: CircleActionCue, onDismiss: () -> Unit) {
    val round = com.adelost.designkit.ui.LocalCircleSurfaceLayout.current.surfaceClass ==
        com.adelost.designkit.ui.CircleSurfaceClass.ROUND
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.widthIn(max = if (round) 150.dp else 340.dp).padding(horizontal = 12.dp),
    ) {
        Icon(
            imageVector = cue.icon,
            contentDescription = cue.label,
            tint = cue.semanticColor ?: RingTokens.Ink,
            modifier = Modifier.size(24.dp).rotate(cue.iconRotationDeg),
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
                color = cue.semanticColor ?: circleBrandColor(),
                fontSize = if (round) 10.sp else 14.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        // CircleText, as a row's subtitle: a Wear `Text` inherits body1's
        // 20 sp line height whatever its size, which spread a 9 sp explanation
        // to twice its lines (Skyvw row 117: 66 px a line against a row's 44).
        CircleText(
            text = requireNotNull(cue.hint),
            color = RingTokens.Dim,
            fontSizeSp = if (round) 9f else 16f,
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
        CircleIconDisc(
            icon = RingIcons.Cross, contentDescription = "Close information",
            actionLabel = "CLOSE", onTap = onDismiss,
            timing = CircleActionTiming.IMMEDIATE,
            modifier = Modifier.padding(top = 8.dp),
            diameter = if (round) MenuDesign.watchActionRingDiameter else 44.dp,
            iconSize = MenuDesign.iconSize,
        )
    }
}

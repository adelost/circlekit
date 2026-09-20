package com.adelost.designkit.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animate
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.Color

/**
 * The one centre-screen acknowledgement model for every action atom.
 * [progress] is honest hold progress for DELIBERATE actions; IMMEDIATE
 * actions skip the wait and publish only the short confirmed pulse.
 *
 * [hint] is reserved for an explicitly requested explanation. Ordinary row
 * presses publish action progress/receipts without explanatory copy; a short
 * or abandoned press therefore cannot cover the screen with information the
 * user did not ask to see.
 */
@Immutable
data class CircleActionCue(
    val icon: ImageVector,
    val label: String,
    val progress: Float,
    val confirmed: Boolean,
    /** Where this control stands, or will stand once the hold completes. */
    val value: String? = null,
    /** One sentence: what it does, and what its states mean. */
    val hint: String? = null,
    /**
     * Optional action belonging to the explanation, not to the row itself.
     * The first consumer is RESET TO DEFAULT: the option keeps its ordinary
     * tap meaning, while the short-lived information card may offer the
     * explicit escape hatch declared by the product catalogue.
     */
    val infoAction: CircleActionCueInfoAction? = null,
    /**
     * This cue must survive the publisher going quiet, and the HOST owns how
     * long it stays.
     *
     * A cue published while a finger is down is refreshed continuously, so it
     * needs no protection: it lives as long as the press. A cue published
     * BECAUSE the press ended has the opposite problem — the very event that
     * creates it also restarts the publisher, and the restart's "nothing to
     * show" arrives right behind it. Whichever order those two land in, an
     * unprotected cue loses.
     *
     * [confirmed] already earned that protection for committed actions. This
     * says the same thing for an answer that was never an action.
     */
    val lingers: Boolean = false,
    /** A directional glyph keeps its reading when opened as information. */
    val iconRotationDeg: Float = 0f,
    /** Explicit reading pigment follows the value into information; never a brand fallback. */
    val semanticColor: Color? = null,
    /**
     * The answer this cue names among its peers, for a button that switches
     * between a fixed few. The host draws the button's own dots filled at the
     * answer [icon] and [label] name, so the three cannot read as two answers.
     */
    val choiceState: CircleChoiceState? = null,
) {
    init {
        require(iconRotationDeg.isFinite()) { "Action cue icon rotation must be finite" }
        require(label.isNotBlank()) { "Action cue needs a visible label" }
        require(progress.isFinite() && progress in 0f..1f) {
            "Action cue progress must be a finite fraction in 0..1"
        }
        require(value == null || value.isNotBlank()) {
            "Action cue value is either a real state or absent, never blank"
        }
        require(hint == null || hint.isNotBlank()) {
            "Action cue hint is either a real sentence or absent, never blank"
        }
        require(infoAction == null || hint != null) {
            "An action cue info action needs explanatory copy to live beside"
        }
    }

    /** A cue with something to read earns the room to show it. */
    val explains: Boolean get() = hint != null || value != null

    /** An explicitly opened answer is dismissed by the reader, not a timer. */
    val isInformation: Boolean get() = lingers && hint != null

    /**
     * How long the confirmed cue stays up, scaled to how much it has to say.
     *
     * A bare acknowledgement keeps the old brief pulse, so ordinary taps do not
     * suddenly feel sticky. A confirmation that names a new state earns the
     * time to read that. A confirmation carrying a SENTENCE earns the time to
     * read the sentence: a window set for a value let a tapped row's
     * explanation disappear before it could be finished (Skyvw 2026-08-06).
     */
    val dwellMs: Long
        get() = when {
            hint != null -> MenuDesign.hintReadingMs
            value != null -> MenuDesign.actionExplainMs
            else -> MenuDesign.actionConfirmationMs
        }

    /**
     * Whether a committed receipt may be refreshed from the recomposed control.
     * A switch's receipt already names the answer the press chose; after the
     * switch lands it points at the NEXT answer, so a refresh would print where
     * a second tap goes (Skyvw 2026-09-14: "text B ... men bild A").
     */
    internal val refreshesAfterCommit: Boolean get() = choiceState == null
}

/** One optional verb in the transient explanation card. */
@Stable
class CircleActionCueInfoAction(
    val label: String,
    val onInvoke: () -> Unit,
) {
    init {
        require(label.isNotBlank()) { "Action cue info action needs a visible label" }
    }
}

/** Owner identity makes clear events safe when many idle buttons compose. */
data class CircleActionCueEvent(
    val owner: Any,
    val cue: CircleActionCue?,
    /** Refresh a receipt's recomposed value only while it still owns the host. */
    val updateOnly: Boolean = false,
)

val LocalCircleActionCuePublisher =
    staticCompositionLocalOf<(CircleActionCueEvent) -> Unit> { {} }

/**
 * What the centre cue should do for one press state — as DATA, so the state
 * machine can be read and tested without a Compose harness.
 *
 * The decision used to live inside the effect that performs it, which is why a
 * whole interaction could go missing without a single test noticing: the ones
 * that existed asserted the SHAPE of a cue somebody handed them, never that
 * pressing a row produces one. A sealed plan makes the effect exhaustive, so
 * removing a case is a compile error rather than a silent surface.
 */
internal sealed interface CircleCuePlan {
    /** Committed. The HOST owns the dwell; a row that closes on tap is gone. */
    data class Settle(val cue: CircleActionCue) : CircleCuePlan

    /** Externally driven progress, published as given. */
    data class Show(val cue: CircleActionCue) : CircleCuePlan

    /** Sweep 0..1 across the hold, publishing as it fills. */
    data object Sweep : CircleCuePlan

    /** Nothing to say. */
    data object Clear : CircleCuePlan
}

internal fun circleCuePlan(
    icon: ImageVector,
    label: String,
    value: String?,
    timing: CircleActionTiming,
    pressed: Boolean,
    confirmed: Boolean,
    determinateProgress: Float?,
    choiceState: CircleChoiceState? = null,
): CircleCuePlan {
    fun cue(progress: Float, isConfirmed: Boolean) =
        CircleActionCue(icon, label, progress, isConfirmed, value, choiceState = choiceState)
    return when {
        confirmed && timing == CircleActionTiming.DELIBERATE ->
            CircleCuePlan.Settle(cue(progress = 1f, isConfirmed = true))
        determinateProgress != null ->
            CircleCuePlan.Show(cue(determinateProgress, isConfirmed = false))
        pressed && timing == CircleActionTiming.DELIBERATE -> CircleCuePlan.Sweep
        else -> CircleCuePlan.Clear
    }
}

@Stable
class CircleActionCueController internal constructor(private val publishReceipt: () -> Unit) {
    internal var confirmed by mutableStateOf(false)

    fun confirm() {
        confirmed = true
        // Publish BEFORE the product action. That action may open information
        // using the same host; a later effect must not overwrite it with ACK.
        publishReceipt()
    }
}

/**
 * Connects a standard action atom to the shared centre overlay. Screens only
 * declare icon, label and timing; they never draw their own progress stripe.
 */
@Composable
fun rememberCircleActionCueController(
    icon: ImageVector,
    label: String,
    timing: CircleActionTiming,
    pressed: Boolean,
    holdDurationMs: Long = timing.holdMs,
    determinateProgress: Float? = null,
    /** Where this control stands. Rendered while held and after it commits. */
    stateValue: String? = null,
    ordinaryTap: Boolean = true,
    /** For a switch: the answer [icon] and [label] name, drawn as its dots. */
    choiceState: CircleChoiceState? = null,
): CircleActionCueController {
    // The declared timing IS the answer here too. This used to consult a host-wide override that the
    // control's own drawing never saw, so the two could disagree about the same press (row 225).
    val effectiveTiming = timing
    require(holdDurationMs >= 0L) { "Action cue hold duration cannot be negative" }
    require(determinateProgress == null || determinateProgress.isFinite() && determinateProgress in 0f..1f) {
        "Action cue progress must be null or a finite fraction in 0..1"
    }
    val publish = LocalCircleActionCuePublisher.current
    val owner = remember { Any() }
    val state = stateValue?.takeIf { it.isNotBlank() }
    val publishReceipt = rememberUpdatedState {
        val plan = circleCuePlan(icon, label, state, effectiveTiming,
            pressed = false, confirmed = true, determinateProgress = null, choiceState = choiceState)
        if (plan is CircleCuePlan.Settle) publish(CircleActionCueEvent(owner, plan.cue))
    }
    val controller = remember { CircleActionCueController { publishReceipt.value() } }

    LaunchedEffect(
        icon,
        label,
        effectiveTiming,
        pressed,
        holdDurationMs,
        determinateProgress,
        state,
        choiceState,
        controller.confirmed,
        publish,
    ) {
        val plan = circleCuePlan(
            icon = icon,
            label = label,
            value = state,
            timing = effectiveTiming,
            pressed = pressed,
            confirmed = controller.confirmed,
            determinateProgress = determinateProgress,
            choiceState = choiceState,
        )
        when (plan) {
            is CircleCuePlan.Settle -> {
                // confirm() already published, synchronously before onTap.
                // Refresh the resulting state (e.g. OFF -> ON), but never
                // replace information that the action opened in the meantime.
                if (plan.cue.refreshesAfterCommit) {
                    publish(CircleActionCueEvent(owner, plan.cue, updateOnly = true))
                }
                controller.confirmed = false
            }

            is CircleCuePlan.Show -> publish(CircleActionCueEvent(owner, plan.cue))

            CircleCuePlan.Sweep -> {
                animate(
                    initialValue = 0f,
                    targetValue = 1f,
                    animationSpec = tween(
                        durationMillis = holdDurationMs.toInt(),
                        easing = LinearEasing,
                    ),
                ) { value, _ ->
                    if (!controller.confirmed) publish(
                        CircleActionCueEvent(
                            owner,
                            CircleActionCue(icon, label, value, false, state, choiceState = choiceState),
                        ),
                    )
                }
            }

            CircleCuePlan.Clear -> {
                publish(CircleActionCueEvent(owner, null))
                controller.confirmed = false
            }
        }
    }
    DisposableEffect(owner, publish) {
        onDispose { publish(CircleActionCueEvent(owner, null)) }
    }
    return controller
}

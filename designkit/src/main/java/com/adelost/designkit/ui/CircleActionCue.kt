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
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.vector.ImageVector
import kotlinx.coroutines.delay

/**
 * The one centre-screen acknowledgement model for every action atom.
 * [progress] is honest hold progress for DELIBERATE actions; IMMEDIATE
 * actions skip the wait and publish only the short confirmed pulse.
 *
 * The cue is also the product's ONE discoverability surface. A deliberate
 * control does not fire until the hold completes, so the ring filling up is
 * already a window in which nothing has happened yet — [value] and [hint]
 * turn that window into an answer to "what is this, and what will it do?".
 * Releasing early cancels, which makes press-to-read a safe move that needed
 * no new gesture (Mattias 2026-07-27).
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
) {
    init {
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
    }

    /**
     * How long the confirmed cue stays up. A cue with something to read earns
     * the time to read it; a bare acknowledgement keeps the old brief pulse,
     * so ordinary taps do not suddenly feel sticky.
     */
    val dwellMs: Long
        get() = if (hint != null || value != null) {
            MenuDesign.actionExplainMs
        } else {
            MenuDesign.actionConfirmationMs
        }
}

/** Owner identity makes clear events safe when many idle buttons compose. */
data class CircleActionCueEvent(
    val owner: Any,
    val cue: CircleActionCue?,
)

val LocalCircleActionCuePublisher =
    staticCompositionLocalOf<(CircleActionCueEvent) -> Unit> { {} }

/**
 * Whether a press that ended before its hold completed should EXPLAIN the
 * control it touched.
 *
 * A deliberate control does nothing until the hold finishes, so a short press
 * is already safe — and that safety was the whole point (Mattias 2026-07-27:
 * releasing early cancels). What it was not is ANSWERABLE: the row went quiet,
 * and silence reads the same as broken. Mattias 2026-08-06 asked for the
 * opposite — "en info knapp ... som kanske syns en liten stund efter att man
 * duttar på något". A tap is how people ask what something is.
 *
 * So an abandoned press becomes a QUESTION rather than a failure: the same cue
 * the hold shows, for the same reading window, with nothing executed. The
 * cancel semantics are untouched — the action still does not fire.
 *
 * [armed] means this control had actually begun a hold; without it every
 * composition that starts unpressed would announce itself. [hasSomethingToSay]
 * keeps a control with neither state nor sentence silent, because an empty
 * card explains nothing and costs the face.
 */
internal fun explainsAbandonedPress(
    timing: CircleActionTiming,
    pressed: Boolean,
    armed: Boolean,
    hasSomethingToSay: Boolean,
): Boolean =
    !pressed && armed && hasSomethingToSay && timing == CircleActionTiming.DELIBERATE

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

    /**
     * A press that ended before it could act. Publish, hold it long enough to
     * READ, then clear — nothing was executed, so nothing closed, so this one
     * can own its own clock.
     */
    data class Explain(val cue: CircleActionCue, val dwellMs: Long) : CircleCuePlan

    /** Nothing to say. */
    data object Clear : CircleCuePlan
}

internal fun circleCuePlan(
    icon: ImageVector,
    label: String,
    value: String?,
    hint: String?,
    timing: CircleActionTiming,
    pressed: Boolean,
    armed: Boolean,
    confirmed: Boolean,
    determinateProgress: Float?,
): CircleCuePlan {
    fun cue(progress: Float, isConfirmed: Boolean) =
        CircleActionCue(icon, label, progress, isConfirmed, value, hint)
    return when {
        confirmed -> CircleCuePlan.Settle(cue(progress = 1f, isConfirmed = true))
        determinateProgress != null ->
            CircleCuePlan.Show(cue(determinateProgress, isConfirmed = false))
        pressed && timing == CircleActionTiming.DELIBERATE -> CircleCuePlan.Sweep
        explainsAbandonedPress(
            timing = timing,
            pressed = pressed,
            armed = armed,
            hasSomethingToSay = value != null || hint != null,
        ) -> CircleCuePlan.Explain(
            // Nothing fired, so the ring is honestly empty.
            cue = cue(progress = 0f, isConfirmed = false),
            dwellMs = MenuDesign.hintReadingMs,
        )
        else -> CircleCuePlan.Clear
    }
}

@Stable
class CircleActionCueController internal constructor() {
    internal var confirmed by mutableStateOf(false)

    fun confirm() {
        confirmed = true
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
    /** One sentence about what it does. Rendered in the same two moments. */
    hint: String? = null,
): CircleActionCueController {
    require(holdDurationMs >= 0L) { "Action cue hold duration cannot be negative" }
    require(determinateProgress == null || determinateProgress.isFinite() && determinateProgress in 0f..1f) {
        "Action cue progress must be null or a finite fraction in 0..1"
    }
    val publish = LocalCircleActionCuePublisher.current
    val owner = remember { Any() }
    val controller = remember { CircleActionCueController() }
    val explain = hint?.takeIf { it.isNotBlank() }
    val state = stateValue?.takeIf { it.isNotBlank() }
    /** This control began a hold, so its release is an answer to something. */
    var armed by remember { mutableStateOf(false) }

    LaunchedEffect(
        icon,
        label,
        timing,
        pressed,
        holdDurationMs,
        determinateProgress,
        state,
        explain,
        controller.confirmed,
        publish,
    ) {
        val plan = circleCuePlan(
            icon = icon,
            label = label,
            value = state,
            hint = explain,
            timing = timing,
            pressed = pressed,
            armed = armed,
            confirmed = controller.confirmed,
            determinateProgress = determinateProgress,
        )
        when (plan) {
            is CircleCuePlan.Settle -> {
                armed = false
                publish(CircleActionCueEvent(owner, plan.cue))
                // The HOST owns the dwell from here (see CenterHoldHost): a
                // row that closes its own menu is gone before any timer of its
                // own could finish, so keeping the clock here cancelled the
                // acknowledgement for exactly the rows that close on tap.
                // This only resets the latch so the next press can arm it.
                controller.confirmed = false
            }

            is CircleCuePlan.Show -> publish(CircleActionCueEvent(owner, plan.cue))

            CircleCuePlan.Sweep -> {
                armed = true
                animate(
                    initialValue = 0f,
                    targetValue = 1f,
                    animationSpec = tween(
                        durationMillis = holdDurationMs.toInt(),
                        easing = LinearEasing,
                    ),
                ) { value, _ ->
                    publish(
                        CircleActionCueEvent(
                            owner,
                            CircleActionCue(icon, label, value, false, state, explain),
                        ),
                    )
                }
            }

            is CircleCuePlan.Explain -> {
                armed = false
                publish(CircleActionCueEvent(owner, plan.cue))
                delay(plan.dwellMs)
                publish(CircleActionCueEvent(owner, null))
            }

            CircleCuePlan.Clear -> {
                armed = false
                publish(CircleActionCueEvent(owner, null))
            }
        }
    }
    DisposableEffect(owner, publish) {
        onDispose { publish(CircleActionCueEvent(owner, null)) }
    }
    return controller
}

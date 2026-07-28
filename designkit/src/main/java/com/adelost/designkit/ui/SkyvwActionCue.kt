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
data class SkyvwActionCue(
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
data class SkyvwActionCueEvent(
    val owner: Any,
    val cue: SkyvwActionCue?,
)

val LocalSkyvwActionCuePublisher =
    staticCompositionLocalOf<(SkyvwActionCueEvent) -> Unit> { {} }

@Stable
class SkyvwActionCueController internal constructor() {
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
fun rememberSkyvwActionCueController(
    icon: ImageVector,
    label: String,
    timing: SkyvwActionTiming,
    pressed: Boolean,
    holdDurationMs: Long = timing.holdMs,
    determinateProgress: Float? = null,
    /** Where this control stands. Rendered while held and after it commits. */
    stateValue: String? = null,
    /** One sentence about what it does. Rendered in the same two moments. */
    hint: String? = null,
): SkyvwActionCueController {
    require(holdDurationMs >= 0L) { "Action cue hold duration cannot be negative" }
    require(determinateProgress == null || determinateProgress.isFinite() && determinateProgress in 0f..1f) {
        "Action cue progress must be null or a finite fraction in 0..1"
    }
    val publish = LocalSkyvwActionCuePublisher.current
    val owner = remember { Any() }
    val controller = remember { SkyvwActionCueController() }
    val explain = hint?.takeIf { it.isNotBlank() }
    val state = stateValue?.takeIf { it.isNotBlank() }

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
        fun cue(progress: Float, confirmed: Boolean) =
            SkyvwActionCue(icon, label, progress, confirmed, state, explain)

        when {
            controller.confirmed -> {
                val settled = cue(progress = 1f, confirmed = true)
                publish(SkyvwActionCueEvent(owner, settled))
                // The HOST owns the dwell from here (see CenterHoldHost): a
                // row that closes its own menu is gone before any timer of its
                // own could finish, so keeping the clock here cancelled the
                // acknowledgement for exactly the rows that close on tap.
                // This only resets the latch so the next press can arm it.
                controller.confirmed = false
            }

            determinateProgress != null -> publish(
                SkyvwActionCueEvent(owner, cue(determinateProgress, confirmed = false)),
            )

            pressed && timing == SkyvwActionTiming.DELIBERATE -> {
                animate(
                    initialValue = 0f,
                    targetValue = 1f,
                    animationSpec = tween(
                        durationMillis = holdDurationMs.toInt(),
                        easing = LinearEasing,
                    ),
                ) { value, _ ->
                    publish(SkyvwActionCueEvent(owner, cue(value, confirmed = false)))
                }
            }

            else -> publish(SkyvwActionCueEvent(owner, null))
        }
    }
    DisposableEffect(owner, publish) {
        onDispose { publish(SkyvwActionCueEvent(owner, null)) }
    }
    return controller
}

package com.adelost.designkit.ui

import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import com.adelost.designkit.press.CirclePressProbe
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * A DEFAULT IS ALLOWED EXACTLY WHEN ITS DIRECTION IS THE SAFE ONE, and this is where that is measured.
 *
 * Two defaults in this kit decide something for a control whose author never thought about it, and
 * both are written up as failing towards the gate. Written up is not proven: a KDoc sentence about a
 * default survives the default being flipped (skyvw:1, 2026-09-20, on a case of mine that pinned the
 * ENUM'S ORDER as a proxy for the parameter's direction, which is false in both directions).
 *
 * So each one is a control that OMITS the argument, pressed. Forgetting `effect` on a locked surface
 * must make a hold, and forgetting `timing` on a row must make a gate. If either default is turned the
 * other way, the control here fires on a press nobody meant to be an action, and the case says so.
 *
 * This is also the answer to why the four row composables keep a default while the three gestures lost
 * theirs. The gestures lost theirs mechanically: a builder that reads a composition local cannot be a
 * default argument. A row can, and may, for as long as this case holds.
 */
@RunWith(RobolectricTestRunner::class)
@Config(application = android.app.Application::class, sdk = [35], qualifiers = "w390dp-h844dp-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ADefaultFailsTowardsTheGateTest {

    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val probe = CirclePressProbe(compose)
    private var taps = 0

    @Test
    fun `a control that never mentions the lock is locked by it`() {
        // No `effect` argument anywhere below. On a locked surface this control must become a hold,
        // because the marker it does not carry defaults to the answer that locks.
        probe.mount(CircleActionHostCost.WORN) {
            CompositionLocalProvider(LocalCircleTouchLock provides true) {
                Box(Modifier.fillMaxSize().background(Color.Black)) {
                    CircleIconDisc(
                        icon = RingIcons.Grid,
                        contentDescription = THE_DISC,
                        actionLabel = "GRID",
                        onTap = { taps += 1 },
                        iconTint = RingTokens.Ink,
                        timing = CircleActionTiming.IMMEDIATE,
                    )
                }
            }
        }
        taps = 0
        probe.press(compose.onNodeWithContentDescription(THE_DISC), A_PRESS_PAST_THE_SHORT_GATE)

        assertTrue(
            "a control that says nothing about what its press changes fired on a " +
                "${A_PRESS_PAST_THE_SHORT_GATE} ms press on a locked surface, so the marker's default " +
                "frees a control instead of locking it and forgetting it leaves one live in freefall",
            taps == 0,
        )
    }

    @Test
    fun `a gesture whose timing was built without a marker is locked too`() {
        // THE OTHER DEFAULT, and it is a different one. A renderer that resolves internally carries its
        // own effect default and hands it on explicitly, so a case pressing such a renderer proves the
        // RENDERER's default and says nothing about the builder's. The gesture sites call the builder
        // directly, and this is one of them: no effect argument anywhere between the finger and the
        // rule.
        probe.mount(CircleActionHostCost.WORN) {
            CompositionLocalProvider(LocalCircleTouchLock provides true) {
                Box(Modifier.fillMaxSize().background(Color.Black)) {
                    Box(
                        Modifier
                            .size(THE_TARGET)
                            // Ink of its own, because the probe refuses a control that drew none: a
                            // bare gesture on nothing would be photographed as nothing.
                            .background(RingTokens.Ink)
                            .circleSafeTap(
                                feedback = rememberCircleActionFeedbackState(),
                                timing = circleResolvedTiming(CircleActionTiming.IMMEDIATE),
                                label = THE_TAP,
                                onTap = { taps += 1 },
                            ),
                    )
                }
            }
        }
        taps = 0
        probe.press(compose.onNodeWithContentDescription(THE_TAP), A_PRESS_PAST_THE_SHORT_GATE)

        assertTrue(
            "a gesture whose timing was built without naming what its press changes fired on a " +
                "${A_PRESS_PAST_THE_SHORT_GATE} ms press on a locked surface, so the BUILDER's " +
                "default frees rather than locks and every hand-rolled control inherits that",
            taps == 0,
        )
    }

    @Test
    fun `a row that never states a timing still refuses a graze`() {
        // No `timing` argument. The kit's ordinary row is deliberate, and the point of that default
        // being allowed is that forgetting it costs a wait rather than giving away a free tap.
        probe.mount(CircleActionHostCost.WORN) {
            Box(Modifier.fillMaxSize().background(Color.Black)) {
                CircleRingRow(
                    title = "WAKE PHRASE",
                    sub = "HEY JARVIS",
                    icon = RingIcons.Grid,
                    onTap = { taps += 1 },
                )
            }
        }

        taps = 0
        probe.press(compose.onNodeWithContentDescription(THE_ROW), CirclePressProbe.A_FLICK_MS)
        assertTrue(
            "a row whose author stated no timing fired on a ${CirclePressProbe.A_FLICK_MS} ms graze, " +
                "so its default hands out a free tap rather than asking for intent",
            taps == 0,
        )

        taps = 0
        probe.press(compose.onNodeWithContentDescription(THE_ROW), CircleActionTiming.DELIBERATE.holdMs)
        assertTrue(
            "and then it refused a press that waited out the ${CircleActionTiming.DELIBERATE.holdMs} ms " +
                "its declaration resolves to, which would make the default a control nobody can operate",
            taps > 0,
        )
    }

    private companion object {
        const val THE_DISC = "Show the grid"
        const val THE_ROW = "WAKE PHRASE · HEY JARVIS"
        const val THE_TAP = "A hand-rolled control"
        val THE_TARGET = 48.dp

        /** Past the 200 ms short gate and nowhere near the lock's. */
        const val A_PRESS_PAST_THE_SHORT_GATE = 250L
    }
}

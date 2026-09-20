package com.adelost.designkit.ui

import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import com.adelost.designkit.press.CirclePress
import com.adelost.designkit.press.CirclePressProbe
import com.adelost.designkit.press.OneCuePerGatedControl
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * THE LOCK REACHING A REAL CONTROL, pressed. Row 229 PR 1's seam, proven where a rule case cannot see.
 *
 * [TheLockIsOneAnswerTest] states the rule and proves the resolver. What it cannot see is whether the
 * ambient lock ever reaches the gate of a mounted control, which is the whole point of putting it in
 * the builder instead of in a parameter: a control that never hears it keeps its tap in freefall with
 * nothing red anywhere. So this one provides [LocalCircleTouchLock] and presses the disc.
 *
 * THE MIDDLE CASE IS DELIBERATE. A press at the confirm hold must COMMIT, not just be refused shorter,
 * because a lock that refuses instead of lengthening would pass a case that only checks the short
 * press. skyvw:1 put it in his own set for the same reason.
 */
@RunWith(RobolectricTestRunner::class)
@Config(application = android.app.Application::class, sdk = [35], qualifiers = "w390dp-h844dp-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ALockedControlIsAHoldControlTest {

    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val probe = CirclePressProbe(compose)
    private val locked = mutableStateOf(false)
    private val effect = mutableStateOf(CircleActionEffect.ACTS)
    private var taps = 0

    @Test
    fun `on the ground a touch is a touch`() {
        assertTrue(
            "a ${A_PRESS_PAST_THE_SHORT_GATE} ms press did not fire a control declared immediate on an " +
                "unlocked surface",
            press(A_PRESS_PAST_THE_SHORT_GATE).committed,
        )
    }

    @Test
    fun `in the air the same touch is a hold, and its ring says so`() {
        locked.value = true

        val brushed = press(A_PRESS_PAST_THE_SHORT_GATE)
        assertTrue(
            "a ${A_PRESS_PAST_THE_SHORT_GATE} ms press fired on a locked surface, so a sleeve in " +
                "freefall fires it too",
            !brushed.committed,
        )
        // The press was cut off a long way short of the lock's gate, so this is not the completion
        // claim: it is that a control the wearer thinks is a touch starts DRAWING a wait the moment it
        // is held, which is how the ring teaches that in the air everything is the hold kind.
        val drawn = brushed.cueByFrame
        assertTrue(
            "a locked touch drew nothing across ${A_PRESS_PAST_THE_SHORT_GATE} ms, so the wearer is " +
                "given no way to learn the surface changed what a press costs. Readings: " +
                drawn.joinToString(),
            drawn.last() > 0 && drawn.last() > drawn.first(),
        )

        val held = press(MenuDesign.holdConfirmMs)
        OneCuePerGatedControl.aHeldControlDrawsItsGateOut(
            what = "a locked touch",
            gateMs = MenuDesign.holdConfirmMs,
            press = held,
        )
        assertTrue(
            "a press that waited out the ${MenuDesign.holdConfirmMs} ms the lock asks for did not " +
                "fire, so the control is refused rather than made deliberate and the instrument is " +
                "dead for the minutes it is being flown",
            held.committed,
        )
    }

    @Test
    fun `a press that only moves the view keeps its touch in the air`() {
        locked.value = true
        effect.value = CircleActionEffect.MOVES_THE_VIEW

        val brushed = press(A_PRESS_PAST_THE_SHORT_GATE)
        assertTrue(
            "a recentre needed the lock's hold, so a jumper steering to a landing area waits a second " +
                "in gloves to get the map back on themselves",
            brushed.committed,
        )
        OneCuePerGatedControl.aGrazeSaysNothing("an exempt control", brushed)
    }

    private fun press(holdFor: Long): CirclePress {
        probe.mount(CircleActionHostCost.WORN) {
            CompositionLocalProvider(LocalCircleTouchLock provides locked.value) {
                Box(Modifier.fillMaxSize().background(Color.Black)) {
                    CircleIconDisc(
                        icon = RingIcons.Grid,
                        contentDescription = THE_DISC,
                        actionLabel = "GRID",
                        onTap = { taps += 1 },
                        // A neutral glyph, so the only colour inside these bounds is the cue.
                        iconTint = RingTokens.Ink,
                        timing = CircleActionTiming.IMMEDIATE,
                        effect = effect.value,
                    )
                }
            }
        }
        taps = 0
        return probe.press(compose.onNodeWithContentDescription(THE_DISC), holdFor)
    }

    private val CirclePress.committed: Boolean get() = taps > 0

    private companion object {
        const val THE_DISC = "Show the grid"

        /** Past the 200 ms short gate and nowhere near the lock's, which is what makes it the reading. */
        const val A_PRESS_PAST_THE_SHORT_GATE = 250L
    }
}

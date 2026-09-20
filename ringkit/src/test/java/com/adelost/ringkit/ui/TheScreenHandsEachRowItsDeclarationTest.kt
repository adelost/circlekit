package com.adelost.ringkit.ui

import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import com.adelost.designkit.press.CirclePress
import com.adelost.designkit.press.CirclePressProbe
import com.adelost.designkit.ui.CircleActionTiming
import com.adelost.designkit.ui.CircleChoiceRole
import com.adelost.designkit.ui.CircleUiProfiles
import com.adelost.designkit.ui.LocalCircleSurfaceLayout
import com.adelost.designkit.ui.resolveCircleSurfaceLayout
import com.adelost.designkit.ui.MenuDesign
import com.adelost.designkit.ui.RingIcons
import kotlinx.coroutines.flow.MutableStateFlow
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * THE PATH EVERY PRODUCT ROW TAKES, which is the screen, not the row.
 *
 * [TheWakePhraseRowObeysItsDeclarationTest] mounts a RingChoiceRow directly and holds the LEAF. It
 * never goes through PhoneRingScreens or RoundRingScreens, and those are the only callers of
 * choiceRowInteraction and the path a RowSpec actually travels. lsrc:0 made that exact point with a
 * mutation (2026-09-20): choiceRowInteraction returning a fixed deliberate timing, so the SCREEN
 * ignores a row's declared kind, left ringkit 124 of 124 green. A product declaring its choice row a
 * touch could get a hold from the screen and nothing in the kit said so.
 *
 * So this one builds RowSpecs, hands them to both hosts, and presses what the host drew.
 */
@RunWith(RobolectricTestRunner::class)
@Config(application = android.app.Application::class, sdk = [35], qualifiers = "w390dp-h844dp-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class TheScreenHandsEachRowItsDeclarationTest {

    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val probe = CirclePressProbe(compose)
    private var chosen = FIRST_PHRASE
    private var acted = 0

    @Test
    fun `the phone screen gives a choice row the kind its data declares`() {
        mountPhone(::theChoiceRows)
        theTwoKindsOfChoiceRow()
    }

    @Test
    fun `the round screen gives a choice row the kind its data declares`() {
        // Only the two rows this case presses. A round face is 192 dp and a row nobody scrolled to has
        // no bounds, which the probe's ink floor refuses rather than reads as a zero.
        mountRound(::theChoiceRows)
        theTwoKindsOfChoiceRow()
    }

    @Test
    fun `the phone screen gives an action row the kind its data declares`() {
        mountPhone(::theActionRows)
        theTwoKindsOfActionRow()
    }

    @Test
    fun `the round screen gives an action row the kind its data declares`() {
        mountRound(::theActionRows)
        theTwoKindsOfActionRow()
    }

    private fun theTwoKindsOfChoiceRow() {
        // A CHOICE ROW CARRIES A HOLD WHATEVER KIND IT IS DECLARED, which is the Link defect's own
        // shape: RowSpec.holdMs is the deliberate change rung by default, and a row declared a touch
        // arrives at the screen with half a second in its other hand.
        chosen = FIRST_PHRASE
        val flicked = press(A_TOUCH_ROW, CirclePressProbe.A_FLICK_MS)
        assertTrue(
            "the screen refused a ${CirclePressProbe.A_FLICK_MS} ms press on a choice row its data " +
                "declares a touch, so the hold riding along reached the gate the screen built",
            chosen != FIRST_PHRASE,
        )
        assertEquals(
            "and it drew a wait while switching: ${flicked.cueAtItsMost} pixels of a gesture nobody " +
                "is being asked for",
            0,
            flicked.cueAtItsMost,
        )

        chosen = FIRST_PHRASE
        press(A_HOLD_ROW, CirclePressProbe.MID_HOLD_MS)
        assertTrue(
            "a ${CirclePressProbe.MID_HOLD_MS} ms press changed a phrase the row says it holds for",
            chosen == FIRST_PHRASE,
        )
        press(A_HOLD_ROW, MenuDesign.holdDeliberateMs)
        assertTrue(
            "a press that waited out the ${MenuDesign.holdDeliberateMs} ms the row declares did not " +
                "change the phrase",
            chosen != FIRST_PHRASE,
        )
    }

    private fun theTwoKindsOfActionRow() {
        acted = 0
        val flicked = press(A_TOUCH_ACTION, CirclePressProbe.A_FLICK_MS)
        assertTrue(
            "the screen refused a flick on an action row its data declares a touch",
            acted > 0,
        )
        assertEquals(
            "and it drew a wait while acting: ${flicked.cueAtItsMost} pixels",
            0,
            flicked.cueAtItsMost,
        )

        acted = 0
        press(A_HOLD_ACTION, CirclePressProbe.A_FLICK_MS)
        assertTrue("a flick fired an action row declared deliberate", acted == 0)
        press(A_HOLD_ACTION, MenuDesign.tapHoldMs)
        assertTrue("a press that waited the declared gate out did not fire", acted > 0)
    }

    // ---- the rows and the two hosts ----------------------------------------------------------------

    private val rows = MutableStateFlow(emptyList<RowSpec>())

    /** The screen reads its rows from a flow, so a choice that lands has to reach that flow. */
    private var build: () -> List<RowSpec> = ::theChoiceRows

    private fun choose(phrase: String) {
        chosen = phrase
        rows.value = build()
    }

    private fun theChoiceRows(): List<RowSpec> = listOf(
        RowSpec(
            key = "touch-choice", title = A_TOUCH_ROW, sub = chosen, icon = RingIcons.Grid,
            choices = PHRASES, onSelect = { choose(it) }, choiceRole = CircleChoiceRole.STEPPED,
            actionTiming = CircleActionTiming.IMMEDIATE,
        ),
        RowSpec(
            key = "hold-choice", title = A_HOLD_ROW, sub = chosen, icon = RingIcons.Grid,
            choices = PHRASES, onSelect = { choose(it) }, choiceRole = CircleChoiceRole.STEPPED,
            actionTiming = CircleActionTiming.DELIBERATE,
        ),
    )

    private fun theActionRows(): List<RowSpec> = listOf(
        RowSpec(
            key = "touch-action", title = A_TOUCH_ACTION, sub = "", icon = RingIcons.Grid,
            onTap = { acted += 1 }, actionTiming = CircleActionTiming.IMMEDIATE,
        ),
        RowSpec(
            key = "hold-action", title = A_HOLD_ACTION, sub = "", icon = RingIcons.Grid,
            onTap = { acted += 1 }, actionTiming = CircleActionTiming.DELIBERATE,
        ),
    )

    private val nav = mutableStateOf<RingNavigator?>(null)

    private fun mountPhone(rowsToShow: () -> List<RowSpec>) {
        build = rowsToShow
        rows.value = build()
        val screen = RingScreen.Rows(title = "SETTINGS", items = rows, showBack = false)
        nav.value = RingNavigator(screen)
        probe.mount {
            CompositionLocalProvider(
                LocalCircleSurfaceLayout provides resolveCircleSurfaceLayout(390f, 844f, round = false),
            ) {
                Box(Modifier.fillMaxSize().background(Color.Black)) {
                    PhoneRingScreen(nav = nav.value!!, onExit = {}, backLabel = "BACK")
                }
            }
        }
    }

    private fun mountRound(rowsToShow: () -> List<RowSpec>) {
        build = rowsToShow
        rows.value = build()
        val screen = RingScreen.Rows(title = "SETTINGS", items = rows, showBack = false)
        nav.value = RingNavigator(screen)
        probe.mount {
            CompositionLocalProvider(
                LocalCircleSurfaceLayout provides
                    resolveCircleSurfaceLayout(CircleUiProfiles.CANON_ROUND_CANVAS_DP, round = true),
            ) {
                // The round host draws on a face, not on a window: its rows are laid out against the
                // canonical canvas and a row measured against a phone-shaped parent gets no bounds.
                Box(
                    Modifier
                        .size(CircleUiProfiles.CANON_ROUND_CANVAS_DP.dp)
                        .background(Color.Black),
                ) {
                    RowsScreen(s = screen, nav = nav.value!!)
                }
            }
        }
    }

    private fun press(title: String, holdFor: Long): CirclePress =
        probe.press(compose.onNodeWithContentDescription(title, substring = true), holdFor)

    private companion object {
        val PHRASES = listOf("HEY JARVIS", "HEY MARVIN", "ALEXA")
        const val FIRST_PHRASE = "HEY JARVIS"
        const val A_TOUCH_ROW = "TOUCH CHOICE"
        const val A_HOLD_ROW = "HOLD CHOICE"
        const val A_TOUCH_ACTION = "TOUCH ACTION"
        const val A_HOLD_ACTION = "HOLD ACTION"
    }
}

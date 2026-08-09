package com.adelost.ringkit.ui

import com.adelost.designkit.ui.*

import androidx.compose.ui.graphics.vector.ImageVector
import com.adelost.designkit.ui.RingIcons
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The circle-language row logic is pure data → behaviour: which shape a
 * RowSpec renders as, when a choice ring lights, and what a completed
 * hold advances to. Testing it here keeps the renderer a dumb mapping.
 */
class RingRowLogicTest {
    @Test
    fun `hub rings shrink symmetrically only when floating chrome occupies the middle chord`() {
        val face = 192f
        val xAtNine = listOf(com.adelost.designkit.ui.CircleChromeSlot.HOUR_9)
        val normal = hubStatRingDiameterDp(face, emptyList())
        val reserved = hubStatRingDiameterDp(face, xAtNine)
        val inset = com.adelost.designkit.ui.roundChromeInsetDp(face, face, face / 2f, xAtNine)

        assertEquals(com.adelost.designkit.ui.MenuDesign.statRingDiameter.value, normal, 0.001f)
        assertTrue(reserved < normal)
        assertTrue(reserved * 3f + 6f <= face - inset * 2f + 0.001f)
    }
    private val onOff = listOf("OFF", "ON")
    private val volume = listOf("QUIET", "NORMAL")
    private val threeWay = listOf("A", "B", "C")

    @Test
    fun `resting choice keeps the ring dark, anything past it lights it`() {
        assertFalse(choiceIsActive(onOff, "OFF", CircleChoiceRole.TOGGLE))
        assertTrue(choiceIsActive(onOff, "ON", CircleChoiceRole.TOGGLE))
        assertFalse(choiceIsActive(volume, "QUIET", CircleChoiceRole.STEPPED))
        assertFalse(choiceIsActive(volume, "NORMAL", CircleChoiceRole.STEPPED))
        assertFalse(choiceIsActive(threeWay, "C", CircleChoiceRole.STEPPED))
    }

    @Test
    fun `hold advances to the next choice and wraps`() {
        assertEquals("ON", nextChoice(onOff, "OFF"))
        assertEquals("OFF", nextChoice(onOff, "ON"))
        assertEquals("B", nextChoice(threeWay, "A"))
        assertEquals("A", nextChoice(threeWay, "C"))
    }

    @Test
    fun `choice gesture and centre cue consume the row declared timing`() {
        val settings = row(choices = threeWay, onSelect = {}).copy(
            holdMs = DELIBERATE_CHANGE_HOLD_MS,
            actionTiming = CircleActionTiming.DELIBERATE,
        )
        val immediate = settings.copy(
            holdMs = CircleActionTiming.IMMEDIATE.holdMs,
            actionTiming = CircleActionTiming.IMMEDIATE,
        )

        assertEquals(
            ChoiceRowInteraction(DELIBERATE_CHANGE_HOLD_MS, CircleActionTiming.DELIBERATE),
            choiceRowInteraction(settings),
        )
        assertEquals(
            ChoiceRowInteraction(0L, CircleActionTiming.IMMEDIATE),
            choiceRowInteraction(immediate),
        )
    }

    @Test
    fun `a hold always has one explicit progress route`() {
        var published: Float? = null
        val external = HoldProgressFeedback.External { published = it }

        assertEquals(
            HoldProgressRoute.LOCAL_SWEEP,
            holdProgressRoute(HoldProgressFeedback.LocalSweep),
        )
        assertEquals(HoldProgressRoute.EXTERNAL_PUBLISHER, holdProgressRoute(external))
        external.publish(0.42f)
        assertEquals(0.42f, published ?: 0f, 0.001f)
    }

    @Test
    fun `a selected value outside the choice set fails loud`() {
        assertThrows(IllegalArgumentException::class.java) { nextChoice(onOff, "MAYBE") }
        assertThrows(IllegalArgumentException::class.java) {
            choiceIsActive(onOff, "MAYBE", CircleChoiceRole.TOGGLE)
        }
    }

    private fun row(
        onDec: (() -> Unit)? = null,
        onInc: (() -> Unit)? = null,
        choices: List<String> = emptyList(),
        onSelect: ((String) -> Unit)? = null,
        hint: String = "",
    ) = RowSpec(
        key = "k",
        title = "T",
        sub = choices.firstOrNull() ?: "S",
        icon = null as ImageVector?,
        hint = hint,
        onDec = onDec,
        onInc = onInc,
        choices = choices,
        onSelect = onSelect,
    )

    @Test
    fun `row semantic kind is resolved once in data`() {
        assertEquals(RowKind.INFORMATION, rowKind(row()))
        assertEquals(RowKind.CHOICE_OF_N, rowKind(row(choices = onOff, onSelect = {})))
        assertEquals(
            RowKind.TOGGLE,
            // kind is derived, so a copy that changes the role changes the
            // kind with it — there is nothing to keep in sync by hand.
            rowKind(
                row(choices = onOff, onSelect = {}).copy(
                    choiceRole = CircleChoiceRole.TOGGLE,
                ),
            ),
        )
        assertEquals(RowKind.ADJUSTMENT, rowKind(row(onDec = {}, onInc = {})))
        assertThrows(IllegalArgumentException::class.java) {
            row(onDec = {}, onInc = {}, choices = onOff, onSelect = {})
        }
    }

    @Test
    fun `continuous setting becomes a plain link with its real icon and accent`() {
        var opened = false
        val adjustment = row(onDec = {}, onInc = {}).copy(
            icon = RingIcons.Gauge,
            accent = ringIconAccent(RingIcons.Gauge),
            adjustmentValue = AdjustmentValuePresentation("300 M", "ABOVE START"),
        )
        val link = adjustmentLinkRow(adjustment) { opened = true }

        assertEquals(RowKind.ACTION, rowKind(link))
        assertSame(adjustment.icon, link.icon)
        assertEquals(adjustment.accent, link.accent)
        assertEquals(adjustment.title, link.title)
        assertEquals(adjustment.sub, link.sub)
        assertNull(link.onDec)
        assertNull(link.onInc)
        assertNull(link.adjustmentValue)
        link.onTap?.invoke()
        assertTrue(opened)
    }

    @Test
    fun `structured adjustment copy is data and cannot leak onto another row kind`() {
        val presentation = AdjustmentValuePresentation("30 M", "ABOVE START")
        val adjustment = row(onDec = {}, onInc = {}).copy(adjustmentValue = presentation)

        assertEquals(presentation, adjustment.adjustmentValue)
        assertThrows(IllegalArgumentException::class.java) {
            row().copy(adjustmentValue = presentation)
        }
        assertThrows(IllegalArgumentException::class.java) {
            AdjustmentValuePresentation("", "ABOVE START")
        }
    }

    @Test
    fun `adjustment submenu follows the latest source row and navigator back pops it`() = runBlocking {
        val first = row(onDec = {}, onInc = {}).copy(sub = "10 M")
        val rows = MutableStateFlow(listOf(first))
        val root = RingScreen.Rows(title = "FLIGHT", items = rows)
        val adjustment = root.adjustmentScreen(first)
        val navigator = RingNavigator(root)

        navigator.push(adjustment)
        rows.value = listOf(first.copy(sub = "20 M"))

        assertEquals("20 M", adjustment.row.first().sub)
        assertSame(adjustment, navigator.current)
        assertTrue(navigator.back())
        assertSame(root, navigator.current)
    }

    @Test
    fun `menu collection shape is data and grid capacity fails closed`() {
        fun launch(index: Int) = LaunchSpec(
            icon = RingIcons.Map,
            label = "ITEM $index",
            open = { null },
            run = {},
        )

        val grid = RingScreen.Launcher(
            title = "MAP",
            gridRole = MenuGridRole.MAP_CONTROLS,
            entries = List(9, ::launch),
        )
        val rows = RingScreen.Rows(title = "OPTIONS", items = kotlinx.coroutines.flow.flowOf(emptyList()))

        // The shape IS the case: a launcher carries its grid role directly and
        // a rows screen needs no layout marker at all. The parallel
        // RingMenuLayout taxonomy that restated this is gone.
        assertEquals(MenuGridRole.MAP_CONTROLS, grid.gridRole)
        assertTrue(grid is RingScreen.Menu)
        assertTrue(rows is RingScreen.Menu)
        assertThrows(IllegalArgumentException::class.java) {
            RingScreen.Launcher(
                title = "EMPTY",
                gridRole = MenuGridRole.COMPONENT_GALLERY,
                entries = emptyList(),
            )
        }
        assertThrows(IllegalArgumentException::class.java) {
            RingScreen.Launcher(
                title = "SCROLLABLE",
                gridRole = MenuGridRole.COMPONENT_GALLERY,
                entries = List(10, ::launch),
            )
        }
    }

    /** The cue reads four lines and then ellipsises, so a longer hint loses
     *  the end of the sentence it exists to deliver. The budget belongs where
     *  every hint passes, not to the one catalogue that first paid it. */
    @Test
    fun `a hint longer than the centre cue can read is rejected`() {
        val fits = "x".repeat(MenuDesign.hintMaxChars)
        assertEquals(fits, row(hint = fits).hint)
        assertThrows(IllegalArgumentException::class.java) {
            row(hint = "x".repeat(MenuDesign.hintMaxChars + 1))
        }
    }

    @Test
    fun `information rows are passive unless an action is declared`() {
        assertNull(row().onTap)
    }

    @Test
    fun `the row's base margin is style only - geometry belongs to the shared atom`() {
        // The per-SCREEN clearance constant is gone: it was simultaneously too
        // narrow mid-face and too wide at the ends, because a single number
        // cannot describe a circle. ringkit now states the plain style margin
        // and designkit's roundSafeContentInset adds the face's own geometry
        // at each row's real height.
        assertEquals(
            RingRowHorizontalInsets(start = roundRowInsetH, end = roundRowInsetH),
            ringRowHorizontalInsets(round = true),
        )
        assertEquals(
            RingRowHorizontalInsets(start = settingsRowInsetH, end = settingsRowInsetH),
            ringRowHorizontalInsets(round = false),
        )
        // A round row may not pre-pay for the X@9 zone: the atom charges it
        // only at the heights where a button is actually beside the row.
        assertEquals(10f, roundRowInsetH.value, 0.001f)
        assertEquals(36f, settingsRowInsetH.value, 0.001f)
    }

    @Test
    fun `adjustment controls clear floating back chrome inside their local round face`() {
        val localFaceDp = CircleUiProfiles.CANON_ROUND_CANVAS_DP
        val withBack = adjustmentRowInsetDp(
            viewportWidthDp = localFaceDp,
            viewportHeightDp = localFaceDp,
            round = true,
            baseInsetDp = roundRowInsetH.value,
            reservedSlots = listOf(CircleChromeSlot.HOUR_9),
        )
        val withoutBack = adjustmentRowInsetDp(
            viewportWidthDp = localFaceDp,
            viewportHeightDp = localFaceDp,
            round = true,
            baseInsetDp = roundRowInsetH.value,
            reservedSlots = emptyList(),
        )

        assertEquals(40.12f, withBack, 0.05f)
        assertEquals(roundRowInsetH.value, withoutBack, 0.001f)
        assertEquals(
            settingsRowInsetH.value,
            adjustmentRowInsetDp(
                viewportWidthDp = 360f,
                viewportHeightDp = 800f,
                round = false,
                baseInsetDp = settingsRowInsetH.value,
                reservedSlots = listOf(CircleChromeSlot.HOUR_9),
            ),
            0.001f,
        )
    }

    /**
     * The straight edge used to be measured at the viewport centre, where the
     * circle takes nothing away — so the X at 9 o'clock was the only thing
     * keeping rows inside the arc, and a chrome-less screen (first-run setup)
     * drew them straight through the glass.
     */
    @Test
    fun `a rows list is safe for its whole band, with or without chrome`() {
        val narrowFaceDp = 280f
        val titleBandBottom = (MenuDesign.roundTitleTopPadding + MenuDesign.roundTitleHeight).value
        val bare = rowsListInsetsDp(
            viewportWidthDp = narrowFaceDp,
            viewportHeightDp = narrowFaceDp,
            titleBandBottomDp = titleBandBottom,
            baseInsetDp = roundRowInsetH.value,
            reservedSlots = emptyList(),
        )
        val withBack = rowsListInsetsDp(
            viewportWidthDp = narrowFaceDp,
            viewportHeightDp = narrowFaceDp,
            titleBandBottomDp = titleBandBottom,
            baseInsetDp = roundRowInsetH.value,
            reservedSlots = listOf(CircleChromeSlot.HOUR_9),
        )

        // Mounting a button may only ever ask for MORE room, never be the
        // reason there is any.
        assertTrue("$bare", bare.start.value > roundRowInsetH.value)
        assertTrue("$bare vs $withBack", withBack.start >= bare.start)
        assertEquals("circle-only rows stay symmetric", bare.start, bare.end)
        assertEquals("X at nine must not tax the free right edge", bare.end, withBack.end)
        assertTrue("X at nine claims only the left edge", withBack.start > withBack.end)

        // Self-consistency: the width this inset yields first fits the circle
        // at (or above) the band's top, so every row from there down to the
        // mirrored depth is inside the face.
        val firstFitsAtDp = circleSafeTopInsetDp(
            narrowFaceDp,
            narrowFaceDp - bare.start.value - bare.end.value,
        )
        assertTrue("$firstFitsAtDp <= $titleBandBottom", firstFitsAtDp <= titleBandBottom + 1f)
    }

    @Test
    fun `a finite named set is a choice with dots, a continuous value is an adjustment`() {
        val finite = RowSpec(
            key = "weight",
            title = "BAR WEIGHT",
            sub = "NORMAL",
            icon = null,
            choices = listOf("X-THIN", "THIN", "NORMAL", "BOLD", "X-BOLD"),
            onSelect = {},
        )
        assertEquals(RowKind.CHOICE_OF_N, finite.kind)

        val continuous = RowSpec(
            key = "spot",
            title = "SPOT",
            sub = "300 M",
            icon = null,
            onDec = {},
            onInc = {},
        )
        assertEquals(RowKind.ADJUSTMENT, continuous.kind)
    }

    private companion object {
        /** The shipped round face: 384 x 384 px at density 1 on wear34. */
        const val FACE_DP = 384f
    }
}

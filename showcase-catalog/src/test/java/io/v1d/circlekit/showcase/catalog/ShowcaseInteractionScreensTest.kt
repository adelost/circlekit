package io.v1d.circlekit.showcase.catalog

import com.adelost.designkit.ui.CircleActionTiming
import com.adelost.designkit.ui.CircleChoiceRole
import com.adelost.designkit.ui.CircleLabelProgress
import com.adelost.ringkit.ui.RowKind
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ShowcaseInteractionScreensTest {
    @Test
    fun `timing availability and failure are declared by row data`() = runBlocking {
        val state = ShowcaseInteractionState()
        val immediate = scenario("control.action-row", "immediate")
        val recoverable = scenario("control.action-row", "recoverable")
        val blocked = scenario("control.action-row", "blocked")

        assertEquals(
            CircleActionTiming.IMMEDIATE,
            ShowcaseInteractionScreens.actionRows(immediate, state).items.first().single().actionTiming,
        )
        state.prepare(ShowcaseCaseId("control.action-row"), recoverable.id)
        assertNotNull(ShowcaseInteractionScreens.actionRows(recoverable, state).items.first().single().onTap)
        state.prepare(ShowcaseCaseId("control.action-row"), blocked.id)
        assertNull(ShowcaseInteractionScreens.actionRows(blocked, state).items.first().single().onTap)
    }

    @Test
    fun `the two kinds page puts one of each on one screen, both pressable`() = runBlocking {
        // Row 225. The page exists so the two kinds can be pressed against each other: a picture of a
        // hold beside a live tap would show the difference without letting anyone feel it.
        val state = ShowcaseInteractionState()
        val both = scenario("control.action-row", "both")
        state.prepare(ShowcaseCaseId("control.action-row"), both.id)
        val rows = ShowcaseInteractionScreens.actionRows(both, state).items.first()

        assertEquals("the page did not carry two controls", 2, rows.size)
        assertEquals(
            "the page showed the same kind twice, so there is nothing to compare",
            listOf(CircleActionTiming.IMMEDIATE, CircleActionTiming.DELIBERATE),
            rows.map { it.actionTiming },
        )
        rows.forEach { assertNotNull("a control on the comparison page cannot be pressed", it.onTap) }
    }

    @Test
    fun `each kind counts its own presses, so neither claims the other's`() = runBlocking {
        // A shared tally made a touch on CENTER VIEW raise "HOLD · FIRED n" on SAVE VIEW beside it,
        // so the one page built to compare the two kinds showed the hold row firing when nobody had
        // held it. On this page that is not a stale number, it is the wrong lesson.
        val state = ShowcaseInteractionState()
        val both = scenario("control.action-row", "both")
        state.prepare(ShowcaseCaseId("control.action-row"), both.id)
        suspend fun subs() = ShowcaseInteractionScreens.actionRows(both, state).items.first().map { it.sub }

        assertEquals(listOf("TAP · FIRED 0", "HOLD · FIRED 0"), subs())

        requireNotNull(ShowcaseInteractionScreens.actionRows(both, state).items.first()[0].onTap).invoke()
        assertEquals(
            "the touch's press was counted by the hold row as well",
            listOf("TAP · FIRED 1", "HOLD · FIRED 0"),
            subs(),
        )

        requireNotNull(ShowcaseInteractionScreens.actionRows(both, state).items.first()[1].onTap).invoke()
        assertEquals(
            "the hold's press was counted by the touch row as well",
            listOf("TAP · FIRED 1", "HOLD · FIRED 1"),
            subs(),
        )
    }

    @Test
    fun `choice adjustment and measured work retain their semantic specs`() = runBlocking {
        val state = ShowcaseInteractionState()
        val last = scenario("control.choice-row", "last")
        state.prepare(ShowcaseCaseId("control.choice-row"), last.id)
        val choice = ShowcaseInteractionScreens.choiceRows(last, state).items.first().single()
        assertEquals(7, choice.choices.size)
        assertEquals("SUN", choice.sub)
        assertEquals(CircleChoiceRole.STEPPED, choice.choiceRole)

        val adjustmentScenario = scenario("control.adjustment", "deliberate")
        val adjustment = ShowcaseInteractionScreens
            .adjustmentRows(adjustmentScenario, state)
            .items
            .first()
            .single()
        assertEquals(RowKind.ADJUSTMENT, adjustment.kind)
        assertNotNull(adjustment.adjustHoldMs)

        val half = scenario("control.progress", "half")
        state.prepare(ShowcaseCaseId("control.progress"), half.id)
        val progress = ShowcaseInteractionScreens.progressRows(half, state).items.first().single().labelProgress
        assertTrue(progress is CircleLabelProgress.Determinate)
        assertEquals(0.5f, (progress as CircleLabelProgress.Determinate).fraction)
    }

    private fun scenario(caseId: String, scenarioId: String): ShowcaseScenario =
        requireNotNull(
            ShowcaseManifest.find(ShowcaseCaseId(caseId), ShowcaseScenarioId(scenarioId)),
        ).second
}

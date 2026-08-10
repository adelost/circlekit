package io.v1d.circlekit.showcase.catalog

import org.junit.Assert.assertFalse
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import com.adelost.designkit.ui.CircleHostMode
import com.adelost.designkit.ui.CircleHostPreviewState

class ShowcaseSessionTest {
    @Test
    fun `host presentation changes cannot mutate product destination or state`() {
        val session = ShowcaseSession(ShowcaseArtifactProfile.PHONE_FULL_UI)
        session.open(ShowcaseCaseId("control.choice-row"), ShowcaseScenarioId("middle"))
        val destination = session.destination.value
        val choice = session.interaction.choiceIndex.value

        CircleHostPreviewState(mode = CircleHostMode.WATCH_EXACT)

        assertEquals(destination, session.destination.value)
        assertEquals(choice, session.interaction.choiceIndex.value)
    }

    @Test
    fun `probe opens named scenario and invokes only safe action ids`() {
        val session = ShowcaseSession(ShowcaseArtifactProfile.PHONE_FULL_UI)

        assertTrue(
            session.handle(
                ShowcaseProbeCommand(
                    verb = "open",
                    caseId = "atom.icon-action",
                    scenarioId = "immediate",
                ),
            ).ok,
        )
        assertTrue(
            session.handle(
                ShowcaseProbeCommand(
                    verb = "invoke",
                    actionId = ShowcaseSession.ACTION_TOGGLE_ICON,
                ),
            ).ok,
        )
        assertTrue(session.iconActionActive.value)

        assertFalse(
            session.handle(
                ShowcaseProbeCommand(verb = "invoke", actionId = "product.delete-everything"),
            ).ok,
        )
        assertTrue(session.iconActionActive.value)
    }

    @Test
    fun `named interaction actions mutate only deterministic showcase state`() {
        val session = ShowcaseSession(ShowcaseArtifactProfile.PHONE_FULL_UI)

        assertTrue(session.open(ShowcaseCaseId("control.choice-row"), ShowcaseScenarioId("middle")))
        assertEquals(3, session.interaction.choiceIndex.value)
        assertTrue(session.invoke(ShowcaseActionId(ShowcaseSession.ACTION_NEXT_CHOICE)))
        assertEquals(4, session.interaction.choiceIndex.value)

        assertTrue(session.open(ShowcaseCaseId("control.adjustment"), ShowcaseScenarioId("maximum")))
        assertEquals(1_000, session.interaction.adjustmentValue.value)
        assertTrue(session.invoke(ShowcaseActionId(ShowcaseSession.ACTION_INCREMENT)))
        assertEquals(1_000, session.interaction.adjustmentValue.value)

        assertTrue(session.open(ShowcaseCaseId("control.progress"), ShowcaseScenarioId("failed")))
        assertEquals(ShowcaseWorkState.FAILED, session.interaction.work.value)
        assertTrue(session.invoke(ShowcaseActionId(ShowcaseSession.ACTION_ADVANCE_PROGRESS)))
        assertEquals(ShowcaseWorkState.INDETERMINATE, session.interaction.work.value)
    }

    @Test
    fun `recoverable availability has an action while blocked stays blocked`() {
        val session = ShowcaseSession(ShowcaseArtifactProfile.PHONE_FULL_UI)

        session.open(ShowcaseCaseId("control.action-row"), ShowcaseScenarioId("recoverable"))
        assertEquals(ShowcaseAvailability.RECOVERABLE, session.interaction.availability.value)
        session.invoke(ShowcaseActionId(ShowcaseSession.ACTION_RECOVER))
        assertEquals(ShowcaseAvailability.AVAILABLE, session.interaction.availability.value)

        session.open(ShowcaseCaseId("control.action-row"), ShowcaseScenarioId("blocked"))
        assertEquals(ShowcaseAvailability.BLOCKED, session.interaction.availability.value)
    }

    @Test
    fun `invalid destination is refused without changing state`() {
        val session = ShowcaseSession(ShowcaseArtifactProfile.PHONE_FULL_UI)

        assertFalse(
            session.handle(
                ShowcaseProbeCommand(
                    verb = "open",
                    caseId = "missing",
                    scenarioId = "missing",
                ),
            ).ok,
        )
        assertTrue(session.destination.value.isRoot)
    }

    @Test
    fun `back is delegated to current navigation owner`() {
        val session = ShowcaseSession(ShowcaseArtifactProfile.PHONE_FULL_UI)
        var calls = 0
        session.attachNavigationBack {
            calls += 1
            true
        }

        assertTrue(session.handle(ShowcaseProbeCommand("back")).ok)
        assertTrue(calls == 1)
    }

    @Test
    fun `page back executes the registered system or previous behavior`() {
        val session = ShowcaseSession(ShowcaseArtifactProfile.PHONE_FULL_UI)
        var previousCalls = 0

        assertFalse(session.backPage { previousCalls += 1; true })
        assertEquals(0, previousCalls)

        assertTrue(session.route("section.atoms"))
        assertEquals("section.atoms", session.activePage.value)
        assertTrue(session.backPage { previousCalls += 1; true })
        assertEquals(1, previousCalls)
        assertEquals("section.foundations", session.activePage.value)
    }
}

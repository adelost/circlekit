package io.v1d.circlekit.showcase.catalog

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ShowcaseSessionTest {
    @Test
    fun `probe opens named scenario and invokes only safe action ids`() {
        val session = ShowcaseSession()

        assertTrue(
            session.handle(
                ShowcaseProbeCommand(
                    verb = "open",
                    caseId = "atom.icon-action",
                    scenarioId = "interactive",
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
    fun `invalid destination is refused without changing state`() {
        val session = ShowcaseSession()

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
        val session = ShowcaseSession()
        var calls = 0
        session.attachNavigationBack {
            calls += 1
            true
        }

        assertTrue(session.handle(ShowcaseProbeCommand("back")).ok)
        assertTrue(calls == 1)
    }
}

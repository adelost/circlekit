package io.v1d.circlekit.showcase.catalog

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ShowcaseManifestTest {
    @Test
    fun `manifest and registry coverage are reciprocal`() {
        assertEquals(
            ShowcaseFamily.entries.toSet(),
            ShowcaseManifest.cases.map(ShowcaseCase::family).toSet(),
        )
        assertEquals(
            ShowcaseComponentFamily.entries.toSet(),
            ShowcaseManifest.cases.map(ShowcaseCase::componentFamily).toSet(),
        )
        assertEquals(
            ShowcaseManifest.cases.size,
            ShowcaseManifest.cases.map(ShowcaseCase::componentFamily).distinct().size,
        )
        assertEquals(
            ShowcaseManifest.cases.size,
            ShowcaseManifest.cases.map { it.id.value }.distinct().size,
        )
        ShowcaseManifest.cases.forEach { case ->
            assertTrue(case.scenarios.isNotEmpty())
            assertEquals(
                case.scenarios.size,
                case.scenarios.map { it.id.value }.distinct().size,
            )
            assertTrue(case.id.value.matches(Regex("[a-z0-9.-]+")))
            assertTrue(case.scenarios.all { it.id.value.matches(Regex("[a-z0-9.-]+")) })
        }
    }

    @Test
    fun `every declared scenario resolves through the production presentation seam`() {
        val session = ShowcaseSession()

        ShowcaseManifest.cases.forEach { case ->
            case.scenarios.forEach { scenario ->
                assertTrue(session.open(case.id, scenario.id))
                ShowcasePresentations.selected(
                    destination = session.destination.value,
                    session = session,
                    surface = com.adelost.designkit.ui.CircleSurfaceClass.PHONE_COMPACT,
                    textEntryPort = null,
                )
            }
        }
    }

    @Test
    fun `all seven RingScreen cases are represented and exhaustively classified`() {
        val session = ShowcaseSession()
        val declared = requireNotNull(ShowcaseManifest.find(ShowcaseCaseId("template.screens")))
            .scenarios
            .map { it.id.value }
            .toSet()

        assertTrue(ShowcaseScreenCase.entries.all { it.scenarioId in declared })
        assertEquals(
            ShowcaseScreenCase.entries.toSet(),
            ShowcaseTemplateFixtures.representatives(session)
                .map(ShowcaseTemplateFixtures::kindOf)
                .toSet(),
        )
    }

    @Test
    fun `root groups every declared family through the normal launcher grammar`() {
        val root = ShowcaseScreens.root(ShowcaseSession()) as com.adelost.ringkit.ui.RingScreen.Launcher

        assertEquals(ShowcaseFamily.entries.size, root.entries.size)
        root.entries.forEach { entry ->
            assertTrue(entry.open() is com.adelost.ringkit.ui.RingScreen.Launcher)
        }
    }

    @Test
    fun `round chrome cases reserve the declared slots`() {
        val xOnly = ShowcaseScreens.reservedChrome(
            ShowcaseDestination(ShowcaseCaseId("foundation.geometry"), ShowcaseScenarioId("chrome-x")),
        )
        val xAndGear = ShowcaseScreens.reservedChrome(
            ShowcaseDestination(
                ShowcaseCaseId("foundation.geometry"),
                ShowcaseScenarioId("chrome-x-gear"),
            ),
        )

        assertEquals(listOf(com.adelost.designkit.ui.CircleChromeSlot.HOUR_9), xOnly)
        assertEquals(
            listOf(
                com.adelost.designkit.ui.CircleChromeSlot.HOUR_9,
                com.adelost.designkit.ui.CircleChromeSlot.HOUR_8,
            ),
            xAndGear,
        )
    }
}

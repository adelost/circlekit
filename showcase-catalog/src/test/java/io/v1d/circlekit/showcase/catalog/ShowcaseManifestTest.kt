package io.v1d.circlekit.showcase.catalog

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ShowcaseManifestTest {
    @Test
    fun `generated manifest and independent native bindings are reciprocal`() {
        assertEquals(
            ShowcaseFamily.entries.toSet(),
            ShowcaseManifest.cases.map(ShowcaseCase::family).toSet(),
        )
        assertEquals(
            ShowcaseManifest.cases.map { it.id.value }.toSet(),
            ShowcaseNativeBindings.components.map { it.componentId }.toSet(),
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
        assertEquals(
            setOf(SHOWCASE_PHONE_PROFILE, SHOWCASE_WEAR_PROFILE),
            ShowcaseManifest.profiles,
        )
        assertTrue(
            ShowcaseNativeBindings.components.all { it.profiles == ShowcaseManifest.profiles },
        )
        assertEquals(
            ShowcaseFamily.entries.flatMap { family ->
                listOf("round", "compact", "wide").map { surface -> "section.${family.id}/$surface" }
            }.toSet(),
            ShowcaseManifest.componentTrees.map { "${it.screenId}/${it.surface}" }.toSet(),
        )
    }

    @Test
    fun `every declared scenario resolves through the production presentation seam`() {
        val session = ShowcaseSession(ShowcaseArtifactProfile.PHONE_FULL_UI)

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
        val session = ShowcaseSession(ShowcaseArtifactProfile.PHONE_FULL_UI)
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
        val root = ShowcaseScreens.root(
            ShowcaseSession(ShowcaseArtifactProfile.PHONE_FULL_UI),
        ) as com.adelost.ringkit.ui.RingScreen.Launcher

        assertEquals(ShowcaseFamily.entries.size, root.entries.size)
        assertEquals("TOKENS", root.entries.first().label)
        assertTrue(root.entries.all { it.label.length <= 9 })
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

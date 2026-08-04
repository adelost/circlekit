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
        // The product declares five artifact profiles across four hosts; THIS host renders
        // two of them. Asserting the product's set equals the Android pair was true only
        // while Showcase was Android-only, and it has been red since the iPhone, watchOS and
        // Garmin artifacts landed. They are two different facts, so they get two assertions:
        // the host renders exactly its pair, and its pair is part of what the product
        // declares. Collapsing them is what made a passing assertion impossible.
        assertEquals(
            setOf(SHOWCASE_PHONE_PROFILE, SHOWCASE_WEAR_PROFILE),
            ShowcaseNativeBindings.profiles,
        )
        assertTrue(ShowcaseManifest.profiles.containsAll(ShowcaseNativeBindings.profiles))
        assertTrue(
            ShowcaseNativeBindings.components.all { it.profiles == ShowcaseNativeBindings.profiles },
        )
        // Derived, not hand-listed. The old expectation enumerated exactly the seven
        // section screens, so the Garmin artifact family made it red the day it landed and
        // any future family would do the same. What actually matters is total surface
        // coverage: every screen the product declares a tree for carries all three, and
        // every section has one. A new family extends the set instead of breaking it.
        val surfacesByScreen = ShowcaseManifest.componentTrees
            .groupBy { it.screenId }
            .mapValues { (_, trees) -> trees.map { it.surface }.toSet() }
        assertTrue(
            "screens missing a surface: $surfacesByScreen",
            surfacesByScreen.values.all { it == setOf("round", "compact", "wide") },
        )
        assertTrue(
            ShowcaseFamily.entries.map { "section.${it.id}" }
                .all(surfacesByScreen::containsKey),
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

package io.v1d.circlekit.showcase.catalog

import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import com.adelost.ringkit.ui.RingScreen

class ShowcaseManifestTest {
    @Test
    fun `structure drilldown fits real launcher capacity and reaches every port owner`() = runBlocking {
        val found = mutableSetOf<String>()
        suspend fun visit(screen: RingScreen) {
            when (screen) {
                is RingScreen.Launcher -> screen.entries.forEach { visit(requireNotNull(it.open())) }
                is RingScreen.Rows -> screen.items.first().singleOrNull { it.key == "owner" }?.let {
                    found += it.sub
                }
                else -> error("Unexpected structure presentation")
            }
        }
        visit(ShowcaseStructureScreens.root())
        assertEquals(ShowcaseProductInspectorRegistry.ports.map { it.ownerId }.toSet(), found)
    }

    @Test
    fun `generated manifest and independent native bindings are reciprocal`() {
        assertEquals(
            ShowcaseFamily.entries.toSet(),
            ShowcaseManifest.cases.map(ShowcaseCase::family).toSet(),
        )
        assertEquals(
            ShowcaseManifest.ports.filter { it.ownerKind == "component" }.map { it.typeRef }.toSet(),
            ShowcaseNativeBindings.components.map { it.componentId }.toSet(),
        )
        assertEquals(
            ShowcaseManifest.cases.size,
            ShowcaseManifest.cases.map { it.id.value }.distinct().size,
        )
        ShowcaseManifest.cases.forEach { case ->
            assertTrue(case.scenarios.isNotEmpty())
            assertTrue(case.purpose.isNotBlank())
            assertTrue(case.scenarios.all { it.description.isNotBlank() && it.description != it.label })
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
        assertEquals(
            ShowcaseManifest.nodes.map { it.id }.toSet(),
            ShowcaseNativeBindings.nodes.map { it.nodeId }.toSet(),
        )
        assertSame(ShowcaseManifest.ports, ShowcaseProductInspectorRegistry.ports)
        assertSame(ShowcaseManifest.bindings, ShowcaseProductInspectorRegistry.bindings)

        // Artifact scopes, not the raw three-surface authoring families, are what hosts consume.
        val surfacesByScreen = ShowcaseManifest.componentTrees
            .groupBy { it.artifactProfileId to it.screenId }
            .mapValues { (_, trees) -> trees.map { it.surface }.toSet() }
        ShowcaseManifest.artifactScreens.forEach { (profile, screens) ->
            val expected = if (profile in setOf(SHOWCASE_PHONE_PROFILE, "iphone-full-ui")) {
                setOf("compact", "wide")
            } else {
                setOf("round")
            }
            screens.forEach { screen ->
                assertEquals("$profile/$screen", expected, surfacesByScreen[profile to screen])
            }
        }
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
        assertEquals(ShowcaseFamily.entries.first().menuLabel, root.entries.first().label)
        assertTrue(root.entries.all { it.label.length <= 9 })
        root.entries.zip(ShowcaseFamily.entries).forEach { (entry, family) ->
            assertEquals(androidx.compose.ui.graphics.Color(family.categoryArgb), entry.semanticColor)
            val screen = entry.open()
            if (ShowcaseManifest.cases.count { it.family == family } == 1) {
                assertTrue(screen is com.adelost.ringkit.ui.RingScreen.Rows)
            } else {
                assertTrue(screen is com.adelost.ringkit.ui.RingScreen.Launcher)
            }
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

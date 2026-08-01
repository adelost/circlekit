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

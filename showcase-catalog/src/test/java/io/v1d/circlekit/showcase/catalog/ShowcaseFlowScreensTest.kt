package io.v1d.circlekit.showcase.catalog

import com.adelost.designkit.ui.CircleLabelProgress
import com.adelost.releasekit.UpdateState
import com.adelost.ringkit.data.Health
import com.adelost.ringkit.data.FetchError
import com.adelost.ringkit.data.SourceState
import com.adelost.ringkit.ui.RingScreen
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ShowcaseFlowScreensTest {
    @Test
    fun `source fixtures keep last good data and expose honest health`() = runBlocking {
        val state = ShowcaseFlowState()
        state.prepare(ShowcaseCaseId("flow.source"), ShowcaseScenarioId("partial"))
        val screen = ShowcaseFlowScreens.source(state)

        assertEquals("16°", screen.hero.first())
        assertEquals(Health.AGING, screen.health.first())
        assertEquals(3, screen.progress.first()?.done)

        state.prepare(ShowcaseCaseId("flow.source"), ShowcaseScenarioId("broken"))
        assertEquals(Health.BROKEN, screen.health.first())
        assertTrue(screen.freshness.first().contains("TIMEOUT"))

        state.refreshSource()
        assertEquals(Health.FRESH, screen.health.first())
        assertEquals("18°", screen.hero.first())

        val retained = SourceState(
            value = "18°",
            fetchedAtWall = ShowcaseFlowState.NOW_WALL_MS - 120_000L,
            lastError = FetchError.Timeout,
        )
        assertEquals("UPDATE FAILED · TIMEOUT", ShowcaseFlowScreens.sourceCopy(retained))
        assertEquals("FRESH · 2 MIN AGO · TIMEOUT", ShowcaseFlowScreens.sourceFreshness(retained, Health.FRESH))
        assertEquals(
            "LAST VALUE · 2 MIN AGO · FETCHING · RESPONSE PENDING",
            ShowcaseFlowScreens.sourceFreshness(retained.copy(inFlight = true), Health.AGING),
        )
        assertEquals("NO VALUE · TIMEOUT", ShowcaseFlowScreens.sourceCopy(retained.copy(value = null)))

        state.prepare(ShowcaseCaseId("flow.source"), ShowcaseScenarioId("aging"))
        assertEquals(Health.AGING, screen.health.first())
        assertEquals("LAST VALUE · 60 MIN AGO", screen.freshness.first())
    }

    @Test
    fun `update fixture projects every state without download or install side effects`() = runBlocking {
        val state = ShowcaseFlowState()
        state.prepare(ShowcaseCaseId("flow.update"), ShowcaseScenarioId("downloading"))
        val rows = ShowcaseFlowScreens.update(state).items.first()
        val row = rows.first { it.key == "update" }

        assertTrue(row.sub.contains("56%"))
        assertTrue(row.labelProgress is CircleLabelProgress.Determinate)
        assertNull(row.onTap)
        assertTrue(rows.any { it.key == "update-published" })

        state.prepare(ShowcaseCaseId("flow.update"), ShowcaseScenarioId("failed"))
        val failed = ShowcaseFlowScreens.update(state).items.first().single()
        assertNotNull(failed.onTap)
        failed.onTap?.invoke()
        assertEquals(UpdateState.Checking, state.update.value)
    }

    @Test
    fun `service fixture exposes active failure and cache truth as ordinary rows`() = runBlocking {
        val state = ShowcaseFlowState()
        state.prepare(ShowcaseCaseId("flow.service"), ShowcaseScenarioId("active"))
        val active = ShowcaseFlowScreens.service(state).items.first()

        assertTrue(active.first().sub.startsWith("ACTIVE"))
        assertTrue(active.first().labelProgress is CircleLabelProgress.Indeterminate)
        assertNull(active.first().onTap)

        state.prepare(ShowcaseCaseId("flow.service"), ShowcaseScenarioId("cache"))
        val cached = ShowcaseFlowScreens.service(state).items.first()
        assertTrue(cached.last().sub.contains("24 MB"))
        assertFalse(cached.any { it.sub.contains("https://") })
    }

    @Test
    fun `empty max and long content stay in normal RingScreen data`() = runBlocking {
        val session = ShowcaseSession(ShowcaseArtifactProfile.PHONE_FULL_UI)
        val caseId = ShowcaseCaseId("template.screens")

        fun screen(id: String): RingScreen = ShowcaseTemplateFixtures.screen(
            requireNotNull(ShowcaseManifest.find(caseId, ShowcaseScenarioId(id))).second,
            session,
        )

        assertTrue((screen("empty") as RingScreen.Rows).items.first().isEmpty())
        assertEquals(18, (screen("max-capacity") as RingScreen.Rows).items.first().size)
        assertTrue(
            (screen("long-content") as RingScreen.Rows).items.first().single().title.length > 40,
        )
    }
}

package io.v1d.circlekit.showcase.catalog

import com.adelost.designkit.ui.CircleLabelProgress
import com.adelost.releasekit.UpdateState
import com.adelost.ringkit.data.Health
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
        val session = ShowcaseSession(ShowcaseArtifactProfile.PHONE_FULL_UI)
        val mounted = mount(session, "flow.source", "partial")
        val model = mounted.runtime().flows
        val emitter = mounted.eventEmitter as ShowcaseTypedRendererEmitter
        val screen = ShowcaseFlowScreens.source(model, emitter)

        assertEquals("16°", screen.hero.first())
        assertEquals(Health.AGING, screen.health.first())
        assertEquals(3, screen.progress.first()?.done)

        session.flows.prepare(ShowcaseCaseId("flow.source"), ShowcaseScenarioId("broken"))
        assertEquals(Health.BROKEN, screen.health.first())
        assertTrue(screen.freshness.first().contains("TIMEOUT"))

        session.flows.refreshSource()
        assertEquals(Health.FRESH, screen.health.first())
        assertEquals("18°", screen.hero.first())
    }

    @Test
    fun `update fixture projects every state without download or install side effects`() = runBlocking {
        val session = ShowcaseSession(ShowcaseArtifactProfile.PHONE_FULL_UI)
        val mounted = mount(session, "flow.update", "downloading")
        val model = mounted.runtime().flows
        val emitter = mounted.eventEmitter as ShowcaseTypedRendererEmitter
        val rows = ShowcaseFlowScreens.update(model, emitter).items.first()
        val row = rows.first { it.key == "update" }

        assertTrue(row.sub.contains("56%"))
        assertTrue(row.labelProgress is CircleLabelProgress.Determinate)
        assertNull(row.onTap)
        assertTrue(rows.any { it.key == "update-published" })

        session.flows.prepare(ShowcaseCaseId("flow.update"), ShowcaseScenarioId("failed"))
        val failed = ShowcaseFlowScreens.update(model, emitter).items.first().single()
        assertNotNull(failed.onTap)
        failed.onTap?.invoke()
        assertEquals(UpdateState.Checking, session.flows.update.value)
    }

    @Test
    fun `service fixture exposes active failure and cache truth as ordinary rows`() = runBlocking {
        val session = ShowcaseSession(ShowcaseArtifactProfile.PHONE_FULL_UI)
        val mounted = mount(session, "flow.service", "active")
        val model = mounted.runtime().flows
        val emitter = mounted.eventEmitter as ShowcaseTypedRendererEmitter
        val active = ShowcaseFlowScreens.service(model, emitter).items.first()

        assertTrue(active.first().sub.startsWith("ACTIVE"))
        assertTrue(active.first().labelProgress is CircleLabelProgress.Indeterminate)
        assertNull(active.first().onTap)

        session.flows.prepare(ShowcaseCaseId("flow.service"), ShowcaseScenarioId("cache"))
        val cached = ShowcaseFlowScreens.service(model, emitter).items.first()
        assertTrue(cached.last().sub.contains("24 MB"))
        assertFalse(cached.any { it.sub.contains("https://") })
    }

    @Test
    fun `empty max and long content stay in normal RingScreen data`() = runBlocking {
        val caseId = ShowcaseCaseId("template.screens")

        fun screen(id: String): RingScreen {
            val session = ShowcaseSession(ShowcaseArtifactProfile.PHONE_FULL_UI)
            val mounted = mount(session, caseId.value, id)
            return ShowcaseTemplateFixtures.screen(
                requireNotNull(ShowcaseManifest.find(caseId, ShowcaseScenarioId(id))).second,
                mounted.runtime(),
                mounted.eventEmitter as ShowcaseTypedRendererEmitter,
            )
        }

        assertTrue((screen("empty") as RingScreen.Rows).items.first().isEmpty())
        assertEquals(18, (screen("max-capacity") as RingScreen.Rows).items.first().size)
        assertTrue(
            (screen("long-content") as RingScreen.Rows).items.first().single().title.length > 40,
        )
    }

    private fun mount(session: ShowcaseSession, caseId: String, scenarioId: String): ShowcaseMountedRenderer {
        assertTrue(session.open(ShowcaseCaseId(caseId), ShowcaseScenarioId(scenarioId)))
        return ShowcaseNativeBindings.mountRenderer(
            session,
            session.destination.value,
            com.adelost.designkit.ui.CircleSurfaceClass.PHONE_COMPACT,
            null,
        )
    }

    private fun ShowcaseMountedRenderer.runtime(): ShowcaseRuntimeRendererInput =
        inputs.require("${renderer.componentId()}.renderer")
}

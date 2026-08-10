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
        val session = ShowcaseSession(ShowcaseArtifactProfile.PHONE_FULL_UI)
        val mounted = mount(session, "control.action-row", "immediate")
        val model = mounted.snapshot<ShowcaseActionRowSnapshot>()
        val emitter = mounted.eventEmitter as ShowcaseTypedRendererEmitter
        val immediate = scenario("control.action-row", "immediate")
        val recoverable = scenario("control.action-row", "recoverable")
        val blocked = scenario("control.action-row", "blocked")

        assertEquals(
            CircleActionTiming.IMMEDIATE,
            ShowcaseInteractionScreens.actionRows(immediate, model, emitter).items.first().single().actionTiming,
        )
        session.interaction.prepare(ShowcaseCaseId("control.action-row"), recoverable.id)
        assertNotNull(ShowcaseInteractionScreens.actionRows(
            recoverable,
            snapshot(session),
            emitter,
        ).items.first().single().onTap)
        session.interaction.prepare(ShowcaseCaseId("control.action-row"), blocked.id)
        assertNull(ShowcaseInteractionScreens.actionRows(blocked, snapshot(session), emitter).items.first().single().onTap)
    }

    @Test
    fun `choice adjustment and measured work retain their semantic specs`() = runBlocking {
        val session = ShowcaseSession(ShowcaseArtifactProfile.PHONE_FULL_UI)
        val last = scenario("control.choice-row", "last")
        val mounted = mount(session, "control.choice-row", "last")
        val model = mounted.snapshot<ShowcaseChoiceSnapshot>()
        val emitter = mounted.eventEmitter as ShowcaseTypedRendererEmitter
        val choice = ShowcaseInteractionScreens.choiceRows(last, model, emitter).items.first().single()
        assertEquals(7, choice.choices.size)
        assertEquals("G", choice.sub)
        assertEquals(CircleChoiceRole.STEPPED, choice.choiceRole)

        val adjustmentScenario = scenario("control.adjustment", "deliberate")
        val adjustment = ShowcaseInteractionScreens
            .adjustmentRows(adjustmentScenario, ShowcaseAdjustmentSnapshot(500), emitter)
            .items
            .first()
            .single()
        assertEquals(RowKind.ADJUSTMENT, adjustment.kind)
        assertNotNull(adjustment.adjustHoldMs)

        val half = scenario("control.progress", "half")
        session.interaction.prepare(ShowcaseCaseId("control.progress"), half.id)
        val progress = ShowcaseInteractionScreens.progressRows(
            half,
            ShowcaseProgressSnapshot(session.interaction.work.value),
            emitter,
        ).items.first().single().labelProgress
        assertTrue(progress is CircleLabelProgress.Determinate)
        assertEquals(0.5f, (progress as CircleLabelProgress.Determinate).fraction)
    }

    private fun scenario(caseId: String, scenarioId: String): ShowcaseScenario =
        requireNotNull(
            ShowcaseManifest.find(ShowcaseCaseId(caseId), ShowcaseScenarioId(scenarioId)),
        ).second

    private fun mount(session: ShowcaseSession, caseId: String, scenarioId: String): ShowcaseMountedRenderer {
        assertTrue(session.open(ShowcaseCaseId(caseId), ShowcaseScenarioId(scenarioId)))
        return ShowcaseNativeBindings.mountRenderer(
            session,
            session.destination.value,
            com.adelost.designkit.ui.CircleSurfaceClass.PHONE_COMPACT,
            null,
        )
    }

    private fun snapshot(session: ShowcaseSession): ShowcaseActionRowSnapshot = ShowcaseActionRowSnapshot(
        session.interaction.actionCount.value,
        session.interaction.actionFailed.value,
        session.interaction.availability.value,
    )

    private inline fun <reified T> ShowcaseMountedRenderer.snapshot(): T =
        inputs.require("${renderer.componentId()}.renderer")
}

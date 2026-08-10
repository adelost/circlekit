package io.v1d.circlekit.showcase.catalog

import com.adelost.designkit.ui.CircleColorTheme
import com.adelost.releasekit.UpdateState
import com.adelost.ringkit.data.SourceState
import com.adelost.ringkit.ui.RingPlaybackState
import com.adelost.ringkit.ui.RingTextEntryPort
import com.adelost.servicekit.ServiceSnapshot
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState

data class ShowcaseRendererEventPayload(
    val actionId: String,
    val value: String? = null,
)

sealed interface ShowcaseRendererEmitter

fun interface ShowcaseTypedRendererEmitter : ShowcaseRendererEmitter {
    fun emit(payload: ShowcaseRendererEventPayload)
}

class ShowcaseEmptyRendererEmitter : ShowcaseRendererEmitter {
    fun emit(event: Nothing): Nothing = error("Read-only Showcase renderer cannot emit $event")
}

data class ShowcaseCatalogRendererInput(
    val case: ShowcaseCase,
    val scenario: ShowcaseScenario,
)

data class ShowcaseNavigationRendererInput(val destination: ShowcaseDestination)

data class ShowcaseIconActionSnapshot(val active: Boolean)
data class ShowcaseActionRowSnapshot(
    val count: Int,
    val failed: Boolean,
    val availability: ShowcaseAvailability,
)
data class ShowcaseChoiceSnapshot(val selectedIndex: Int)
data class ShowcaseAdjustmentSnapshot(val value: Int)
data class ShowcaseProgressSnapshot(val work: ShowcaseWorkState)
data class ShowcasePressSnapshot(val active: Boolean, val enabled: Boolean, val failed: Boolean, val elapsedMs: Long)
data class ShowcaseTextSnapshot(val text: String, val submitCount: Int)
data class ShowcaseCaptureSnapshot(val active: Boolean, val elapsedMs: Long, val levels: List<Float>)
data class ShowcasePlaybackSnapshot(val state: RingPlaybackState, val positionMs: Long, val durationMs: Long)
data class ShowcaseTemplateSnapshot(val adjustmentValue: Int, val theme: CircleColorTheme)
data class ShowcaseSourceSnapshot(val source: SourceState<String>, val enabled: Boolean)
data class ShowcaseUpdateSnapshot(val state: UpdateState)
data class ShowcaseServiceSnapshot(val state: ServiceSnapshot)

data class ShowcaseMountedRenderer(
    val renderer: ShowcaseNativeRenderer,
    val inputs: ShowcaseGeneratedImmutableInputBundle,
    val eventEmitter: ShowcaseRendererEmitter,
)

class ShowcaseRendererProducerPorts(
    private val session: ShowcaseSession,
    private val destination: ShowcaseDestination,
    private val textEntryPort: RingTextEntryPort?,
    private val rendererSnapshot: Any? = null,
) {
    fun read(producerPortRef: String, componentId: String): Any = when (producerPortRef) {
        "catalog.model" -> {
            val case = requireNotNull(ShowcaseManifest.find(requireNotNull(destination.caseId)))
            val scenario = requireNotNull(case.scenarios.find { it.id == destination.scenarioId })
            ShowcaseCatalogRendererInput(case, scenario)
        }
        "navigation.presentation.model" -> ShowcaseNavigationRendererInput(destination)
        "renderer.presentation.model" -> rendererSnapshot ?: snapshot(componentId)
        "navigation.activePage" -> session.activePage.value
        else -> error("No Showcase producer port '$producerPortRef'")
    }

    fun snapshot(componentId: String): Any = when (componentId) {
        "atom.icon-action" -> ShowcaseIconActionSnapshot(session.iconActionActive.value)
        "control.action-row" -> ShowcaseActionRowSnapshot(
            session.interaction.actionCount.value,
            session.interaction.actionFailed.value,
            session.interaction.availability.value,
        )
        "control.choice-row" -> ShowcaseChoiceSnapshot(session.interaction.choiceIndex.value)
        "control.adjustment" -> ShowcaseAdjustmentSnapshot(session.interaction.adjustmentValue.value)
        "control.progress" -> ShowcaseProgressSnapshot(session.interaction.work.value)
        "control.press-ring" -> ShowcasePressSnapshot(
            session.media.captureActive.value,
            session.media.captureEnabled.value,
            session.media.captureFailed.value,
            session.media.captureElapsedMs.value,
        )
        "input.text" -> ShowcaseTextSnapshot(session.media.text.value, session.media.submitCount.value)
        "media.capture" -> ShowcaseCaptureSnapshot(
            session.media.captureActive.value,
            session.media.captureElapsedMs.value,
            session.media.captureLevels.value.toList(),
        )
        "media.playback" -> ShowcasePlaybackSnapshot(
            session.media.playbackState.value,
            session.media.playbackPositionMs.value,
            session.media.playbackDurationMs.value,
        )
        "template.screens" -> ShowcaseTemplateSnapshot(
            session.interaction.adjustmentValue.value,
            session.flows.theme.value,
        )
        "flow.source" -> ShowcaseSourceSnapshot(session.flows.source.value, session.flows.sourceEnabled.value)
        "flow.update" -> ShowcaseUpdateSnapshot(session.flows.update.value)
        "flow.service" -> ShowcaseServiceSnapshot(session.flows.service.value)
        else -> error("No component-specific Showcase snapshot for '$componentId'")
    }

    @Composable
    fun observeSnapshot(componentId: String): Any = when (componentId) {
        "atom.icon-action" -> ShowcaseIconActionSnapshot(session.iconActionActive.collectAsState().value)
        "control.action-row" -> ShowcaseActionRowSnapshot(
            session.interaction.actionCount.collectAsState().value,
            session.interaction.actionFailed.collectAsState().value,
            session.interaction.availability.collectAsState().value,
        )
        "control.choice-row" -> ShowcaseChoiceSnapshot(session.interaction.choiceIndex.collectAsState().value)
        "control.adjustment" -> ShowcaseAdjustmentSnapshot(session.interaction.adjustmentValue.collectAsState().value)
        "control.progress" -> ShowcaseProgressSnapshot(session.interaction.work.collectAsState().value)
        "control.press-ring" -> ShowcasePressSnapshot(
            session.media.captureActive.collectAsState().value,
            session.media.captureEnabled.collectAsState().value,
            session.media.captureFailed.collectAsState().value,
            session.media.captureElapsedMs.collectAsState().value,
        )
        "input.text" -> ShowcaseTextSnapshot(
            session.media.text.collectAsState().value,
            session.media.submitCount.collectAsState().value,
        )
        "media.capture" -> ShowcaseCaptureSnapshot(
            session.media.captureActive.collectAsState().value,
            session.media.captureElapsedMs.collectAsState().value,
            session.media.captureLevels.collectAsState().value.toList(),
        )
        "media.playback" -> ShowcasePlaybackSnapshot(
            session.media.playbackState.collectAsState().value,
            session.media.playbackPositionMs.collectAsState().value,
            session.media.playbackDurationMs.collectAsState().value,
        )
        "template.screens" -> ShowcaseTemplateSnapshot(
            session.interaction.adjustmentValue.collectAsState().value,
            session.flows.theme.collectAsState().value,
        )
        "flow.source" -> ShowcaseSourceSnapshot(
            session.flows.source.collectAsState().value,
            session.flows.sourceEnabled.collectAsState().value,
        )
        "flow.update" -> ShowcaseUpdateSnapshot(session.flows.update.collectAsState().value)
        "flow.service" -> ShowcaseServiceSnapshot(session.flows.service.collectAsState().value)
        else -> error("No component-specific Showcase snapshot for '$componentId'")
    }

    fun emit(componentId: String, payload: ShowcaseRendererEventPayload) {
        when (payload.actionId) {
            "icon.toggle" -> session.invoke(ShowcaseActionId(ShowcaseSession.ACTION_TOGGLE_ICON))
            "action.run" -> session.interaction.runAction(fails = payload.value == "fail")
            "action.recover" -> session.invoke(ShowcaseActionId(ShowcaseSession.ACTION_RECOVER))
            "choice.select" -> session.interaction.selectChoice(
                requireNotNull(payload.value).toInt(),
                optionCount = if (payload.value.toInt() > 1) 7 else 2,
            )
            "adjust" -> session.interaction.adjust(requireNotNull(payload.value).toInt())
            "progress.advance" -> session.invoke(ShowcaseActionId(ShowcaseSession.ACTION_ADVANCE_PROGRESS))
            "text.change" -> session.media.updateText(payload.value.orEmpty())
            "text.submit" -> session.invoke(ShowcaseActionId(ShowcaseSession.ACTION_TEXT_SUBMIT))
            "text.platform" -> textEntryPort?.openPlatformTextEntry(
                ShowcasePresentations.textSpecForHost(
                    requireNotNull(ShowcaseManifest.find(requireNotNull(destination.caseId)))
                        .scenarios.single { it.id == destination.scenarioId },
                    session.media.text.value,
                ),
            ) { value ->
                session.media.updateText(value)
                session.media.submitText()
            }
            "capture.begin" -> session.invoke(ShowcaseActionId(ShowcaseSession.ACTION_CAPTURE_BEGIN))
            "capture.release" -> session.invoke(ShowcaseActionId(ShowcaseSession.ACTION_CAPTURE_RELEASE))
            "capture.cancel" -> session.media.cancelCapture()
            "playback.toggle" -> session.invoke(ShowcaseActionId(ShowcaseSession.ACTION_PLAYBACK_TOGGLE))
            "playback.stop" -> session.invoke(ShowcaseActionId(ShowcaseSession.ACTION_PLAYBACK_STOP))
            "template.theme" -> session.flows.selectTheme(CircleColorTheme.valueOf(requireNotNull(payload.value)))
            "source.refresh" -> session.invoke(ShowcaseActionId(ShowcaseSession.ACTION_SOURCE_REFRESH))
            "update.advance" -> session.invoke(ShowcaseActionId(ShowcaseSession.ACTION_UPDATE_ADVANCE))
            "service.advance" -> session.invoke(ShowcaseActionId(ShowcaseSession.ACTION_SERVICE_ADVANCE))
            "observe" -> Unit
            else -> error("Unknown typed Showcase event '$componentId/${payload.actionId}'")
        }
    }

    fun emitNavigation(targetPortRef: String, payload: ShowcaseRendererEventPayload) {
        when {
            targetPortRef == "navigation.route" -> session.commitRoute(requireNotNull(payload.value))
            targetPortRef.startsWith("navigation.") && payload.actionId == "navigation.open" -> {
                val (caseId, scenarioId) = requireNotNull(payload.value).split('|', limit = 2)
                session.commitOpen(
                    ShowcaseCaseId(caseId),
                    ShowcaseScenarioId(scenarioId),
                    targetPortRef,
                )
            }
            else -> error("Unknown native Showcase navigation event '$targetPortRef'")
        }
    }
}

object ShowcaseRendererMounts {
    fun colors(inputs: ShowcaseGeneratedImmutableInputBundle, emitter: ShowcaseEmptyRendererEmitter) =
        ShowcaseMountedRenderer(ShowcaseNativeRenderer.COLORS, inputs, emitter)
    fun geometry(inputs: ShowcaseGeneratedImmutableInputBundle, emitter: ShowcaseEmptyRendererEmitter) =
        ShowcaseMountedRenderer(ShowcaseNativeRenderer.GEOMETRY, inputs, emitter)
    fun iconActions(inputs: ShowcaseGeneratedImmutableInputBundle, emitter: ShowcaseTypedRendererEmitter) =
        ShowcaseMountedRenderer(ShowcaseNativeRenderer.ICON_ACTIONS, inputs, emitter)
    fun actionRows(inputs: ShowcaseGeneratedImmutableInputBundle, emitter: ShowcaseTypedRendererEmitter) =
        ShowcaseMountedRenderer(ShowcaseNativeRenderer.ACTION_ROWS, inputs, emitter)
    fun choiceRows(inputs: ShowcaseGeneratedImmutableInputBundle, emitter: ShowcaseTypedRendererEmitter) =
        ShowcaseMountedRenderer(ShowcaseNativeRenderer.CHOICE_ROWS, inputs, emitter)
    fun adjustment(inputs: ShowcaseGeneratedImmutableInputBundle, emitter: ShowcaseTypedRendererEmitter) =
        ShowcaseMountedRenderer(ShowcaseNativeRenderer.ADJUSTMENT, inputs, emitter)
    fun progress(inputs: ShowcaseGeneratedImmutableInputBundle, emitter: ShowcaseTypedRendererEmitter) =
        ShowcaseMountedRenderer(ShowcaseNativeRenderer.PROGRESS, inputs, emitter)
    fun press(inputs: ShowcaseGeneratedImmutableInputBundle, emitter: ShowcaseTypedRendererEmitter) =
        ShowcaseMountedRenderer(ShowcaseNativeRenderer.PRESS, inputs, emitter)
    fun text(inputs: ShowcaseGeneratedImmutableInputBundle, emitter: ShowcaseTypedRendererEmitter) =
        ShowcaseMountedRenderer(ShowcaseNativeRenderer.TEXT, inputs, emitter)
    fun capture(inputs: ShowcaseGeneratedImmutableInputBundle, emitter: ShowcaseTypedRendererEmitter) =
        ShowcaseMountedRenderer(ShowcaseNativeRenderer.CAPTURE, inputs, emitter)
    fun playback(inputs: ShowcaseGeneratedImmutableInputBundle, emitter: ShowcaseTypedRendererEmitter) =
        ShowcaseMountedRenderer(ShowcaseNativeRenderer.PLAYBACK, inputs, emitter)
    fun screens(inputs: ShowcaseGeneratedImmutableInputBundle, emitter: ShowcaseTypedRendererEmitter) =
        ShowcaseMountedRenderer(ShowcaseNativeRenderer.SCREEN_TEMPLATES, inputs, emitter)
    fun source(inputs: ShowcaseGeneratedImmutableInputBundle, emitter: ShowcaseTypedRendererEmitter) =
        ShowcaseMountedRenderer(ShowcaseNativeRenderer.SOURCE, inputs, emitter)
    fun update(inputs: ShowcaseGeneratedImmutableInputBundle, emitter: ShowcaseTypedRendererEmitter) =
        ShowcaseMountedRenderer(ShowcaseNativeRenderer.UPDATE, inputs, emitter)
    fun service(inputs: ShowcaseGeneratedImmutableInputBundle, emitter: ShowcaseTypedRendererEmitter) =
        ShowcaseMountedRenderer(ShowcaseNativeRenderer.SERVICE, inputs, emitter)
}

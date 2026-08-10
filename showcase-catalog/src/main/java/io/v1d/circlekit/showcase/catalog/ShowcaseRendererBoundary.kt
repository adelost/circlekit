package io.v1d.circlekit.showcase.catalog

import com.adelost.designkit.ui.CircleColorTheme
import com.adelost.releasekit.UpdateState
import com.adelost.ringkit.data.SourceState
import com.adelost.ringkit.ui.RingPlaybackState
import com.adelost.ringkit.ui.RingTextEntryPort
import com.adelost.servicekit.ServiceSnapshot
import kotlinx.coroutines.flow.StateFlow

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

data class ShowcaseInteractionRendererInput(
    val iconActionActive: StateFlow<Boolean>,
    val actionCount: StateFlow<Int>,
    val actionFailed: StateFlow<Boolean>,
    val availability: StateFlow<ShowcaseAvailability>,
    val choiceIndex: StateFlow<Int>,
    val adjustmentValue: StateFlow<Int>,
    val work: StateFlow<ShowcaseWorkState>,
)

data class ShowcaseMediaRendererInput(
    val text: StateFlow<String>,
    val submitCount: StateFlow<Int>,
    val captureActive: StateFlow<Boolean>,
    val captureEnabled: StateFlow<Boolean>,
    val captureFailed: StateFlow<Boolean>,
    val captureElapsedMs: StateFlow<Long>,
    val captureLevels: StateFlow<List<Float>>,
    val playbackState: StateFlow<RingPlaybackState>,
    val playbackPositionMs: StateFlow<Long>,
    val playbackDurationMs: StateFlow<Long>,
)

data class ShowcaseFlowRendererInput(
    val source: StateFlow<SourceState<String>>,
    val sourceEnabled: StateFlow<Boolean>,
    val update: StateFlow<UpdateState>,
    val service: StateFlow<ServiceSnapshot>,
    val theme: StateFlow<CircleColorTheme>,
)

data class ShowcaseRuntimeRendererInput(
    val interaction: ShowcaseInteractionRendererInput,
    val media: ShowcaseMediaRendererInput,
    val flows: ShowcaseFlowRendererInput,
)

data class ShowcaseMountedRenderer(
    val renderer: ShowcaseNativeRenderer,
    val inputs: ShowcaseGeneratedImmutableInputBundle,
    val eventEmitter: ShowcaseRendererEmitter,
)

class ShowcaseRendererProducerPorts(
    private val session: ShowcaseSession,
    private val destination: ShowcaseDestination,
    private val textEntryPort: RingTextEntryPort?,
) {
    fun read(producerPortRef: String): Any = when (producerPortRef) {
        "catalog.model" -> {
            val case = requireNotNull(ShowcaseManifest.find(requireNotNull(destination.caseId)))
            val scenario = requireNotNull(case.scenarios.find { it.id == destination.scenarioId })
            ShowcaseCatalogRendererInput(case, scenario)
        }
        "navigation.presentation.model" -> ShowcaseNavigationRendererInput(destination)
        "renderer.presentation.model" -> ShowcaseRuntimeRendererInput(
            interaction = ShowcaseInteractionRendererInput(
                session.iconActionActive,
                session.interaction.actionCount,
                session.interaction.actionFailed,
                session.interaction.availability,
                session.interaction.choiceIndex,
                session.interaction.adjustmentValue,
                session.interaction.work,
            ),
            media = ShowcaseMediaRendererInput(
                session.media.text,
                session.media.submitCount,
                session.media.captureActive,
                session.media.captureEnabled,
                session.media.captureFailed,
                session.media.captureElapsedMs,
                session.media.captureLevels,
                session.media.playbackState,
                session.media.playbackPositionMs,
                session.media.playbackDurationMs,
            ),
            flows = ShowcaseFlowRendererInput(
                session.flows.source,
                session.flows.sourceEnabled,
                session.flows.update,
                session.flows.service,
                session.flows.theme,
            ),
        )
        "navigation.activePage" -> session.activePage.value
        else -> error("No Showcase producer port '$producerPortRef'")
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
                session.commitOpen(ShowcaseCaseId(caseId), ShowcaseScenarioId(scenarioId))
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

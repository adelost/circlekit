package io.v1d.circlekit.showcase.catalog

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

const val SHOWCASE_PROBE_ACTION = "io.v1d.circlekit.showcase.PROBE"
const val SHOWCASE_PROBE_LOG_TAG = "CircleKitShowcase"

@JvmInline
value class ShowcaseCaseId(val value: String)

@JvmInline
value class ShowcaseScenarioId(val value: String)

@JvmInline
value class ShowcaseActionId(val value: String)

data class ShowcaseScenario(
    val id: ShowcaseScenarioId,
    val label: String,
)

data class ShowcaseCase(
    val id: ShowcaseCaseId,
    val family: ShowcaseFamily,
    val title: String,
    val iconId: String,
    val scenarios: List<ShowcaseScenario>,
)

data class ShowcaseComponentTree(
    val artifactProfileId: String,
    val screenId: String,
    val surface: String,
    val componentIds: List<String>,
)

data class ShowcaseNodeDescriptor(
    val id: String,
    val typeRef: String,
    val kind: String,
)

data class ShowcaseProductPort(
    val ref: String,
    val ownerKind: String,
    val ownerId: String,
    val typeRef: String,
    val portId: String,
    val direction: String,
    val contractRef: String,
    val boundary: String,
    val required: Boolean,
    val purpose: String,
)

data class ShowcasePortBinding(
    val kind: String,
    val from: String,
    val to: String,
    val purpose: String,
)

data class ShowcaseDemandEdge(
    val kind: String,
    val artifactRef: String?,
    val screenRef: String?,
    val surface: String?,
    val componentInstanceRef: String?,
    val nodeInstanceRef: String,
    val targetPortRef: String,
)

data class ShowcaseDestination(
    val caseId: ShowcaseCaseId? = null,
    val scenarioId: ShowcaseScenarioId? = null,
) {
    val isRoot: Boolean get() = caseId == null && scenarioId == null
}

data class ShowcaseProbeCommand(
    val verb: String,
    val caseId: String? = null,
    val scenarioId: String? = null,
    val actionId: String? = null,
    val value: String? = null,
)

data class ShowcaseProbeResult(
    val ok: Boolean,
    val message: String,
    val snapshot: ShowcaseSnapshot,
) {
    fun toJson(): String = buildString {
        append("{\"ok\":").append(ok)
        append(",\"message\":\"").append(message.jsonEscape()).append('"')
        append(",\"destination\":\"").append(snapshot.destination.jsonEscape()).append('"')
        append(",\"surface\":\"").append(snapshot.surface.jsonEscape()).append('"')
        append(",\"iconActionActive\":").append(snapshot.iconActionActive)
        append(",\"actionCount\":").append(snapshot.actionCount)
        append(",\"choiceIndex\":").append(snapshot.choiceIndex)
        append(",\"adjustmentValue\":").append(snapshot.adjustmentValue)
        append(",\"workState\":\"").append(snapshot.workState.jsonEscape()).append('"')
        append(",\"text\":\"").append(snapshot.text.jsonEscape()).append('"')
        append(",\"textSubmitCount\":").append(snapshot.textSubmitCount)
        append(",\"captureActive\":").append(snapshot.captureActive)
        append(",\"captureElapsedMs\":").append(snapshot.captureElapsedMs)
        append(",\"playbackState\":\"").append(snapshot.playbackState.jsonEscape()).append('"')
        append('}')
    }
}

data class ShowcaseSnapshot(
    val destination: String,
    val surface: String,
    val iconActionActive: Boolean,
    val actionCount: Int,
    val choiceIndex: Int,
    val adjustmentValue: Int,
    val workState: String,
    val text: String,
    val textSubmitCount: Int,
    val captureActive: Boolean,
    val captureElapsedMs: Long,
    val playbackState: String,
)

class ShowcaseSession(
    val artifactProfile: ShowcaseArtifactProfile,
) {
    private val mutableDestination = MutableStateFlow(ShowcaseDestination())
    private val mutableIconActionActive = MutableStateFlow(false)
    private var surface: String = "UNKNOWN"
    private var navigationBack: (() -> Boolean)? = null
    val interaction = ShowcaseInteractionState()
    val media = ShowcaseMediaState()
    val flows = ShowcaseFlowState()

    val destination: StateFlow<ShowcaseDestination> = mutableDestination.asStateFlow()
    val iconActionActive: StateFlow<Boolean> = mutableIconActionActive.asStateFlow()

    init {
        require(artifactProfile.id in ShowcaseManifest.profiles)
        ShowcaseNativeBindings.requireProfile(artifactProfile.id)
    }

    fun open(caseId: ShowcaseCaseId, scenarioId: ShowcaseScenarioId): Boolean {
        val available = ShowcaseCatalogRuntime.screensFor(artifactProfile.id).any { screen ->
            caseId.value in ShowcaseCatalogRuntime.componentIds(artifactProfile.id, screen)
        }
        if (!available) return false
        if (ShowcaseCatalogRuntime.find(caseId, scenarioId) == null) return false
        ShowcaseProductInspectorRegistry.requireOpenTarget(caseId)
        interaction.prepare(caseId, scenarioId)
        media.prepare(caseId, scenarioId)
        flows.prepare(caseId, scenarioId)
        mutableDestination.value = ShowcaseDestination(caseId, scenarioId)
        return true
    }

    fun reset() {
        mutableDestination.value = ShowcaseDestination()
        mutableIconActionActive.value = false
        interaction.reset()
        media.reset()
        flows.reset()
    }

    fun closeSelection() {
        mutableDestination.value = ShowcaseDestination()
    }

    fun setSurface(value: String) {
        surface = value
    }

    fun attachNavigationBack(handler: (() -> Boolean)?) {
        navigationBack = handler
    }

    fun back(): Boolean = navigationBack?.invoke() ?: false

    fun invoke(actionId: ShowcaseActionId): Boolean = when (actionId.value) {
        ACTION_TOGGLE_ICON -> {
            mutableIconActionActive.value = !mutableIconActionActive.value
            true
        }
        ACTION_RUN -> true.also { interaction.runAction() }
        ACTION_RECOVER -> true.also { interaction.recover() }
        ACTION_NEXT_CHOICE -> true.also { interaction.nextChoice(7) }
        ACTION_INCREMENT -> true.also { interaction.adjust(100) }
        ACTION_ADVANCE_PROGRESS -> true.also { interaction.advanceWork() }
        ACTION_TEXT_SUBMIT -> true.also { media.submitText() }
        ACTION_CAPTURE_BEGIN -> media.beginCapture()
        ACTION_CAPTURE_RELEASE -> true.also { media.releaseCapture() }
        ACTION_CAPTURE_FAIL -> true.also { media.failCapture() }
        ACTION_PLAYBACK_TOGGLE -> true.also { media.togglePlayback() }
        ACTION_PLAYBACK_STOP -> true.also { media.stopPlayback() }
        ACTION_SOURCE_REFRESH -> true.also { flows.refreshSource() }
        ACTION_UPDATE_ADVANCE -> true.also { flows.advanceUpdate() }
        ACTION_SERVICE_ADVANCE -> true.also { flows.advanceService() }
        else -> false
    }

    fun handle(command: ShowcaseProbeCommand): ShowcaseProbeResult {
        val result = when (command.verb.lowercase()) {
            "list" -> true to ShowcaseManifest.cases.joinToString(",") { case ->
                "${case.id.value}=[${case.scenarios.joinToString("|") { it.id.value }}]"
            }
            "open" -> {
                val caseId = command.caseId?.let(::ShowcaseCaseId)
                val scenarioId = command.scenarioId?.let(::ShowcaseScenarioId)
                val opened = caseId != null && scenarioId != null && open(caseId, scenarioId)
                opened to if (opened) "opened" else "unknown case or scenario"
            }
            "dump" -> true to "snapshot"
            "invoke" -> {
                val invoked = command.actionId?.let(::ShowcaseActionId)?.let(::invoke) == true
                invoked to if (invoked) "invoked" else "unsafe or unknown action"
            }
            "reset" -> true to "reset".also { reset() }
            "back" -> {
                val backed = back()
                backed to if (backed) "back" else "already at root"
            }
            else -> false to "unknown command"
        }
        return ShowcaseProbeResult(result.first, result.second, snapshot())
    }

    private fun snapshot(): ShowcaseSnapshot {
        val destination = mutableDestination.value
        return ShowcaseSnapshot(
            destination = if (destination.isRoot) {
                "root"
            } else {
                "${destination.caseId?.value}/${destination.scenarioId?.value}"
            },
            surface = surface,
            iconActionActive = mutableIconActionActive.value,
            actionCount = interaction.actionCount.value,
            choiceIndex = interaction.choiceIndex.value,
            adjustmentValue = interaction.adjustmentValue.value,
            workState = interaction.work.value.name,
            text = media.text.value,
            textSubmitCount = media.submitCount.value,
            captureActive = media.captureActive.value,
            captureElapsedMs = media.captureElapsedMs.value,
            playbackState = media.playbackState.value.name,
        )
    }

    companion object {
        const val ACTION_TOGGLE_ICON = "atom.icon-action.toggle"
        const val ACTION_RUN = "control.action.run"
        const val ACTION_RECOVER = "control.availability.recover"
        const val ACTION_NEXT_CHOICE = "control.choice.next"
        const val ACTION_INCREMENT = "control.adjustment.increment"
        const val ACTION_ADVANCE_PROGRESS = "control.progress.advance"
        const val ACTION_TEXT_SUBMIT = "input.text.submit"
        const val ACTION_CAPTURE_BEGIN = "control.press-ring.begin"
        const val ACTION_CAPTURE_RELEASE = "control.press-ring.release"
        const val ACTION_CAPTURE_FAIL = "control.press-ring.fail"
        const val ACTION_PLAYBACK_TOGGLE = "media.playback.toggle"
        const val ACTION_PLAYBACK_STOP = "media.playback.stop"
        const val ACTION_SOURCE_REFRESH = "flow.source.refresh"
        const val ACTION_UPDATE_ADVANCE = "flow.update.advance"
        const val ACTION_SERVICE_ADVANCE = "flow.service.advance"
    }
}

private fun String.jsonEscape(): String = buildString(length) {
    this@jsonEscape.forEach { char ->
        when (char) {
            '\\' -> append("\\\\")
            '"' -> append("\\\"")
            '\n' -> append("\\n")
            '\r' -> append("\\r")
            '\t' -> append("\\t")
            else -> append(char)
        }
    }
}

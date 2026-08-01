package io.v1d.circlekit.showcase.catalog

import androidx.compose.ui.graphics.vector.ImageVector
import com.adelost.designkit.ui.RingIcons
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

enum class ShowcaseFamily { FOUNDATIONS, ATOMS, CONTROLS, INPUT, MEDIA, TEMPLATES, FLOWS }

/** One reciprocal vocabulary for the public visual families exercised here. */
enum class ShowcaseComponentFamily {
    COLORS,
    GEOMETRY,
    ICON_ACTION,
    ACTION_ROW,
    CHOICE_ROW,
    ADJUSTMENT,
    PROGRESS,
    PRESS_ACTION,
    TEXT_ENTRY,
    AUDIO_CAPTURE,
    AUDIO_PLAYBACK,
    SCREEN_TEMPLATES,
    SOURCE_HEALTH,
    UPDATE_FLOW,
    SERVICE_STATUS,
}

data class ShowcaseScenario(
    val id: ShowcaseScenarioId,
    val label: String,
)

data class ShowcaseCase(
    val id: ShowcaseCaseId,
    val family: ShowcaseFamily,
    val componentFamily: ShowcaseComponentFamily,
    val title: String,
    val icon: ImageVector,
    val scenarios: List<ShowcaseScenario>,
)

object ShowcaseManifest {
    val cases: List<ShowcaseCase> = listOf(
        ShowcaseCase(
            id = ShowcaseCaseId("foundation.colors"),
            family = ShowcaseFamily.FOUNDATIONS,
            componentFamily = ShowcaseComponentFamily.COLORS,
            title = "COLORS",
            icon = RingIcons.Palette,
            scenarios = listOf(
                ShowcaseScenario(ShowcaseScenarioId("sea-glass"), "SEA GLASS"),
                ShowcaseScenario(ShowcaseScenarioId("flat-cyan"), "FLAT CYAN"),
                ShowcaseScenario(ShowcaseScenarioId("muted"), "MUTED"),
                ShowcaseScenario(ShowcaseScenarioId("high-contrast"), "HIGH CONTRAST"),
            ),
        ),
        ShowcaseCase(
            id = ShowcaseCaseId("foundation.geometry"),
            family = ShowcaseFamily.FOUNDATIONS,
            componentFamily = ShowcaseComponentFamily.GEOMETRY,
            title = "GEOMETRY",
            icon = RingIcons.Grid,
            scenarios = listOf(
                ShowcaseScenario(ShowcaseScenarioId("round-192"), "ROUND 192"),
                ShowcaseScenario(ShowcaseScenarioId("phone-compact"), "PHONE COMPACT"),
                ShowcaseScenario(ShowcaseScenarioId("phone-wide"), "PHONE WIDE"),
                ShowcaseScenario(ShowcaseScenarioId("chrome-x"), "X @ 9"),
                ShowcaseScenario(ShowcaseScenarioId("chrome-x-gear"), "X + GEAR"),
            ),
        ),
        ShowcaseCase(
            id = ShowcaseCaseId("atom.icon-action"),
            family = ShowcaseFamily.ATOMS,
            componentFamily = ShowcaseComponentFamily.ICON_ACTION,
            title = "ACTIONS",
            icon = RingIcons.Watch,
            scenarios = listOf(
                ShowcaseScenario(ShowcaseScenarioId("idle"), "IDLE"),
                ShowcaseScenario(ShowcaseScenarioId("active"), "ACTIVE"),
                ShowcaseScenario(ShowcaseScenarioId("immediate"), "IMMEDIATE"),
                ShowcaseScenario(ShowcaseScenarioId("deliberate"), "DELIBERATE"),
                ShowcaseScenario(ShowcaseScenarioId("disabled"), "DISABLED"),
            ),
        ),
        ShowcaseCase(
            id = ShowcaseCaseId("control.action-row"),
            family = ShowcaseFamily.CONTROLS,
            componentFamily = ShowcaseComponentFamily.ACTION_ROW,
            title = "ACTION ROW",
            icon = RingIcons.TouchdownRun,
            scenarios = listOf(
                ShowcaseScenario(ShowcaseScenarioId("immediate"), "IMMEDIATE"),
                ShowcaseScenario(ShowcaseScenarioId("deliberate"), "DELIBERATE"),
                ShowcaseScenario(ShowcaseScenarioId("confirm"), "CONFIRM"),
                ShowcaseScenario(ShowcaseScenarioId("recoverable"), "RECOVERABLE"),
                ShowcaseScenario(ShowcaseScenarioId("blocked"), "BLOCKED"),
                ShowcaseScenario(ShowcaseScenarioId("failure"), "FAILURE + RETRY"),
            ),
        ),
        ShowcaseCase(
            id = ShowcaseCaseId("control.choice-row"),
            family = ShowcaseFamily.CONTROLS,
            componentFamily = ShowcaseComponentFamily.CHOICE_ROW,
            title = "CHOICES",
            icon = RingIcons.Grid,
            scenarios = listOf(
                ShowcaseScenario(ShowcaseScenarioId("off"), "TOGGLE OFF"),
                ShowcaseScenario(ShowcaseScenarioId("on"), "TOGGLE ON"),
                ShowcaseScenario(ShowcaseScenarioId("two"), "TWO OPTIONS"),
                ShowcaseScenario(ShowcaseScenarioId("first"), "SEVEN · FIRST"),
                ShowcaseScenario(ShowcaseScenarioId("middle"), "SEVEN · MIDDLE"),
                ShowcaseScenario(ShowcaseScenarioId("last"), "SEVEN · LAST"),
            ),
        ),
        ShowcaseCase(
            id = ShowcaseCaseId("control.adjustment"),
            family = ShowcaseFamily.CONTROLS,
            componentFamily = ShowcaseComponentFamily.ADJUSTMENT,
            title = "ADJUST",
            icon = RingIcons.Sliders,
            scenarios = listOf(
                ShowcaseScenario(ShowcaseScenarioId("minimum"), "MINIMUM"),
                ShowcaseScenario(ShowcaseScenarioId("middle"), "MIDDLE"),
                ShowcaseScenario(ShowcaseScenarioId("maximum"), "MAXIMUM"),
                ShowcaseScenario(ShowcaseScenarioId("deliberate"), "DELIBERATE STEPS"),
            ),
        ),
        ShowcaseCase(
            id = ShowcaseCaseId("control.progress"),
            family = ShowcaseFamily.CONTROLS,
            componentFamily = ShowcaseComponentFamily.PROGRESS,
            title = "PROGRESS",
            icon = RingIcons.Download,
            scenarios = listOf(
                ShowcaseScenario(ShowcaseScenarioId("none"), "NONE"),
                ShowcaseScenario(ShowcaseScenarioId("indeterminate"), "INDETERMINATE"),
                ShowcaseScenario(ShowcaseScenarioId("empty"), "0 PERCENT"),
                ShowcaseScenario(ShowcaseScenarioId("half"), "50 PERCENT"),
                ShowcaseScenario(ShowcaseScenarioId("complete"), "100 PERCENT"),
                ShowcaseScenario(ShowcaseScenarioId("failed"), "FAILURE + RETRY"),
            ),
        ),
        ShowcaseCase(
            id = ShowcaseCaseId("control.press-ring"),
            family = ShowcaseFamily.CONTROLS,
            componentFamily = ShowcaseComponentFamily.PRESS_ACTION,
            title = "PRESS",
            icon = RingIcons.Record,
            scenarios = listOf(
                ShowcaseScenario(ShowcaseScenarioId("idle"), "IDLE"),
                ShowcaseScenario(ShowcaseScenarioId("recording"), "RECORDING"),
                ShowcaseScenario(ShowcaseScenarioId("disabled"), "DISABLED"),
                ShowcaseScenario(ShowcaseScenarioId("failed"), "FAILED + RETRY"),
            ),
        ),
        ShowcaseCase(
            id = ShowcaseCaseId("input.text"),
            family = ShowcaseFamily.INPUT,
            componentFamily = ShowcaseComponentFamily.TEXT_ENTRY,
            title = "TEXT",
            icon = RingIcons.Pencil,
            scenarios = listOf(
                ShowcaseScenario(ShowcaseScenarioId("empty"), "EMPTY"),
                ShowcaseScenario(ShowcaseScenarioId("filled"), "FILLED"),
                ShowcaseScenario(ShowcaseScenarioId("max"), "MAX LENGTH"),
                ShowcaseScenario(ShowcaseScenarioId("disabled"), "DISABLED"),
            ),
        ),
        ShowcaseCase(
            id = ShowcaseCaseId("media.capture"),
            family = ShowcaseFamily.MEDIA,
            componentFamily = ShowcaseComponentFamily.AUDIO_CAPTURE,
            title = "WAVEFORM",
            icon = RingIcons.Record,
            scenarios = listOf(
                ShowcaseScenario(ShowcaseScenarioId("silent"), "NO SAMPLES"),
                ShowcaseScenario(ShowcaseScenarioId("active"), "ACTIVE"),
                ShowcaseScenario(ShowcaseScenarioId("long"), "LONG DURATION"),
            ),
        ),
        ShowcaseCase(
            id = ShowcaseCaseId("media.playback"),
            family = ShowcaseFamily.MEDIA,
            componentFamily = ShowcaseComponentFamily.AUDIO_PLAYBACK,
            title = "PLAYBACK",
            icon = RingIcons.Play,
            scenarios = listOf(
                ShowcaseScenario(ShowcaseScenarioId("ready"), "READY"),
                ShowcaseScenario(ShowcaseScenarioId("playing"), "PLAYING"),
                ShowcaseScenario(ShowcaseScenarioId("paused"), "PAUSED"),
                ShowcaseScenario(ShowcaseScenarioId("complete"), "COMPLETE"),
                ShowcaseScenario(ShowcaseScenarioId("failed"), "FAILED"),
            ),
        ),
        ShowcaseCase(
            id = ShowcaseCaseId("template.screens"),
            family = ShowcaseFamily.TEMPLATES,
            componentFamily = ShowcaseComponentFamily.SCREEN_TEMPLATES,
            title = "SCREENS",
            icon = RingIcons.Layers,
            scenarios = listOf(
                ShowcaseScenario(ShowcaseScenarioId("hub"), "HUB"),
                ShowcaseScenario(ShowcaseScenarioId("detail"), "DETAIL"),
                ShowcaseScenario(ShowcaseScenarioId("launcher"), "LAUNCHER"),
                ShowcaseScenario(ShowcaseScenarioId("rows"), "ROWS"),
                ShowcaseScenario(ShowcaseScenarioId("adjustment"), "ADJUSTMENT"),
                ShowcaseScenario(ShowcaseScenarioId("color-picker"), "COLOR PICKER"),
                ShowcaseScenario(ShowcaseScenarioId("dial-preview"), "DIAL PREVIEW"),
                ShowcaseScenario(ShowcaseScenarioId("empty"), "EMPTY CONTENT"),
                ShowcaseScenario(ShowcaseScenarioId("max-capacity"), "MAX CAPACITY"),
                ShowcaseScenario(ShowcaseScenarioId("long-content"), "LONG CONTENT"),
            ),
        ),
        ShowcaseCase(
            id = ShowcaseCaseId("flow.source"),
            family = ShowcaseFamily.FLOWS,
            componentFamily = ShowcaseComponentFamily.SOURCE_HEALTH,
            title = "SOURCE",
            icon = RingIcons.Wifi,
            scenarios = listOf(
                ShowcaseScenario(ShowcaseScenarioId("off"), "OFF"),
                ShowcaseScenario(ShowcaseScenarioId("loading"), "LOADING"),
                ShowcaseScenario(ShowcaseScenarioId("fresh"), "FRESH"),
                ShowcaseScenario(ShowcaseScenarioId("aging"), "AGING"),
                ShowcaseScenario(ShowcaseScenarioId("partial"), "PARTIAL"),
                ShowcaseScenario(ShowcaseScenarioId("broken"), "BROKEN"),
            ),
        ),
        ShowcaseCase(
            id = ShowcaseCaseId("flow.update"),
            family = ShowcaseFamily.FLOWS,
            componentFamily = ShowcaseComponentFamily.UPDATE_FLOW,
            title = "UPDATE",
            icon = RingIcons.Download,
            scenarios = listOf(
                ShowcaseScenario(ShowcaseScenarioId("checking"), "CHECKING"),
                ShowcaseScenario(ShowcaseScenarioId("available"), "AVAILABLE"),
                ShowcaseScenario(ShowcaseScenarioId("downloading"), "DOWNLOADING"),
                ShowcaseScenario(ShowcaseScenarioId("ready"), "READY"),
                ShowcaseScenario(ShowcaseScenarioId("failed"), "FAILED"),
            ),
        ),
        ShowcaseCase(
            id = ShowcaseCaseId("flow.service"),
            family = ShowcaseFamily.FLOWS,
            componentFamily = ShowcaseComponentFamily.SERVICE_STATUS,
            title = "SERVICE",
            icon = RingIcons.Wrench,
            scenarios = listOf(
                ShowcaseScenario(ShowcaseScenarioId("idle"), "IDLE"),
                ShowcaseScenario(ShowcaseScenarioId("active"), "ACTIVE"),
                ShowcaseScenario(ShowcaseScenarioId("success"), "SUCCESS"),
                ShowcaseScenario(ShowcaseScenarioId("failed"), "FAILED"),
                ShowcaseScenario(ShowcaseScenarioId("cache"), "CACHE"),
            ),
        ),
    )

    fun find(caseId: ShowcaseCaseId): ShowcaseCase? = cases.find { it.id == caseId }

    fun find(caseId: ShowcaseCaseId, scenarioId: ShowcaseScenarioId): Pair<ShowcaseCase, ShowcaseScenario>? {
        val case = find(caseId) ?: return null
        return case to (case.scenarios.find { it.id == scenarioId } ?: return null)
    }
}

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

class ShowcaseSession {
    private val mutableDestination = MutableStateFlow(ShowcaseDestination())
    private val mutableIconActionActive = MutableStateFlow(false)
    private var surface: String = "UNKNOWN"
    private var navigationBack: (() -> Boolean)? = null
    val interaction = ShowcaseInteractionState()
    val media = ShowcaseMediaState()
    val flows = ShowcaseFlowState()

    val destination: StateFlow<ShowcaseDestination> = mutableDestination.asStateFlow()
    val iconActionActive: StateFlow<Boolean> = mutableIconActionActive.asStateFlow()

    fun open(caseId: ShowcaseCaseId, scenarioId: ShowcaseScenarioId): Boolean {
        if (ShowcaseManifest.find(caseId, scenarioId) == null) return false
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

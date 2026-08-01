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

enum class ShowcaseFamily { FOUNDATIONS, ATOMS }

data class ShowcaseScenario(
    val id: ShowcaseScenarioId,
    val label: String,
)

data class ShowcaseCase(
    val id: ShowcaseCaseId,
    val family: ShowcaseFamily,
    val title: String,
    val icon: ImageVector,
    val scenarios: List<ShowcaseScenario>,
)

object ShowcaseManifest {
    val cases: List<ShowcaseCase> = listOf(
        ShowcaseCase(
            id = ShowcaseCaseId("foundation.colors"),
            family = ShowcaseFamily.FOUNDATIONS,
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
            title = "ICON ACTION",
            icon = RingIcons.Watch,
            scenarios = listOf(
                ShowcaseScenario(ShowcaseScenarioId("idle"), "IDLE"),
                ShowcaseScenario(ShowcaseScenarioId("active"), "ACTIVE"),
                ShowcaseScenario(ShowcaseScenarioId("interactive"), "INTERACTIVE"),
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
        append('}')
    }
}

data class ShowcaseSnapshot(
    val destination: String,
    val surface: String,
    val iconActionActive: Boolean,
)

class ShowcaseSession {
    private val mutableDestination = MutableStateFlow(ShowcaseDestination())
    private val mutableIconActionActive = MutableStateFlow(false)
    private var surface: String = "UNKNOWN"
    private var navigationBack: (() -> Boolean)? = null

    val destination: StateFlow<ShowcaseDestination> = mutableDestination.asStateFlow()
    val iconActionActive: StateFlow<Boolean> = mutableIconActionActive.asStateFlow()

    fun open(caseId: ShowcaseCaseId, scenarioId: ShowcaseScenarioId): Boolean {
        if (ShowcaseManifest.find(caseId, scenarioId) == null) return false
        mutableDestination.value = ShowcaseDestination(caseId, scenarioId)
        return true
    }

    fun reset() {
        mutableDestination.value = ShowcaseDestination()
        mutableIconActionActive.value = false
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
        )
    }

    companion object {
        const val ACTION_TOGGLE_ICON = "atom.icon-action.toggle"
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

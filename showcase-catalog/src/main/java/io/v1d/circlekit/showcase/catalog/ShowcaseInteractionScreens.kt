package io.v1d.circlekit.showcase.catalog

import com.adelost.designkit.ui.CircleActionTiming
import com.adelost.designkit.ui.CircleChoiceRole
import com.adelost.designkit.ui.CircleLabelProgress
import com.adelost.designkit.ui.MenuDesign
import com.adelost.designkit.ui.RingIcons
import com.adelost.designkit.ui.RingTokens
import com.adelost.ringkit.ui.AdjustmentValuePresentation
import com.adelost.ringkit.ui.RingScreen
import com.adelost.ringkit.ui.RowSpec
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map

/** Data-only interaction fixtures rendered by the normal RingScreen hosts. */
object ShowcaseInteractionScreens {
    fun actionRows(scenario: ShowcaseScenario, model: ShowcaseInteractionRendererInput, emitter: ShowcaseTypedRendererEmitter): RingScreen.Rows =
        RingScreen.Rows(
            title = scenario.label,
            items = combine(model.actionCount, model.actionFailed, model.availability) { count, failed, availability ->
                listOf(actionRow(scenario.id.value, count, failed, availability, emitter))
            },
        )

    fun choiceRows(scenario: ShowcaseScenario, model: ShowcaseInteractionRendererInput, emitter: ShowcaseTypedRendererEmitter): RingScreen.Rows {
        val options = choiceOptions(scenario.id.value)
        return RingScreen.Rows(
            title = scenario.label,
            items = model.choiceIndex.map { index ->
                val selectedIndex = index.coerceIn(options.indices)
                listOf(
                    RowSpec(
                        key = "choice",
                        title = if (options.size == 2 && options == TOGGLE_OPTIONS) "SATELLITE" else "DISPLAY MODE",
                        sub = options[selectedIndex],
                        icon = RingIcons.Grid,
                        hint = "Cycles through the declared finite choices.",
                        choices = options,
                        onSelect = { selected -> emitter.emit(ShowcaseRendererEventPayload(
                            "choice.select",
                            options.indexOf(selected).toString(),
                        )) },
                        choiceRole = if (options == TOGGLE_OPTIONS) {
                            CircleChoiceRole.TOGGLE
                        } else {
                            CircleChoiceRole.STEPPED
                        },
                    ),
                )
            },
        )
    }

    fun adjustmentRows(scenario: ShowcaseScenario, model: ShowcaseInteractionRendererInput, emitter: ShowcaseTypedRendererEmitter): RingScreen.Rows =
        RingScreen.Rows(
            title = scenario.label,
            items = model.adjustmentValue.map { value ->
                listOf(
                    RowSpec(
                        key = "altitude",
                        title = "ALTITUDE",
                        sub = "$value M",
                        icon = RingIcons.Ruler,
                        hint = "Opens one shared continuous adjustment screen.",
                        onDec = { emitter.emit(ShowcaseRendererEventPayload("adjust", "-100")) },
                        onInc = { emitter.emit(ShowcaseRendererEventPayload("adjust", "100")) },
                        adjustmentValue = AdjustmentValuePresentation(
                            primary = "$value M",
                            supporting = "0–1000 M · 100 M STEP",
                        ),
                        adjustHoldMs = MenuDesign.holdDeliberateMs.takeIf {
                            scenario.id.value == "deliberate"
                        },
                    ),
                )
            },
        )

    fun progressRows(scenario: ShowcaseScenario, model: ShowcaseInteractionRendererInput, emitter: ShowcaseTypedRendererEmitter): RingScreen.Rows =
        RingScreen.Rows(
            title = scenario.label,
            items = model.work.map { work ->
                val progress = when (work) {
                    ShowcaseWorkState.INDETERMINATE -> CircleLabelProgress.Indeterminate
                    ShowcaseWorkState.EMPTY -> CircleLabelProgress.Determinate(0f)
                    ShowcaseWorkState.HALF -> CircleLabelProgress.Determinate(0.5f)
                    ShowcaseWorkState.COMPLETE -> CircleLabelProgress.Determinate(1f)
                    ShowcaseWorkState.NONE, ShowcaseWorkState.FAILED -> null
                }
                listOf(
                    RowSpec(
                        key = "work",
                        title = if (work == ShowcaseWorkState.FAILED) "RETRY" else "FETCH DATA",
                        sub = work.copy,
                        icon = if (work == ShowcaseWorkState.FAILED) RingIcons.Warning else RingIcons.Download,
                        hint = "Measured work stays in the action label.",
                        onTap = { emitter.emit(ShowcaseRendererEventPayload("progress.advance")) },
                        labelProgress = progress,
                        semanticColor = RingTokens.Broken.takeIf { work == ShowcaseWorkState.FAILED },
                    ),
                )
            },
        )

    private fun actionRow(
        scenario: String,
        count: Int,
        failed: Boolean,
        availability: ShowcaseAvailability,
        emitter: ShowcaseTypedRendererEmitter,
    ): RowSpec = when (scenario) {
        "immediate" -> action("CENTER VIEW", "FIRED $count", CircleActionTiming.IMMEDIATE) { emitter.emit(ShowcaseRendererEventPayload("action.run")) }
        "deliberate" -> action("SAVE VIEW", "FIRED $count", CircleActionTiming.DELIBERATE) { emitter.emit(ShowcaseRendererEventPayload("action.run")) }
        "confirm" -> RowSpec(
            key = "confirm",
            title = "DELETE CACHE",
            sub = "FIRED $count",
            icon = RingIcons.Trash,
            hint = "Requires the longer confirmation hold.",
            onTap = { emitter.emit(ShowcaseRendererEventPayload("action.run")) },
            holdToConfirm = true,
            holdMs = MenuDesign.holdDestructiveMs,
        )
        "recoverable" -> if (availability == ShowcaseAvailability.RECOVERABLE) {
            RowSpec(
                key = "recover",
                title = "ENABLE MIC",
                sub = "PERMISSION NEEDED",
                icon = RingIcons.Record,
                hint = "A named action can recover this unavailable state.",
                onTap = { emitter.emit(ShowcaseRendererEventPayload("action.recover")) },
                semanticColor = RingTokens.Aging,
            )
        } else {
            RowSpec("recovered", "MIC READY", "AVAILABLE", RingIcons.Check, semanticColor = RingTokens.Fresh)
        }
        "blocked" -> RowSpec(
            key = "blocked",
            title = "SEND MESSAGE",
            sub = "NO TARGET",
            icon = RingIcons.Link,
            hint = "Blocked actions keep an honest reason and no gesture.",
            semanticColor = RingTokens.Broken,
        )
        "failure" -> RowSpec(
            key = "failure",
            title = if (failed) "TRY AGAIN" else "RUN ACTION",
            sub = if (failed) "FAILED" else "READY",
            icon = if (failed) RingIcons.Warning else RingIcons.Play,
            hint = "A callback failure remains recoverable in the same control.",
            onTap = { emitter.emit(ShowcaseRendererEventPayload("action.run", "fail".takeIf { !failed })) },
            semanticColor = RingTokens.Broken.takeIf { failed },
        )
        else -> error("Unknown action scenario $scenario")
    }

    private fun action(
        title: String,
        sub: String,
        timing: CircleActionTiming,
        onTap: () -> Unit,
    ) = RowSpec(
        key = "action",
        title = title,
        sub = sub,
        icon = RingIcons.Target,
        hint = "The timing is declared by the row data.",
        onTap = onTap,
        actionTiming = timing,
    )

    private fun choiceOptions(scenario: String): List<String> = when (scenario) {
        "off", "on" -> TOGGLE_OPTIONS
        "two" -> listOf("METRES", "FEET")
        "first", "middle", "last" -> listOf("A", "B", "C", "D", "E", "F", "G")
        else -> error("Unknown choice scenario $scenario")
    }

    private val ShowcaseWorkState.copy: String
        get() = when (this) {
            ShowcaseWorkState.NONE -> "IDLE"
            ShowcaseWorkState.INDETERMINATE -> "WORKING"
            ShowcaseWorkState.EMPTY -> "0%"
            ShowcaseWorkState.HALF -> "50%"
            ShowcaseWorkState.COMPLETE -> "100%"
            ShowcaseWorkState.FAILED -> "OFFLINE"
        }

    private val TOGGLE_OPTIONS = listOf("OFF", "ON")
}

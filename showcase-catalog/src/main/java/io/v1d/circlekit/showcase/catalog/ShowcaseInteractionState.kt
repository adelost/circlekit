package io.v1d.circlekit.showcase.catalog

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class ShowcaseAvailability { AVAILABLE, RECOVERABLE, BLOCKED }

enum class ShowcaseWorkState { NONE, INDETERMINATE, EMPTY, HALF, COMPLETE, FAILED }

/** Pure deterministic state shared verbatim by the Phone and Wear hosts. */
class ShowcaseInteractionState {
    private val mutableActionCount = MutableStateFlow(0)
    private val mutableActionFailed = MutableStateFlow(false)
    private val mutableAvailability = MutableStateFlow(ShowcaseAvailability.AVAILABLE)
    private val mutableChoiceIndex = MutableStateFlow(0)
    private val mutableAdjustmentValue = MutableStateFlow(500)
    private val mutableWork = MutableStateFlow(ShowcaseWorkState.NONE)

    val actionCount: StateFlow<Int> = mutableActionCount.asStateFlow()
    val actionFailed: StateFlow<Boolean> = mutableActionFailed.asStateFlow()
    val availability: StateFlow<ShowcaseAvailability> = mutableAvailability.asStateFlow()
    val choiceIndex: StateFlow<Int> = mutableChoiceIndex.asStateFlow()
    val adjustmentValue: StateFlow<Int> = mutableAdjustmentValue.asStateFlow()
    val work: StateFlow<ShowcaseWorkState> = mutableWork.asStateFlow()

    fun prepare(caseId: ShowcaseCaseId, scenarioId: ShowcaseScenarioId) {
        mutableActionCount.value = 0
        mutableActionFailed.value = caseId.value == "control.action-row" && scenarioId.value == "failure"
        mutableAvailability.value = when (scenarioId.value) {
            "recoverable" -> ShowcaseAvailability.RECOVERABLE
            "blocked" -> ShowcaseAvailability.BLOCKED
            else -> ShowcaseAvailability.AVAILABLE
        }
        mutableChoiceIndex.value = when (scenarioId.value) {
            "middle" -> 3
            "last" -> 6
            "on" -> 1
            else -> 0
        }
        mutableAdjustmentValue.value = when (scenarioId.value) {
            "minimum" -> 0
            "maximum" -> 1_000
            else -> 500
        }
        mutableWork.value = if (caseId.value == "control.progress") {
            when (scenarioId.value) {
                "indeterminate" -> ShowcaseWorkState.INDETERMINATE
                "empty" -> ShowcaseWorkState.EMPTY
                "half" -> ShowcaseWorkState.HALF
                "complete" -> ShowcaseWorkState.COMPLETE
                "failed" -> ShowcaseWorkState.FAILED
                else -> ShowcaseWorkState.NONE
            }
        } else {
            ShowcaseWorkState.NONE
        }
    }

    fun reset() {
        mutableActionCount.value = 0
        mutableActionFailed.value = false
        mutableAvailability.value = ShowcaseAvailability.AVAILABLE
        mutableChoiceIndex.value = 0
        mutableAdjustmentValue.value = 500
        mutableWork.value = ShowcaseWorkState.NONE
    }

    fun runAction(fails: Boolean = false) {
        mutableActionCount.value += 1
        mutableActionFailed.value = fails
    }

    fun recover() {
        mutableAvailability.value = ShowcaseAvailability.AVAILABLE
    }

    fun selectChoice(index: Int, optionCount: Int) {
        mutableChoiceIndex.value = index.coerceIn(0, optionCount - 1)
    }

    fun nextChoice(optionCount: Int) {
        selectChoice(mutableChoiceIndex.value + 1, optionCount)
    }

    fun adjust(delta: Int) {
        mutableAdjustmentValue.value = (mutableAdjustmentValue.value + delta).coerceIn(0, 1_000)
    }

    fun advanceWork() {
        mutableWork.value = when (mutableWork.value) {
            ShowcaseWorkState.NONE, ShowcaseWorkState.FAILED -> ShowcaseWorkState.INDETERMINATE
            ShowcaseWorkState.INDETERMINATE -> ShowcaseWorkState.EMPTY
            ShowcaseWorkState.EMPTY -> ShowcaseWorkState.HALF
            ShowcaseWorkState.HALF -> ShowcaseWorkState.COMPLETE
            ShowcaseWorkState.COMPLETE -> ShowcaseWorkState.NONE
        }
    }
}

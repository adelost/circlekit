package io.v1d.circlekit.showcase.catalog

import com.adelost.ringkit.ui.RingPlaybackState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Pure deterministic text and media truth shared by both showcase hosts. */
class ShowcaseMediaState {
    private val mutableText = MutableStateFlow("")
    private val mutableTextEnabled = MutableStateFlow(true)
    private val mutableSubmitCount = MutableStateFlow(0)
    private val mutableCaptureActive = MutableStateFlow(false)
    private val mutableCaptureEnabled = MutableStateFlow(true)
    private val mutableCaptureFailed = MutableStateFlow(false)
    private val mutableCaptureElapsedMs = MutableStateFlow(0L)
    private val mutableCaptureLevels = MutableStateFlow<List<Float>>(emptyList())
    private val mutablePlaybackState = MutableStateFlow(RingPlaybackState.READY)
    private val mutablePlaybackPositionMs = MutableStateFlow(0L)
    private val mutablePlaybackDurationMs = MutableStateFlow(83_000L)

    val text: StateFlow<String> = mutableText.asStateFlow()
    val submitCount: StateFlow<Int> = mutableSubmitCount.asStateFlow()
    val captureActive: StateFlow<Boolean> = mutableCaptureActive.asStateFlow()
    val captureEnabled: StateFlow<Boolean> = mutableCaptureEnabled.asStateFlow()
    val captureFailed: StateFlow<Boolean> = mutableCaptureFailed.asStateFlow()
    val captureElapsedMs: StateFlow<Long> = mutableCaptureElapsedMs.asStateFlow()
    val captureLevels: StateFlow<List<Float>> = mutableCaptureLevels.asStateFlow()
    val playbackState: StateFlow<RingPlaybackState> = mutablePlaybackState.asStateFlow()
    val playbackPositionMs: StateFlow<Long> = mutablePlaybackPositionMs.asStateFlow()
    val playbackDurationMs: StateFlow<Long> = mutablePlaybackDurationMs.asStateFlow()

    fun prepare(caseId: ShowcaseCaseId, scenarioId: ShowcaseScenarioId) {
        reset()
        when (caseId.value) {
            "input.text" -> prepareText(scenarioId.value)
            "control.press-ring" -> preparePress(scenarioId.value)
            "media.capture" -> prepareCapture(scenarioId.value)
            "media.playback" -> preparePlayback(scenarioId.value)
        }
    }

    fun reset() {
        mutableText.value = ""
        mutableTextEnabled.value = true
        mutableSubmitCount.value = 0
        mutableCaptureActive.value = false
        mutableCaptureEnabled.value = true
        mutableCaptureFailed.value = false
        mutableCaptureElapsedMs.value = 0L
        mutableCaptureLevels.value = emptyList()
        mutablePlaybackState.value = RingPlaybackState.READY
        mutablePlaybackPositionMs.value = 0L
        mutablePlaybackDurationMs.value = 83_000L
    }

    fun updateText(next: String) {
        mutableText.value = next.take(TEXT_MAX_LENGTH)
    }

    fun submitText() {
        if (mutableTextEnabled.value && mutableText.value.isNotBlank()) {
            mutableSubmitCount.value += 1
        }
    }

    fun beginCapture(): Boolean {
        if (!mutableCaptureEnabled.value) return false
        mutableCaptureFailed.value = false
        mutableCaptureActive.value = true
        mutableCaptureElapsedMs.value = mutableCaptureElapsedMs.value.coerceAtLeast(800L)
        mutableCaptureLevels.value = ACTIVE_LEVELS
        return true
    }

    fun releaseCapture() {
        mutableCaptureActive.value = false
        mutableCaptureElapsedMs.value = mutableCaptureElapsedMs.value.coerceAtLeast(3_200L)
    }

    fun cancelCapture() {
        mutableCaptureActive.value = false
    }

    fun failCapture() {
        mutableCaptureActive.value = false
        mutableCaptureFailed.value = true
    }

    fun togglePlayback() {
        mutablePlaybackState.value = when (mutablePlaybackState.value) {
            RingPlaybackState.LOADING -> RingPlaybackState.LOADING
            RingPlaybackState.READY, RingPlaybackState.PAUSED -> RingPlaybackState.PLAYING
            RingPlaybackState.PLAYING -> RingPlaybackState.PAUSED
            RingPlaybackState.COMPLETE, RingPlaybackState.FAILED -> RingPlaybackState.READY
        }
        if (mutablePlaybackState.value == RingPlaybackState.PLAYING && mutablePlaybackPositionMs.value == 0L) {
            mutablePlaybackPositionMs.value = 27_000L
        }
    }

    fun stopPlayback() {
        mutablePlaybackState.value = RingPlaybackState.READY
        mutablePlaybackPositionMs.value = 0L
    }

    private fun prepareText(scenario: String) {
        mutableText.value = when (scenario) {
            "empty" -> ""
            "filled" -> "Wind looks good"
            "max" -> "123456789012345678901234"
            "disabled" -> "Read only"
            else -> error("Unknown text scenario $scenario")
        }
        mutableTextEnabled.value = scenario != "disabled"
    }

    private fun preparePress(scenario: String) {
        when (scenario) {
            "idle" -> Unit
            "recording" -> {
                mutableCaptureActive.value = true
                mutableCaptureElapsedMs.value = 7_800L
            }
            "disabled" -> mutableCaptureEnabled.value = false
            "failed" -> mutableCaptureFailed.value = true
            else -> error("Unknown press scenario $scenario")
        }
    }

    private fun prepareCapture(scenario: String) {
        when (scenario) {
            "silent" -> Unit
            "active" -> {
                mutableCaptureActive.value = true
                mutableCaptureElapsedMs.value = 7_800L
                mutableCaptureLevels.value = ACTIVE_LEVELS
            }
            "long" -> {
                mutableCaptureActive.value = true
                mutableCaptureElapsedMs.value = 125_000L
                mutableCaptureLevels.value = LONG_LEVELS
            }
            else -> error("Unknown capture scenario $scenario")
        }
    }

    private fun preparePlayback(scenario: String) {
        when (scenario) {
            "ready" -> Unit
            "playing" -> {
                mutablePlaybackState.value = RingPlaybackState.PLAYING
                mutablePlaybackPositionMs.value = 27_000L
            }
            "paused" -> {
                mutablePlaybackState.value = RingPlaybackState.PAUSED
                mutablePlaybackPositionMs.value = 41_000L
            }
            "complete" -> {
                mutablePlaybackState.value = RingPlaybackState.COMPLETE
                mutablePlaybackPositionMs.value = 83_000L
            }
            "failed" -> {
                mutablePlaybackState.value = RingPlaybackState.FAILED
                mutablePlaybackPositionMs.value = 12_000L
            }
            else -> error("Unknown playback scenario $scenario")
        }
    }

    companion object {
        const val TEXT_MAX_LENGTH = 24
        private val ACTIVE_LEVELS = listOf(
            0.08f, 0.18f, 0.31f, 0.55f, 0.82f, 0.63f, 0.36f, 0.48f,
            0.74f, 0.92f, 0.68f, 0.41f, 0.22f, 0.34f, 0.58f, 0.77f,
            0.52f, 0.29f, 0.44f, 0.69f, 0.88f, 0.61f, 0.37f, 0.16f,
        )
        private val LONG_LEVELS = ACTIVE_LEVELS.reversed()
    }
}

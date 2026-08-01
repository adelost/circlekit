package io.v1d.circlekit.showcase.catalog

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.adelost.designkit.ui.CircleSurfaceClass
import com.adelost.designkit.ui.RingIcons
import com.adelost.ringkit.ui.PhoneScreenHeader
import com.adelost.ringkit.ui.RingAudioCaptureFeedback
import com.adelost.ringkit.ui.RingAudioCaptureFeedbackSpec
import com.adelost.ringkit.ui.RingPlaybackControls
import com.adelost.ringkit.ui.RingPlaybackSpec
import com.adelost.ringkit.ui.RingPressLifecycle
import com.adelost.ringkit.ui.RingPressLifecycleSpec
import com.adelost.ringkit.ui.RingScreen
import com.adelost.ringkit.ui.RingTextComposer
import com.adelost.ringkit.ui.RingTextEntryPort
import com.adelost.ringkit.ui.RingTextInputSpec
import com.adelost.ringkit.ui.RowSpec
import kotlinx.coroutines.flow.combine

sealed interface ShowcasePresentation {
    data class Screen(val value: RingScreen) : ShowcasePresentation
    data class Component(val kind: ShowcaseComponentKind) : ShowcasePresentation
}

enum class ShowcaseComponentKind { TEXT, PRESS, CAPTURE, PLAYBACK }

object ShowcasePresentations {
    fun selected(
        destination: ShowcaseDestination,
        session: ShowcaseSession,
        surface: CircleSurfaceClass,
        textEntryPort: RingTextEntryPort?,
    ): ShowcasePresentation {
        val pair = ShowcaseManifest.find(
            requireNotNull(destination.caseId),
            requireNotNull(destination.scenarioId),
        ) ?: error("Showcase destination was validated before selection")
        return when (pair.first.id.value) {
            "input.text" -> if (surface == CircleSurfaceClass.ROUND) {
                ShowcasePresentation.Screen(textEntryRows(pair.second, session.media, textEntryPort))
            } else {
                ShowcasePresentation.Component(ShowcaseComponentKind.TEXT)
            }
            "control.press-ring" -> ShowcasePresentation.Component(ShowcaseComponentKind.PRESS)
            "media.capture" -> ShowcasePresentation.Component(ShowcaseComponentKind.CAPTURE)
            "media.playback" -> ShowcasePresentation.Component(ShowcaseComponentKind.PLAYBACK)
            else -> ShowcasePresentation.Screen(ShowcaseScreens.selectedScreen(destination, session))
        }
    }

    private fun textEntryRows(
        scenario: ShowcaseScenario,
        state: ShowcaseMediaState,
        port: RingTextEntryPort?,
    ): RingScreen.Rows = RingScreen.Rows(
        title = scenario.label,
        items = combine(state.text, state.submitCount) { text, submits ->
            val spec = textSpec(scenario, state, text)
            val available = spec.enabled && port != null
            listOf(
                RowSpec(
                    key = "platform-text",
                    title = if (available) "EDIT TEXT" else "TEXT INPUT",
                    sub = when {
                        port == null -> "PLATFORM IME UNAVAILABLE"
                        text.isEmpty() -> "EMPTY · SENT $submits"
                        else -> "$text · SENT $submits"
                    },
                    icon = RingIcons.Pencil,
                    hint = "Opens the Wear system editor; CircleKit keeps the same text spec.",
                    onTap = if (available) {
                        {
                            port.openPlatformTextEntry(spec) { result ->
                                spec.onValueChange(result.take(spec.maxLength))
                                spec.onSubmit()
                            }
                        }
                    } else {
                        null
                    },
                ),
            )
        },
    )

    @Composable
    fun ComponentPreview(
        destination: ShowcaseDestination,
        kind: ShowcaseComponentKind,
        state: ShowcaseMediaState,
        surface: CircleSurfaceClass,
        onBack: () -> Unit,
    ) {
        val scenario = requireNotNull(destination.scenarioId).value
        ComponentFrame(
            title = ShowcaseManifest.find(requireNotNull(destination.caseId))?.title.orEmpty(),
            surface = surface,
            onBack = onBack,
        ) {
            when (kind) {
                ShowcaseComponentKind.TEXT -> TextPreview(scenario, state)
                ShowcaseComponentKind.PRESS -> PressPreview(state)
                ShowcaseComponentKind.CAPTURE -> CapturePreview(state, surface)
                ShowcaseComponentKind.PLAYBACK -> PlaybackPreview(state)
            }
        }
    }

    @Composable
    private fun ComponentFrame(
        title: String,
        surface: CircleSurfaceClass,
        onBack: () -> Unit,
        content: @Composable () -> Unit,
    ) {
        if (surface == CircleSurfaceClass.ROUND) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                Box(
                    modifier = Modifier.fillMaxWidth(),
                    contentAlignment = Alignment.Center,
                ) {
                    content()
                }
            }
        } else {
            Column(Modifier.fillMaxSize()) {
                PhoneScreenHeader(title = title, onBack = onBack)
                Box(
                    modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    content()
                }
            }
        }
    }

    @Composable
    private fun TextPreview(scenario: String, state: ShowcaseMediaState) {
        val text by state.text.collectAsState()
        RingTextComposer(
            spec = textSpec(
                ShowcaseScenario(ShowcaseScenarioId(scenario), scenario.uppercase()),
                state,
                text,
            ),
        )
    }

    @Composable
    private fun PressPreview(state: ShowcaseMediaState) {
        val active by state.captureActive.collectAsState()
        val enabled by state.captureEnabled.collectAsState()
        val failed by state.captureFailed.collectAsState()
        val elapsedMs by state.captureElapsedMs.collectAsState()
        RingPressLifecycle(
            spec = RingPressLifecycleSpec(
                label = if (failed) "TRY AGAIN" else if (active) "RECORDING" else "RECORD",
                active = active,
                enabled = enabled,
                centerValue = if (active) formatSeconds(elapsedMs) else null,
                sub = when {
                    failed -> "FAILED"
                    !enabled -> "DISABLED"
                    active -> null
                    else -> "HOLD"
                },
                onBegin = state::beginCapture,
                onRelease = state::releaseCapture,
                onCancel = state::cancelCapture,
            ),
        )
    }

    @Composable
    private fun CapturePreview(state: ShowcaseMediaState, surface: CircleSurfaceClass) {
        val active by state.captureActive.collectAsState()
        val elapsedMs by state.captureElapsedMs.collectAsState()
        val levels by state.captureLevels.collectAsState()
        RingAudioCaptureFeedback(
            spec = RingAudioCaptureFeedbackSpec(
                elapsedMs = elapsedMs,
                levels = levels,
                active = active,
            ),
            modifier = Modifier
                .fillMaxWidth()
                .offset(y = if (surface == CircleSurfaceClass.ROUND) (-42).dp else 0.dp),
        )
    }

    @Composable
    private fun PlaybackPreview(state: ShowcaseMediaState) {
        val playbackState by state.playbackState.collectAsState()
        val positionMs by state.playbackPositionMs.collectAsState()
        val durationMs by state.playbackDurationMs.collectAsState()
        RingPlaybackControls(
            spec = RingPlaybackSpec(
                title = "VOICE REPLY",
                state = playbackState,
                positionMs = positionMs,
                durationMs = durationMs,
                onPlayPause = state::togglePlayback,
                onStop = state::stopPlayback,
            ),
        )
    }

    private fun textSpec(
        scenario: ShowcaseScenario,
        state: ShowcaseMediaState,
        text: String,
    ) = RingTextInputSpec(
        value = text,
        label = "MESSAGE",
        enabled = scenario.id.value != "disabled",
        maxLength = ShowcaseMediaState.TEXT_MAX_LENGTH,
        onValueChange = state::updateText,
        onSubmit = state::submitText,
    )

    private fun formatSeconds(elapsedMs: Long): String = "%.1f S".format(elapsedMs / 1_000f)
}

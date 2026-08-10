package io.v1d.circlekit.showcase.catalog

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
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
import kotlinx.coroutines.flow.flowOf

sealed interface ShowcasePresentation {
    data class Screen(val value: RingScreen) : ShowcasePresentation
    data class Component(val kind: ShowcaseComponentKind) : ShowcasePresentation
}

enum class ShowcaseComponentKind { TEXT, PRESS, CAPTURE, PLAYBACK }

object ShowcasePresentations {
    fun selected(
        mounted: ShowcaseMountedRenderer,
        surface: CircleSurfaceClass,
    ): ShowcasePresentation {
        val catalog = mounted.inputs.require<ShowcaseCatalogRendererInput>("${mounted.renderer.componentId()}.catalog")
        return when (mounted.renderer) {
            ShowcaseNativeRenderer.TEXT -> if (surface == CircleSurfaceClass.ROUND) {
                ShowcasePresentation.Screen(textEntryRows(
                    catalog.scenario,
                    mounted.snapshot(),
                    mounted.typedEmitter(),
                ))
            } else {
                ShowcasePresentation.Component(ShowcaseComponentKind.TEXT)
            }
            ShowcaseNativeRenderer.PRESS -> ShowcasePresentation.Component(ShowcaseComponentKind.PRESS)
            ShowcaseNativeRenderer.CAPTURE -> ShowcasePresentation.Component(ShowcaseComponentKind.CAPTURE)
            ShowcaseNativeRenderer.PLAYBACK -> ShowcasePresentation.Component(ShowcaseComponentKind.PLAYBACK)
            else -> ShowcasePresentation.Screen(ShowcaseScreens.selectedScreen(mounted))
        }
    }

    private fun textEntryRows(
        scenario: ShowcaseScenario,
        model: ShowcaseRendererSnapshot,
        emitter: ShowcaseTypedRendererEmitter,
    ): RingScreen.Rows = RingScreen.Rows(
        title = scenario.label,
        items = (model as ShowcaseTextSnapshot).let { snapshot -> flowOf(
            textSpec(scenario, snapshot.text, emitter).let { spec ->
            val available = spec.enabled
            listOf(
                RowSpec(
                    key = "platform-text",
                    title = if (available) "EDIT TEXT" else "TEXT INPUT",
                    sub = when {
                        snapshot.text.isEmpty() -> "EMPTY · SENT ${snapshot.submitCount}"
                        else -> "${snapshot.text} · SENT ${snapshot.submitCount}"
                    },
                    icon = RingIcons.Pencil,
                    hint = "Opens the Wear system editor; CircleKit keeps the same text spec.",
                    onTap = if (available) {
                        { emitter.emit(ShowcaseRendererEventPayload("text.platform")) }
                    } else {
                        null
                    },
                ),
            ) }
        ) },
    )

    @Composable
    fun ComponentPreview(
        mounted: ShowcaseMountedRenderer,
        kind: ShowcaseComponentKind,
        surface: CircleSurfaceClass,
        onBack: () -> Unit,
    ) {
        val catalog = mounted.inputs.require<ShowcaseCatalogRendererInput>("${mounted.renderer.componentId()}.catalog")
        val snapshot = mounted.snapshot()
        val emitter = mounted.typedEmitter()
        val scenario = catalog.scenario.id.value
        ComponentFrame(
            title = catalog.case.title,
            surface = surface,
            onBack = onBack,
        ) {
            when (kind) {
                ShowcaseComponentKind.TEXT -> TextPreview(scenario, snapshot as ShowcaseTextSnapshot, emitter)
                ShowcaseComponentKind.PRESS -> PressPreview(snapshot as ShowcasePressSnapshot, emitter)
                ShowcaseComponentKind.CAPTURE -> CapturePreview(snapshot as ShowcaseCaptureSnapshot, surface)
                ShowcaseComponentKind.PLAYBACK -> PlaybackPreview(snapshot as ShowcasePlaybackSnapshot, emitter)
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
                    modifier = Modifier.weight(1f).fillMaxWidth().padding(horizontal = 16.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    content()
                }
            }
        }
    }

    @Composable
    private fun TextPreview(
        scenario: String,
        model: ShowcaseTextSnapshot,
        emitter: ShowcaseTypedRendererEmitter,
    ) {
        RingTextComposer(
            spec = textSpec(
                ShowcaseScenario(ShowcaseScenarioId(scenario), scenario.uppercase()),
                model.text,
                emitter,
            ),
        )
    }

    @Composable
    private fun PressPreview(model: ShowcasePressSnapshot, emitter: ShowcaseTypedRendererEmitter) {
        RingPressLifecycle(
            spec = RingPressLifecycleSpec(
                label = if (model.failed) "TRY AGAIN" else if (model.active) "RECORDING" else "RECORD",
                active = model.active,
                enabled = model.enabled,
                centerValue = if (model.active) formatSeconds(model.elapsedMs) else null,
                sub = when {
                    model.failed -> "FAILED"
                    !model.enabled -> "DISABLED"
                    model.active -> null
                    else -> "HOLD"
                },
                onBegin = { true.also { emitter.emit(ShowcaseRendererEventPayload("capture.begin")) } },
                onRelease = { emitter.emit(ShowcaseRendererEventPayload("capture.release")) },
                onCancel = { emitter.emit(ShowcaseRendererEventPayload("capture.cancel")) },
            ),
        )
    }

    @Composable
    private fun CapturePreview(model: ShowcaseCaptureSnapshot, surface: CircleSurfaceClass) {
        RingAudioCaptureFeedback(
            spec = RingAudioCaptureFeedbackSpec(
                elapsedMs = model.elapsedMs,
                levels = model.levels,
                active = model.active,
            ),
            modifier = Modifier
                .fillMaxWidth()
                .offset(y = if (surface == CircleSurfaceClass.ROUND) (-42).dp else 0.dp),
        )
    }

    @Composable
    private fun PlaybackPreview(model: ShowcasePlaybackSnapshot, emitter: ShowcaseTypedRendererEmitter) {
        RingPlaybackControls(
            spec = RingPlaybackSpec(
                title = "VOICE REPLY",
                state = model.state,
                positionMs = model.positionMs,
                durationMs = model.durationMs,
                onPlayPause = { emitter.emit(ShowcaseRendererEventPayload("playback.toggle")) },
                onStop = { emitter.emit(ShowcaseRendererEventPayload("playback.stop")) },
            ),
        )
    }

    private fun textSpec(
        scenario: ShowcaseScenario,
        text: String,
        emitter: ShowcaseTypedRendererEmitter,
    ) = RingTextInputSpec(
        value = text,
        label = "MESSAGE",
        enabled = scenario.id.value != "disabled",
        maxLength = ShowcaseMediaState.TEXT_MAX_LENGTH,
        onValueChange = { emitter.emit(ShowcaseRendererEventPayload("text.change", it)) },
        onSubmit = { emitter.emit(ShowcaseRendererEventPayload("text.submit")) },
    )

    fun textSpecForHost(scenario: ShowcaseScenario, text: String) = RingTextInputSpec(
        value = text,
        label = "MESSAGE",
        enabled = scenario.id.value != "disabled",
        maxLength = ShowcaseMediaState.TEXT_MAX_LENGTH,
        onValueChange = {},
        onSubmit = {},
    )

    private fun formatSeconds(elapsedMs: Long): String = "%.1f S".format(elapsedMs / 1_000f)
}

private fun ShowcaseMountedRenderer.snapshot(): ShowcaseRendererSnapshot =
    inputs.require("${renderer.componentId()}.renderer")

private fun ShowcaseMountedRenderer.typedEmitter(): ShowcaseTypedRendererEmitter =
    eventEmitter as ShowcaseTypedRendererEmitter

fun ShowcaseNativeRenderer.componentId(): String = when (this) {
    ShowcaseNativeRenderer.COLORS -> "foundation.colors"
    ShowcaseNativeRenderer.GEOMETRY -> "foundation.geometry"
    ShowcaseNativeRenderer.ICON_ACTIONS -> "atom.icon-action"
    ShowcaseNativeRenderer.ACTION_ROWS -> "control.action-row"
    ShowcaseNativeRenderer.CHOICE_ROWS -> "control.choice-row"
    ShowcaseNativeRenderer.ADJUSTMENT -> "control.adjustment"
    ShowcaseNativeRenderer.PROGRESS -> "control.progress"
    ShowcaseNativeRenderer.PRESS -> "control.press-ring"
    ShowcaseNativeRenderer.TEXT -> "input.text"
    ShowcaseNativeRenderer.CAPTURE -> "media.capture"
    ShowcaseNativeRenderer.PLAYBACK -> "media.playback"
    ShowcaseNativeRenderer.SCREEN_TEMPLATES -> "template.screens"
    ShowcaseNativeRenderer.SOURCE -> "flow.source"
    ShowcaseNativeRenderer.UPDATE -> "flow.update"
    ShowcaseNativeRenderer.SERVICE -> "flow.service"
    ShowcaseNativeRenderer.PAGE_HOST -> "page.host"
    ShowcaseNativeRenderer.PAGE_MENU -> "page.menu"
}

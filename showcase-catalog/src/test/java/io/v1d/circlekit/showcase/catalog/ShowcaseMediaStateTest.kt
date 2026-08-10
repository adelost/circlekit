package io.v1d.circlekit.showcase.catalog

import com.adelost.designkit.ui.CircleSurfaceClass
import com.adelost.ringkit.ui.RingPlaybackState
import com.adelost.ringkit.ui.RingScreen
import com.adelost.ringkit.ui.RingTextEntryPort
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ShowcaseMediaStateTest {
    @Test
    fun `text state enforces max disabled and submit truth`() {
        val state = ShowcaseMediaState()
        state.prepare(ShowcaseCaseId("input.text"), ShowcaseScenarioId("disabled"))
        state.submitText()
        assertEquals(0, state.submitCount.value)

        state.prepare(ShowcaseCaseId("input.text"), ShowcaseScenarioId("empty"))
        state.updateText("x".repeat(ShowcaseMediaState.TEXT_MAX_LENGTH + 20))
        state.submitText()
        assertEquals(ShowcaseMediaState.TEXT_MAX_LENGTH, state.text.value.length)
        assertEquals(1, state.submitCount.value)
    }

    @Test
    fun `capture and playback transitions stay deterministic`() {
        val state = ShowcaseMediaState()
        state.prepare(ShowcaseCaseId("control.press-ring"), ShowcaseScenarioId("disabled"))
        assertFalse(state.beginCapture())

        state.prepare(ShowcaseCaseId("control.press-ring"), ShowcaseScenarioId("idle"))
        assertTrue(state.beginCapture())
        state.releaseCapture()
        assertFalse(state.captureActive.value)
        assertEquals(3_200L, state.captureElapsedMs.value)

        state.prepare(ShowcaseCaseId("media.playback"), ShowcaseScenarioId("paused"))
        state.togglePlayback()
        assertEquals(RingPlaybackState.PLAYING, state.playbackState.value)
        state.stopPlayback()
        assertEquals(RingPlaybackState.READY, state.playbackState.value)
        assertEquals(0L, state.playbackPositionMs.value)
    }

    @Test
    fun `round text projection delegates to the platform port`() = runBlocking {
        val session = ShowcaseSession(ShowcaseArtifactProfile.WEAR_FULL_UI)
        session.open(ShowcaseCaseId("input.text"), ShowcaseScenarioId("empty"))
        val port = RingTextEntryPort { _, onResult -> onResult("platform text") }
        val mounted = ShowcaseNativeBindings.mountRenderer(
            session,
            session.destination.value,
            CircleSurfaceClass.ROUND,
            port,
        )
        val presentation = ShowcasePresentations.selected(
            mounted = mounted,
            surface = CircleSurfaceClass.ROUND,
        ) as ShowcasePresentation.Screen
        val row = (presentation.value as RingScreen.Rows).items.first().single()

        requireNotNull(row.onTap).invoke()

        assertEquals("platform text", session.media.text.value)
        assertEquals(1, session.media.submitCount.value)
    }
}

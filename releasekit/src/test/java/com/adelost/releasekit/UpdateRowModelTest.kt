package com.adelost.releasekit

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Every UpdateState must name itself and decide what a tap does. An
 * unreachable state would leave a row that says nothing and does nothing.
 */
class UpdateRowModelTest {
    private val installed = "1.2.3"

    @Test
    fun `a live download or install refuses a second tap`() {
        for (state in listOf(
            UpdateState.Checking,
            UpdateState.Downloading("1.2.4", 0.5f, 10),
            UpdateState.Installing("1.2.4", "/cache/a.apk", 10),
        )) {
            assertEquals(
                "$state must not be tappable",
                UpdateRowAction.NONE,
                updateRowModel(state, installed).action,
            )
        }
    }

    @Test
    fun `what failed can be retried and what is ready can be installed`() {
        val failed = updateRowModel(UpdateState.Failed("release catalog HTTP 404"), installed)
        assertEquals(UpdateRowAction.CHECK, failed.action)
        assertEquals("FAILED · release catalog HTTP 404 · TAP TO RETRY", failed.sub)
        assertEquals(
            UpdateRowAction.INSTALL,
            updateRowModel(UpdateState.ReadyToInstall("1.2.4", "/cache/a.apk", 10), installed).action,
        )
        val installFailed = updateRowModel(
            UpdateState.InstallFailed("1.2.4", "/cache/a.apk", "no space", 10),
            installed,
        )
        assertEquals(UpdateRowAction.INSTALL, installFailed.action)
        assertEquals("INSTALL FAILED · no space · TAP", installFailed.sub)
    }

    @Test
    fun `an unavailable catalog is honest and its reason is bounded to one line`() {
        val model = updateRowModel(
            UpdateState.Unavailable("manifest\nexpired " + "x".repeat(100)),
            installed,
        )

        assertEquals(UpdateRowAction.CHECK, model.action)
        assert(model.sub.startsWith("UNAVAILABLE · manifest expired "))
        assert(!model.sub.contains('\n'))
        assertEquals(72, model.sub.substringAfter("UNAVAILABLE · ").substringBefore(" · TAP").length)
    }

    @Test
    fun `an idle row names the installed version so the row is never blank`() {
        val model = updateRowModel(UpdateState.Idle, installed)
        assertEquals(UpdateRowAction.CHECK, model.action)
        assert(model.sub.contains(installed))
        assertNull(model.releaseInfo)
    }

    @Test
    fun `up to date row retains the fetched release identity`() {
        val publishedAt = 1_801_234_567_890L
        val model = updateRowModel(UpdateState.UpToDate(installed, publishedAt), installed)

        assertEquals(UpdateRowAction.CHECK, model.action)
        assertEquals("v1.2.3 · UP TO DATE · TAP", model.sub)
        assertEquals(ReleaseInfo(installed, publishedAt), model.releaseInfo)
    }

    @Test
    fun `release identity reaches the row as raw epoch data`() {
        val publishedAt = 1_801_234_567_890L
        val model = updateRowModel(
            UpdateState.Available("1.2.4", 4_200_000L, "New controls", publishedAt),
            installed,
        )

        assertEquals(ReleaseInfo("1.2.4", publishedAt), model.releaseInfo)
        assertEquals("v1.2.4 AVAILABLE · TAP", model.sub)
    }

    @Test
    fun `download progress is reported as a bounded fraction`() {
        assertEquals(
            UpdateProgress.Determinate(0.5f),
            updateRowProgress(UpdateState.Downloading("1.2.4", 0.5f, 10)),
        )
        // A source that over- or under-reports must not drive a bar past its ends.
        assertEquals(
            UpdateProgress.Determinate(1f),
            updateRowProgress(UpdateState.Downloading("1.2.4", 9f, 10)),
        )
        assertEquals(
            UpdateProgress.Determinate(0f),
            updateRowProgress(UpdateState.Downloading("1.2.4", -1f, 10)),
        )
    }

    @Test
    fun `waiting on the user shows no spinner, because nothing is running`() {
        assertNull(
            updateRowProgress(
                UpdateState.Installing("1.2.4", "/cache/a.apk", 10, awaitingUserConfirmation = true),
            ),
        )
        assertEquals(
            UpdateProgress.Indeterminate,
            updateRowProgress(UpdateState.Installing("1.2.4", "/cache/a.apk", 10)),
        )
    }
}

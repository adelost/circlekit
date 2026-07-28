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
        assertEquals(
            UpdateRowAction.CHECK,
            updateRowModel(UpdateState.Failed("network"), installed).action,
        )
        assertEquals(
            UpdateRowAction.INSTALL,
            updateRowModel(UpdateState.ReadyToInstall("1.2.4", "/cache/a.apk", 10), installed).action,
        )
        assertEquals(
            UpdateRowAction.INSTALL,
            updateRowModel(UpdateState.InstallFailed("1.2.4", "/cache/a.apk", "no space", 10), installed).action,
        )
    }

    @Test
    fun `an idle row names the installed version so the row is never blank`() {
        for (state in listOf(UpdateState.Idle, UpdateState.UpToDate)) {
            val model = updateRowModel(state, installed)
            assertEquals(UpdateRowAction.CHECK, model.action)
            assert(model.sub.contains(installed)) { "$state hides which version is installed" }
        }
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

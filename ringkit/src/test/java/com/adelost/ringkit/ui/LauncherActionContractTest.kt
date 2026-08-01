package com.adelost.ringkit.ui

import com.adelost.designkit.ui.CircleActionTiming
import com.adelost.designkit.ui.RingIcons
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class LauncherActionContractTest {
    @Test
    fun `launcher availability and timing are spec data`() = runBlocking {
        val spec = LaunchSpec(
            icon = RingIcons.Target,
            label = "CENTER",
            open = { null },
            run = {},
            enabled = flowOf(false),
            actionTiming = CircleActionTiming.IMMEDIATE,
        )

        assertFalse(spec.enabled.first())
        assertEquals(CircleActionTiming.IMMEDIATE, spec.actionTiming)
    }
}

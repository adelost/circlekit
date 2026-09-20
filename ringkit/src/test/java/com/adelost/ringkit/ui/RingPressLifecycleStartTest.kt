package com.adelost.ringkit.ui

import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import com.adelost.designkit.press.CirclePressProbe
import com.adelost.designkit.ui.CircleActionHostCost
import com.adelost.designkit.ui.CirclePressStart
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** WHAT: Checks ON_DOWN through the public Ring lifecycle. WHY: Keeps content duration independent from worn intent cost. */
@RunWith(RobolectricTestRunner::class)
@Config(application = android.app.Application::class, sdk = [35], qualifiers = "w390dp-h844dp-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class RingPressLifecycleStartTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun `on down begins inside forty milliseconds on a worn host`() {
        var begins = 0
        var releases = 0
        var cancels = 0
        val probe = CirclePressProbe(compose)
        probe.mount(CircleActionHostCost.WORN) {
            Box(Modifier.fillMaxSize().background(Color.Black)) {
                RingPressLifecycle(
                    spec = RingPressLifecycleSpec(
                        label = "PUSH TO TALK",
                        active = false,
                        enabled = true,
                        start = CirclePressStart.ON_DOWN,
                        onBegin = { begins += 1; true },
                        onRelease = { releases += 1 },
                        onCancel = { cancels += 1 },
                    ),
                )
            }
        }

        probe.press(compose.onNodeWithContentDescription("PUSH TO TALK"), 40L)

        assertEquals(1, begins)
        assertEquals(1, releases)
        assertEquals(0, cancels)
    }
}

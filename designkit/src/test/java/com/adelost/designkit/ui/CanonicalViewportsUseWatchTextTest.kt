package com.adelost.designkit.ui

import androidx.activity.ComponentActivity
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.text.TextLayoutResult
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@Config(application = android.app.Application::class, sdk = [35], qualifiers = "w411dp-h891dp-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class CanonicalViewportsUseWatchTextTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test fun `a canonical face on phone uses watch text without changing its host profile`() {
        compose.setContent {
            CompositionLocalProvider(LocalCircleUiProfile provides CircleUiProfiles.PhoneCompact) {
                CircleComponentViewport(CircleComponentViewportSpec(320f, CircleContentScale.CanonicalFit(192f))) {
                    assertEquals(CircleSurfaceClass.PHONE_COMPACT, LocalCircleUiProfile.current.surfaceClass)
                    CircleText("GPS", CircleTextRole.NOTE, Color.White)
                }
            }
        }
        assertEquals(6.5f, sizeOf("GPS"))
    }

    @Test fun `a phone layout outside a canonical viewport keeps the phone role`() {
        compose.setContent {
            CompositionLocalProvider(LocalCircleUiProfile provides CircleUiProfiles.PhoneCompact) {
                CircleText("SETTINGS", CircleTextRole.NOTE, Color.White)
            }
        }
        assertEquals(12f, sizeOf("SETTINGS"))
    }

    private fun sizeOf(text: String): Float {
        compose.waitForIdle()
        val results = mutableListOf<TextLayoutResult>()
        compose.onNodeWithText(text).fetchSemanticsNode()
            .config[SemanticsActions.GetTextLayoutResult].action?.invoke(results)
        return results.single().layoutInput.style.fontSize.value
    }
}

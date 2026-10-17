package com.adelost.designkit.ui

import androidx.activity.ComponentActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import com.adelost.designkit.glass.CircleGlass
import com.adelost.designkit.glass.CircleGlassPalette
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * An off ring looks off whatever colour a product handed it (style C: off is no ground, the grey edge and a dimmed
 * icon). A launcher's `semanticColor` is a pigment for the icon, and since 0.3.131's C discs it beat the off look:
 * a disabled launcher showed it at full strength, where before the disabled grey had come first.
 */
@RunWith(RobolectricTestRunner::class)
@Config(application = android.app.Application::class, sdk = [35], qualifiers = "w390dp-h844dp-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class AnOffRingLooksOffTest {

    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val glass = CircleGlass(compose)
    private val enabled = mutableStateOf(false)
    private val active = mutableStateOf<Boolean?>(null)

    @Test
    fun `a disabled launcher dims its icon whatever colour it was handed`() {
        mountTheRing()

        assertEquals("a disabled ring shows no handed colour", 0, glass.count(HANDED))
        assertTrue("its icon is its kind's dimmed tone", glass.count(CircleGlassPalette.kind.dim) > 0)

        enabled.value = true
        assertTrue("the same ring at rest wears the colour it was handed", glass.count(HANDED) > 0)
    }

    @Test
    fun `a toggle that is off dims its icon whatever colour it was handed`() {
        enabled.value = true
        active.value = false
        mountTheRing()

        assertEquals("an off ring shows no handed colour", 0, glass.count(HANDED))
        assertTrue("its icon is its kind's dimmed tone", glass.count(CircleGlassPalette.kind.dim) > 0)
    }

    private fun mountTheRing() = compose.setContent {
        CompositionLocalProvider(LocalCircleActionHostCost provides CircleActionHostCost.NONE) {
            CircleAccentPaletteProvider(CircleGlassPalette.palette) {
                Box(Modifier.fillMaxSize().background(Color.Black), contentAlignment = Alignment.Center) {
                    CircleIconRing(
                        icon = RingIcons.Grid, label = "MAP", onTap = {},
                        enabled = enabled.value, active = active.value, semanticColor = HANDED,
                    )
                }
            }
        }
    }

    private companion object {
        /** A product's pigment for a launcher, unlike every tone of the palette in scope. */
        val HANDED = Color(0xFFE040A0)
    }
}

package com.adelost.ringkit.ui

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
import com.adelost.designkit.ui.CircleAccentPaletteProvider
import com.adelost.designkit.ui.CircleActionHostCost
import com.adelost.designkit.ui.CircleStyleTokens
import com.adelost.designkit.ui.LocalCircleActionHostCost
import com.adelost.designkit.ui.RingIcons
import com.adelost.designkit.ui.RingTokens
import com.adelost.ringkit.data.Health
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * A data source's ring is the same C disc as every other (style C, skydive-altimeter
 * docs/plans/2026-10-17-skyvw-style-c.md, "Ikonskiva"): it rests on its kind's ground with its edge, the icon wears
 * its kind, and the source's health is the scale's colour on the value. Skyvw's STATUS hub (SKY, GPS, MAP, ALT REF)
 * is these rings. Before, the ring was a bare contour in the kit's old health green or orange around an ink icon and
 * an ink value.
 */
@RunWith(RobolectricTestRunner::class)
@Config(application = android.app.Application::class, sdk = [35], qualifiers = "w390dp-h844dp-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class AStatRingIsAStyleCDiscTest {

    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    private val glass = CircleGlass(compose)
    private val health = mutableStateOf(Health.FRESH)
    private val kind = CircleGlassPalette.kind

    @Test
    fun `a source's ring rests on its kind and wears its health on the value`() {
        mountTheRing()

        assertTrue("the disc rests on its kind's ground", glass.count(kind.ground) > 0)
        assertTrue("its edge is its kind's, not the health's", glass.count(kind.edge) > 0)
        assertTrue("the icon wears its kind", glass.count(kind.strong) > 0)
        assertTrue("a fresh value is the scale's ok, from the palette in scope", glass.count(CircleGlassPalette.ok) > 0)

        health.value = Health.AGING
        assertTrue("an aging value is the scale's caution", glass.count(CircleGlassPalette.caution) > 0)
        assertEquals("and the ok has gone with it", 0, glass.count(CircleGlassPalette.ok))

        health.value = Health.BROKEN
        assertTrue("a broken value is the scale's danger", glass.count(CircleGlassPalette.danger) > 0)
    }

    @Test
    fun `a source that is off is an off disc`() {
        health.value = Health.OFF
        mountTheRing()

        assertEquals("an off disc has no ground", 0, glass.count(kind.ground))
        assertTrue("its edge is the grey that means off", glass.count(CircleStyleTokens.Off, within = 0) > 0)
        assertTrue("its icon dims", glass.count(kind.dim) > 0)
        assertEquals("nothing on it reads as ink", 0, glass.count(RingTokens.Ink))
    }

    private fun mountTheRing() = compose.setContent {
        CompositionLocalProvider(LocalCircleActionHostCost provides CircleActionHostCost.NONE) {
            CircleAccentPaletteProvider(CircleGlassPalette.palette) {
                Box(Modifier.fillMaxSize().background(Color.Black), contentAlignment = Alignment.Center) {
                    StatRing(icon = RingIcons.Grid, value = "OK", health = health.value, label = "GPS", onTap = {})
                }
            }
        }
    }
}

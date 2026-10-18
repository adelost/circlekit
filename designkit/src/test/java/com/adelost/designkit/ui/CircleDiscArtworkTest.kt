package com.adelost.designkit.ui

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** The fixed-role contract replaces the deleted size-budget fitter; measure the actual reading now. */
@RunWith(RobolectricTestRunner::class)
@Config(application = android.app.Application::class, sdk = [35], qualifiers = "w192dp-h192dp-round-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class CircleDiscArtworkTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private val layouts = mutableMapOf<String, TextLayoutResult>()

    @Test fun `a ring reading keeps its unit at the declared unit size`() {
        compose.setContent {
            CompositionLocalProvider(LocalCircleTextLayouts provides { layouts[it.text] = it.layout }) {
                CircleIconRingFrame(RingIcons.Wind, "WIND", Modifier, 46.dp, null,
                    ringIconAccent(RingIcons.Wind), "6", 0f, null, null, true, Modifier, centerUnit = "m/s")
            }
        }
        compose.waitForIdle()
        val input = layouts.getValue("6 m/s").layoutInput
        assertEquals("the unit belongs to the reading, not its primary value", 7.5f,
            input.text.spanStyles.singleOrNull()?.item?.fontSize?.value ?: 0f, 0.001f)
    }

    @Test fun `pressure readings keep their role and unit size regardless of commas`() {
        compose.setContent {
            CompositionLocalProvider(LocalCircleTextLayouts provides { receipt -> layouts[receipt.text] = receipt.layout }) {
                Column {
                    for (value in listOf("1008.1", "1,008.1")) {
                        CircleDiscArtwork(spec(value, "hPa"), Modifier.size(100.dp))
                    }
                }
            }
        }
        compose.waitForIdle()
        for (text in listOf("1008.1 hPa", "1,008.1 hPa")) {
            val layout = layouts.getValue(text)
            assertEquals(12f, layout.layoutInput.style.fontSize.value)
            assertEquals(7.5f, layout.layoutInput.text.spanStyles.single().item.fontSize.value)
        }
    }

    @Test fun `a wide reading reports its shortage without reducing the role`() {
        compose.setContent {
            CompositionLocalProvider(LocalCircleTextLayouts provides { receipt -> layouts[receipt.text] = receipt.layout }) {
                CircleDiscArtwork(spec("1008.1", "hPa"), Modifier.size(20.dp))
            }
        }
        compose.waitForIdle()
        val layout = layouts.getValue("1008.1 hPa")
        assertEquals(12f, layout.layoutInput.style.fontSize.value)
        assertEquals(1, layout.lineCount)
        assertTrue(layout.didOverflowWidth)
    }

    @Test fun `zero width renders no disc reading`() {
        compose.setContent {
            CompositionLocalProvider(LocalCircleTextLayouts provides { receipt -> layouts[receipt.text] = receipt.layout }) {
                Box(Modifier.size(0.dp)) { CircleDiscArtwork(spec("1008.1", "hPa")) }
            }
        }
        compose.waitForIdle()
        assertTrue(layouts.isEmpty())
    }

    @Test fun `a DEV word grows its chip instead of shrinking or clipping`() {
        compose.setContent {
            CompositionLocalProvider(
                LocalCircleTextLayouts provides { receipt -> layouts[receipt.text] = receipt.layout },
                LocalCircleActionHostCost provides CircleActionHostCost.WORN,
            ) {
                CircleValueDisc("AUTO", "responsive layout", "AUTO SIZE", {}, valueRole = CircleTextRole.NAME)
            }
        }
        compose.waitForIdle()
        val layout = layouts.getValue("AUTO")
        assertEquals(9.5f, layout.layoutInput.style.fontSize.value)
        assertTrue("AUTO needs a wider chip: ${layout.getLineRight(0)}/${layout.layoutInput.constraints.maxWidth}",
            layout.getLineRight(0) <= layout.layoutInput.constraints.maxWidth)
    }

    private fun spec(value: String, unit: String?) = CircleDiscArtworkSpec(
        primaryValue = value, unit = unit, primaryColor = Color.White, contour = Color.Gray)
}

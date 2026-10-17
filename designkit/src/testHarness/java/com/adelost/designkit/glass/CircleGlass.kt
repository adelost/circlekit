package com.adelost.designkit.glass

import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.View
import androidx.activity.ComponentActivity
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.junit4.AndroidComposeTestRule
import com.adelost.designkit.ui.CircleAccent
import com.adelost.designkit.ui.CircleAccentPalette
import com.adelost.designkit.ui.CircleTones
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * WHICH COLOUR A SURFACE PAINTS, READ OFF THE GLASS.
 *
 * Style C's carriers (2026-10-17) are rules about where a colour sits: the icon in its kind, a state on the value,
 * off in grey. A case that hands a renderer a colour and reads it back stays green while the glass shows another, so
 * this counts the content view's pixels, drawn the way [com.adelost.designkit.press.CirclePressProbe] draws a press.
 * Mount the surface under [CircleGlassPalette.palette] and every count names one role.
 */
class CircleGlass(private val compose: AndroidComposeTestRule<*, ComponentActivity>) {

    /**
     * The pixels within [within] of [color] on every channel: a stroke's or a glyph's core, never a blend at its edge.
     * A grey needs 0: text's anti-aliased edge runs from its grey to black and passes near every darker grey.
     * [inside] limits the count to one node's bounds, for a colour another part of the surface also wears.
     */
    fun count(color: Color, within: Int = NEAR, inside: SemanticsNodeInteraction? = null): Int {
        compose.waitForIdle()
        val view = compose.activity.findViewById<View>(android.R.id.content)
        val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
        view.draw(Canvas(bitmap))
        val box = inside?.fetchSemanticsNode()?.boundsInRoot
        val left = box?.left?.roundToInt()?.coerceAtLeast(0) ?: 0
        val top = box?.top?.roundToInt()?.coerceAtLeast(0) ?: 0
        val right = box?.right?.roundToInt()?.coerceAtMost(bitmap.width) ?: bitmap.width
        val bottom = box?.bottom?.roundToInt()?.coerceAtMost(bitmap.height) ?: bitmap.height
        if (right <= left || bottom <= top) return 0
        val pixels = IntArray((right - left) * (bottom - top))
        bitmap.getPixels(pixels, 0, right - left, left, top, right - left, bottom - top)
        val target = color.toArgb()
        return pixels.count { pixel -> CHANNELS.all { abs((pixel shr it and 0xFF) - (target shr it and 0xFF)) <= within } }
    }

    private companion object {
        val CHANNELS = intArrayOf(16, 8, 0)
        const val NEAR = 6
    }
}

/**
 * Tones unlike each other and unlike the kit's: every kind wears [kind], and the scale's three steps each have their
 * own colour. No blend of two of them lands within [CircleGlass]'s reach of a third.
 */
object CircleGlassPalette {
    val kind = CircleTones(
        strong = Color(0xFF2050F0), dim = Color(0xFFA0A020), ground = Color(0xFF402010), edge = Color(0xFF20C040),
    )
    val ok = Color(0xFFF020D0)
    val caution = Color(0xFF20E0E0)
    val danger = Color(0xFFF08020)

    val palette = CircleAccentPalette(
        CircleAccent.entries.associateWith { kind } + mapOf(
            CircleAccent.POSITIVE to step(ok),
            CircleAccent.CAUTION to step(caution),
            CircleAccent.DANGER to step(danger),
        ),
    )

    private fun step(strong: Color) = CircleTones(strong = strong, dim = strong, ground = strong, edge = strong)
}

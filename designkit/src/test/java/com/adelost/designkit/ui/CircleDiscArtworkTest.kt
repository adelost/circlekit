package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CircleDiscArtworkTest {
    private val budget = CircleDiscTextBudget(maximumPrimarySp = 20f, minimumPrimarySp = 10f)

    @Test
    fun `pressure readings keep the role and unit sizes regardless of commas`() {
        val plain = fitCircleDiscText("1008.1", "hPa", 75f, budget, ::measuredWidth)
        val comma = fitCircleDiscText("1,008.1", "hPa", 75f, budget, ::measuredWidth)

        assertTrue(plain.fits)
        assertTrue(comma.fits)
        assertEquals(CircleTextRole.NUMBER.watch.sp, plain.primarySp, 0f)
        assertEquals(plain.primarySp, comma.primarySp, 0f)
        assertEquals(CircleTextRole.NUMBER.watch.unitSp, comma.unitSp, 0f)
    }

    @Test
    fun `a wide reading reports its shortage without reducing its role size`() {
        val narrow = fitCircleDiscText("111111", null, 30f, budget, ::measuredWidth)
        val wide = fitCircleDiscText("000000", null, 30f, budget, ::measuredWidth)

        assertTrue(narrow.fits)
        assertFalse(wide.fits)
        assertEquals(CircleTextRole.NUMBER.watch.sp, narrow.primarySp, 0f)
        assertEquals(narrow.primarySp, wide.primarySp, 0f)
        assertFalse(narrow.measuredWidthPx == wide.measuredWidthPx)
    }

    @Test
    fun `zero width renders no disc content without measuring text`() {
        var measured = false

        val fit = fitCircleDiscTextForBounds(
            primaryValue = "1008.1",
            unit = "hPa",
            containerWidthPx = 0f,
            containerHeightPx = 40f,
            budget = budget,
            measureWidthPx = { _, _ ->
                measured = true
                error("zero-width disc must not ask the fitter to measure")
            },
        )

        assertEquals(null, fit)
        assertFalse(measured)
    }

    private fun measuredWidth(text: String, sizeSp: Float): Float = text.sumOf { glyph ->
        when (glyph) {
            '1' -> 0.35
            ',', '.' -> 0.22
            ' ' -> 0.25
            else -> 0.58
        }
    }.toFloat() * sizeSp
}

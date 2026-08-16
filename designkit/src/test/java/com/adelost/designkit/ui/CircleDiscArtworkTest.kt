package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CircleDiscArtworkTest {
    private val budget = CircleDiscTextBudget(maximumPrimarySp = 20f, minimumPrimarySp = 10f)

    @Test
    fun `pressure value and comma fit from measured glyph widths`() {
        val plain = fitCircleDiscText("1008.1", "hPa", 75f, budget, ::measuredWidth)
        val comma = fitCircleDiscText("1,008.1", "hPa", 75f, budget, ::measuredWidth)

        assertTrue(plain.fits)
        assertTrue(comma.fits)
        assertTrue(comma.primarySp < plain.primarySp)
    }

    @Test
    fun `equal length values can choose different sizes`() {
        val narrow = fitCircleDiscText("111111", null, 60f, budget, ::measuredWidth)
        val wide = fitCircleDiscText("000000", null, 60f, budget, ::measuredWidth)

        assertEquals(narrow.primarySp, budget.maximumPrimarySp, 0f)
        assertTrue(wide.primarySp < narrow.primarySp)
        assertFalse(narrow.measuredWidthPx == wide.measuredWidthPx)
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

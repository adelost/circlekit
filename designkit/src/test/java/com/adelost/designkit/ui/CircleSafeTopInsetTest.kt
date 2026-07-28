package com.adelost.designkit.ui



import org.junit.Assert.assertEquals
import org.junit.Test

class CircleSafeTopInsetTest {

    @Test
    fun `Given a full-width row on the phone frame Then it starts deep enough to clear the arc`() {
        // Phone WatchFrame: 393 dp circle, rows 26 dp inset each side.
        // d = (393 - sqrt(393^2 - 341^2)) / 2 — the depth where the row's
        // top corners touch the circle.
        val inset = circleSafeTopInsetDp(diameterDp = 393f, contentWidthDp = 341f)
        assertEquals(98.8f, inset, 0.5f)
    }

    @Test
    fun `Given the watch frame Then the inset stays close to the tuned layout`() {
        // 227 dp watch face, same 26 dp row insets: the safe depth is ~41 dp,
        // only a few dp below where the rows already sat — the watch look
        // barely moves while the phone stops clipping.
        val inset = circleSafeTopInsetDp(diameterDp = 227f, contentWidthDp = 175f)
        assertEquals(41.2f, inset, 0.5f)
    }

    @Test
    fun `Given narrow content Then the inset shrinks toward zero`() {
        val narrow = circleSafeTopInsetDp(diameterDp = 227f, contentWidthDp = 40f)
        val wide = circleSafeTopInsetDp(diameterDp = 227f, contentWidthDp = 175f)
        assert(narrow < wide)
        assert(narrow < 2f)
    }

    @Test
    fun `Given content wider than the frame Then the centre line is the only fit`() {
        assertEquals(113.5f, circleSafeTopInsetDp(diameterDp = 227f, contentWidthDp = 300f), 0.001f)
    }

    @Test
    fun `Given degenerate inputs Then the inset is zero`() {
        assertEquals(0f, circleSafeTopInsetDp(diameterDp = 0f, contentWidthDp = 100f), 0.001f)
        assertEquals(0f, circleSafeTopInsetDp(diameterDp = 227f, contentWidthDp = 0f), 0.001f)
    }
}

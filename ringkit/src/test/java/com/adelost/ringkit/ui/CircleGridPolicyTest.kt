package com.adelost.ringkit.ui

import androidx.compose.ui.unit.dp
import com.adelost.designkit.ui.MenuGridSpec
import org.junit.Assert.assertEquals
import org.junit.Test

class CircleGridPolicyTest {

    @Test
    fun `grid consumes declared width instead of inferring host from nullable cap`() {
        val roundLike = spec(widthFraction = 0.73f, contentMaxWidthDp = null)
        val capped = spec(widthFraction = 0.82f, contentMaxWidthDp = 360f)

        assertEquals(0.73f, resolvedCircleGridWidthFraction(roundLike), 0.001f)
        assertEquals(0.82f, resolvedCircleGridWidthFraction(capped), 0.001f)
    }

    private fun spec(
        widthFraction: Float,
        contentMaxWidthDp: Float?,
    ) = MenuGridSpec(
        columns = 3,
        diameter = 30.dp,
        horizontalGap = 4.dp,
        verticalGap = 4.dp,
        contentWidthFraction = widthFraction,
        contentMaxWidth = contentMaxWidthDp?.dp,
    )
}

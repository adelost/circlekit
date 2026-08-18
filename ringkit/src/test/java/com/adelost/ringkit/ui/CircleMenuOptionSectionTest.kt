package com.adelost.ringkit.ui

import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Test

class CircleMenuOptionSectionTest {
    private val icon = ImageVector.Builder(
        defaultWidth = 1.dp, defaultHeight = 1.dp,
        viewportWidth = 1f, viewportHeight = 1f,
    ).build()

    private fun option(label: String) = EdgeMenuOption(
        key = label.lowercase(),
        label = label,
        icon = icon,
        onTap = {},
    )

    @Test
    fun `a section never restates what its only option already says`() {
        // The defect: VIEW / [disc] / VIEW stacked on the phone JUMP DETAILS.
        assertEquals(
            true,
            sectionHeaderEchoesOnlyOption(EdgeMenuSection("VIEW", listOf(option("VIEW")))),
        )
    }

    @Test
    fun `a real group keeps its header`() {
        assertEquals(
            false,
            sectionHeaderEchoesOnlyOption(
                EdgeMenuSection("VIEW", listOf(option("MAP"), option("DETAILS"))),
            ),
        )
        assertEquals(
            false,
            sectionHeaderEchoesOnlyOption(EdgeMenuSection("SCENE", listOf(option("VIEW")))),
        )
    }
}

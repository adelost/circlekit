package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PhoneSurfaceDesignTest {
    @Test
    fun `phone profiles keep readable type and touch floors`() {
        listOf(
            requireNotNull(phoneSurfaceDesignFor(SkyvwSurfaceClass.PHONE_COMPACT)),
            requireNotNull(phoneSurfaceDesignFor(SkyvwSurfaceClass.PHONE_WIDE)),
        ).forEach { design ->
            assertTrue(design.actionDiameter.value >= 56f)
            assertTrue(design.actionIconSize.value >= 24f)
            assertTrue(design.actionLabelSize.value >= 12f)
            assertTrue(design.actionSupportingSize.value >= 10f)
            assertTrue(design.pillMinHeight.value >= 48f)
            assertTrue(design.pillLabelSize.value >= 12f)
            assertTrue(design.rowTitleSize.value >= 16f)
            assertTrue(design.rowSubtitleSize.value >= 12f)
            assertTrue(design.headerSubtitleSize.value >= 11f)
            assertTrue(design.metadataSize.value >= 10f)
            assertTrue(design.rowIconDiameter.value + design.rowPaddingVertical.value * 2f >= 56f)
        }
    }

    @Test
    fun `round profile cannot consume phone design`() {
        assertNull(phoneSurfaceDesignFor(SkyvwSurfaceClass.ROUND))
    }

    @Test
    fun `orientation changes grid capacity without resizing physical atoms`() {
        val compact = PhoneSurfaceDesignCatalog.Compact
        val wide = PhoneSurfaceDesignCatalog.Wide

        assertEquals(3, compact.hubGrid.columns)
        assertEquals(6, wide.hubGrid.columns)
        assertEquals(64f, compact.hubGrid.diameter.value)
        assertEquals(3, compact.launcherGrid.columns)
        assertEquals(4, wide.launcherGrid.columns)
        assertEquals(compact.actionDiameter, compact.launcherGrid.diameter)
        assertEquals(56f, compact.actionDiameter.value)
        assertTrue(wide.hubGrid.columns > compact.hubGrid.columns)
        assertTrue(wide.launcherGrid.columns > compact.launcherGrid.columns)
        assertEquals(compact.hubGrid.diameter, wide.hubGrid.diameter)
        assertEquals(compact.launcherGrid.diameter, wide.launcherGrid.diameter)
        assertEquals(compact.actionDiameter, wide.actionDiameter)
        listOf(compact, wide).forEach { design ->
            assertEquals(
                MenuDesign.centeredGridWidthFraction,
                design.hubGrid.contentWidthFraction,
                0.001f,
            )
            assertEquals(
                MenuDesign.centeredGridWidthFraction,
                design.launcherGrid.contentWidthFraction,
                0.001f,
            )
        }
    }
}

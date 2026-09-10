package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test

/** The data-driven icon contract: the gallery renders RING_ICON_CATALOG. */
class IconCatalogTest {

    @Test
    fun `outline set mirrors the filled catalog name for name`() {
        assertEquals(
            RING_ICON_CATALOG.map { requireNotNull(it.name) }.sorted(),
            RING_ICON_OUTLINE_BY_NAME.keys.sorted(),
        )
    }

    @Test
    fun `catalog names are unique`() {
        val names = RING_ICON_CATALOG.map { it.name }
        assertEquals(names.size, names.toSet().size)
    }

    @Test
    fun `clown provenance marker stays present in both styles`() {
        assertSame(RingIcons.Clown, RING_ICON_OUTLINE_BY_NAME["clown"])
    }

    @Test
    fun `battery levels share the public gallery and both styles`() {
        val levels = listOf(RingIcons.BatteryEmpty, RingIcons.BatteryQuarter,
            RingIcons.BatteryHalf, RingIcons.BatteryThreeQuarters, RingIcons.BatteryFull)
        levels.forEach { level ->
            assertSame(level, RING_ICON_CATALOG.single { it.name == level.name })
            assertSame(level, RING_ICON_OUTLINE_BY_NAME[level.name])
        }
        assertEquals(5, levels.map { it.name }.toSet().size)
    }

    @Test
    fun `activity pictograms are distinct shared assets in both styles`() {
        val icons = listOf(RingIcons.Tag, RingIcons.RamAir, RingIcons.CanopyCarry,
            RingIcons.Tandem, RingIcons.Wingsuit, RingIcons.Tracking, RingIcons.CanopySwoop,
            RingIcons.Formation, RingIcons.Camera, RingIcons.Balloon, RingIcons.Helicopter)
        icons.forEach { icon ->
            assertSame(icon, RING_ICON_CATALOG.single { it.name == icon.name })
            assertSame(icon, RING_ICON_OUTLINE_BY_NAME[icon.name])
        }
        assertEquals(icons.size, icons.map { it.name }.toSet().size)
    }
}

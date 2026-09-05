package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class MenuGridSpecTest {

    @Test
    fun `round is density-invariant for both roles`() {
        MenuGridRole.entries.forEach { role ->
            assertEquals(
                menuGridSpec(CircleSurfaceClass.ROUND, CircleMenuDensity.REGULAR, role),
                menuGridSpec(CircleSurfaceClass.ROUND, CircleMenuDensity.COMPACT, role),
            )
        }
    }

    @Test
    fun `every round menu grid is the same readable two-up layout item`() {
        val logbook = menuGridSpec(CircleSurfaceClass.ROUND, CircleMenuDensity.REGULAR, MenuGridRole.LOGBOOK)
        assertEquals(2, logbook.columns)
        assertEquals(0.75f, logbook.contentWidthFraction, 0.001f)
        // The one watch action-ring standard: the home rim buttons' 30 dp.
        assertEquals(MenuDesign.watchActionRingDiameter, logbook.diameter)
        assertEquals(8f, logbook.labelSize.value)
        // SETTINGS is not a second composition: same columns, same ring, same
        // gaps. A watch screen shows one rhythm, never two.
        MenuGridRole.entries.forEach { role ->
            assertEquals(role.name, logbook, menuGridSpec(CircleSurfaceClass.ROUND, CircleMenuDensity.REGULAR, role))
        }
    }

    @Test
    fun `the strict centred round cell never squeezes the ring`() {
        // The explicit 75% role policy reserves 12.5% per side.
        // Equal-width cells must still keep the canonical 30 dp ring intact.
        val spec = MenuGridCatalog.RoundPair
        val contentWidthDp = 192f * spec.contentWidthFraction
        val worstCellDp =
            (contentWidthDp - (spec.columns - 1) * spec.horizontalGap.value) / spec.columns
        assertTrue(
            "strict cell ${worstCellDp}dp narrower than ring ${spec.diameter}",
            worstCellDp >= spec.diameter.value,
        )
    }

    @Test
    fun `every menu role reserves twelve point five percent per side on every host`() {
        CircleSurfaceClass.entries.forEach { surface ->
            CircleMenuDensity.entries.forEach { density ->
                MenuGridRole.entries.forEach { role ->
                    val spec = menuGridSpec(surface, density, role)
                    assertEquals(
                        "$surface/$density/$role width",
                        MenuDesign.centeredGridWidthFraction,
                        spec.contentWidthFraction,
                        0.001f,
                    )
                    assertEquals(
                        "$surface/$density/$role side margin",
                        0.125f,
                        (1f - spec.contentWidthFraction) / 2f,
                        0.001f,
                    )
                }
            }
        }
    }

    @Test
    fun `phone menu atoms fit the centred content column`() {
        val compactPortraitContentDp = 328f
        val wideContentDp = mapOf(
            CircleMenuDensity.REGULAR to 528f,
            CircleMenuDensity.COMPACT to 608f,
        )

        CircleMenuDensity.entries.forEach { density ->
            assertGridAtomsFit(
                menuGridSpec(CircleSurfaceClass.PHONE_COMPACT, density, MenuGridRole.SETTINGS),
                compactPortraitContentDp,
            )
            assertGridAtomsFit(
                menuGridSpec(CircleSurfaceClass.PHONE_WIDE, density, MenuGridRole.SETTINGS),
                requireNotNull(wideContentDp[density]),
            )
        }
    }

    @Test
    fun `compact phone menu keeps labels readable inside its tighter cells`() {
        assertEquals(8.5f, MenuGridCatalog.PhoneCompact.labelSize.value, 0.001f)
        assertEquals(
            MenuGridCatalog.PhoneCompact.labelSize,
            MenuGridCatalog.WideCompact.labelSize,
        )
    }

    @Test
    fun `menu width policy refuses impossible fractions`() {
        listOf(0f, -0.1f, 1.1f).forEach { fraction ->
            assertThrows(IllegalArgumentException::class.java) {
                MenuGridCatalog.RoundPair.copy(contentWidthFraction = fraction)
            }
        }
    }

    @Test
    fun `compact adds a column but never resizes the ring atom`() {
        listOf(CircleSurfaceClass.PHONE_COMPACT, CircleSurfaceClass.PHONE_WIDE).forEach { surface ->
            MenuGridRole.entries.forEach { role ->
                val regular = menuGridSpec(surface, CircleMenuDensity.REGULAR, role)
                val compact = menuGridSpec(surface, CircleMenuDensity.COMPACT, role)
                assertTrue("$surface/$role columns", compact.columns > regular.columns)
                // One ring size on every rectangular surface — the start
                // screen's 56 dp action is the standard (Mattias 2026-07-21).
                assertEquals("$surface/$role diameter", regular.diameter, compact.diameter)
                assertEquals("$surface/$role diameter", 56f, regular.diameter.value)
            }
        }
    }

    @Test
    fun `wide grows capacity and width but never atom size`() {
        CircleMenuDensity.entries.forEach { density ->
            MenuGridRole.entries.forEach { role ->
                val phone = menuGridSpec(CircleSurfaceClass.PHONE_COMPACT, density, role)
                val wide = menuGridSpec(CircleSurfaceClass.PHONE_WIDE, density, role)
                assertEquals("$density/$role diameter", phone.diameter, wide.diameter)
                assertTrue("$density/$role columns", wide.columns > phone.columns)
                assertTrue(
                    "$density/$role maxWidth",
                    requireNotNull(wide.contentMaxWidth) > requireNotNull(phone.contentMaxWidth),
                )
            }
        }
    }

    @Test
    fun `content width is capped exactly on rectangular hosts`() {
        CircleSurfaceClass.entries.forEach { surface ->
            CircleMenuDensity.entries.forEach { density ->
                MenuGridRole.entries.forEach { role ->
                    val spec = menuGridSpec(surface, density, role)
                    if (surface == CircleSurfaceClass.ROUND) {
                        assertNull(spec.contentMaxWidth)
                    } else {
                        assertNotNull(spec.contentMaxWidth)
                    }
                }
            }
        }
    }

    private fun assertGridAtomsFit(spec: MenuGridSpec, availableWidthDp: Float) {
        val gridWidthDp = availableWidthDp * spec.contentWidthFraction
        val cellWidthDp =
            (gridWidthDp - (spec.columns - 1) * spec.horizontalGap.value) / spec.columns
        assertTrue(
            "${spec.columns}-column cell ${cellWidthDp}dp narrower than ${spec.diameter}",
            cellWidthDp >= spec.diameter.value,
        )
    }
}

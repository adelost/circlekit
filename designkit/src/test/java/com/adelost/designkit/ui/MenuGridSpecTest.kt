package com.adelost.designkit.ui

import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
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
        assertEquals(136.dp, logbook.contentMaxWidth)
        // The one watch action-ring standard: the home rim buttons' 30 dp.
        assertEquals(MenuDesign.watchActionRingDiameter, logbook.diameter)
        // Labels now resolve through CircleTextRole.LABEL, never through grid geometry.
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
    fun `watch and compact grids keep their margins while regular phone grids lend text the full width`() {
        CircleSurfaceClass.entries.forEach { surface ->
            CircleMenuDensity.entries.forEach { density ->
                MenuGridRole.entries.forEach { role ->
                    val spec = menuGridSpec(surface, density, role)
                    // Style C text brief, decision 3: phone cells widen for the phone roles.
                    val expected = if (surface != CircleSurfaceClass.ROUND && density == CircleMenuDensity.REGULAR)
                        1f else MenuDesign.centeredGridWidthFraction
                    assertEquals(
                        "$surface/$density/$role width",
                        expected,
                        spec.contentWidthFraction,
                        0.001f,
                    )
                    assertEquals(
                        "$surface/$density/$role side margin",
                        (1f - expected) / 2f,
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
    fun `every menu host declares an exact content cap`() {
        CircleSurfaceClass.entries.forEach { surface ->
            CircleMenuDensity.entries.forEach { density ->
                MenuGridRole.entries.forEach { role ->
                    val spec = menuGridSpec(surface, density, role)
                    assertNotNull(spec.contentMaxWidth)
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

package com.adelost.designkit.ui

import org.junit.Assert.assertEquals
import org.junit.Test

/** The data-driven icon contract: the gallery renders RING_ICON_CATALOG, the
 * accent map colours it, and this test refuses any drift between the two.
 * Adding an icon means one catalog row AND one accent registration — or red. */
class IconCatalogTest {

    @Test
    fun `every cataloged icon has exactly one accent registration`() {
        assertEquals(
            ICON_ACCENTS.keys.sorted(),
            RING_ICON_CATALOG.map { requireNotNull(it.name) }.sorted(),
        )
    }

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
}

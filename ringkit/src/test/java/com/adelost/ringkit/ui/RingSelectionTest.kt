package com.adelost.ringkit.ui

import com.adelost.designkit.ui.RingIcons
import org.junit.Assert.*
import org.junit.Test

class RingSelectionTest {
    @Test fun identicalNamesSelectTheExactIdAndUnavailableEntriesHaveNoAction() {
        var selected = ""
        val options = listOf(
            RingSelectionOption("a", "Same name", "A long readable description"),
            RingSelectionOption("b", "Same name"),
            RingSelectionOption("c", "Unavailable", enabled = false),
        )
        val rows = ringSelectionRows(options, "a", RingIcons.Target) { selected = it }
        rows[1].onTap!!.invoke()
        assertEquals("b", selected)
        assertEquals("Selected · A long readable description", rows[0].sub)
        assertTrue(rows.all { it.multiline })
        assertNull(rows[2].onTap)
    }
}

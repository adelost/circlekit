package com.adelost.ringkit.ui

import com.adelost.designkit.ui.CircleAccent
import com.adelost.designkit.ui.RingIcons
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

/** Skyvw row 163: the phone drew a Detail's actions as bare words; watch and phone now draw these rows. */
class DetailActionRowsTest {
    private val restore = ActionSpec("RESTORE", RingIcons.Refresh, onRun = {})
    private val zero = ActionSpec("ZERO ALT", RingIcons.Mountain, onRun = {}, holdToConfirm = true, destructive = true)

    @Test
    fun `every declared action is a row with its own icon, and a destructive one is a red hold`() {
        val rows = detailActionRows(listOf(restore, zero), onRefresh = null, refreshEnabled = true)

        assertEquals(listOf("RESTORE", "ZERO ALT"), rows.map { it.title })
        assertEquals(listOf(RingIcons.Refresh, RingIcons.Mountain), rows.map { it.icon })
        assertEquals(listOf(false, true), rows.map { it.holdToConfirm })
        assertEquals(CircleAccent.DANGER, rows.last().accent)
    }

    @Test
    fun `refresh is the last row and cannot be pressed while its fetch runs`() {
        val idle = detailActionRows(listOf(restore), onRefresh = {}, refreshEnabled = true)
        val fetching = detailActionRows(listOf(restore), onRefresh = {}, refreshEnabled = false)

        assertEquals(listOf("RESTORE", "REFRESH"), idle.map { it.title })
        assertEquals(RingIcons.Refresh, idle.last().icon)
        assertNotNull(idle.last().onTap)
        assertNull(fetching.last().onTap)
    }
}

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
    fun `an action that cannot run now shows why and cannot be pressed, and a hold that cannot run is not a hold`() {
        val rows = detailActionRows(listOf(restore, zero), onRefresh = null, refreshEnabled = true,
            unavailableReasons = listOf("NO EARLIER ZERO", "SIMULATOR LOCK"))

        assertEquals(listOf("NO EARLIER ZERO", "SIMULATOR LOCK"), rows.map { it.sub })
        assertEquals(listOf(null, null), rows.map { it.onTap })
        assertEquals(listOf(false, false), rows.map { it.holdToConfirm })
        assertEquals(listOf("", ""), detailActionRows(listOf(restore, zero), null, true).map { it.sub })
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

package com.adelost.ringkit.ui

import com.adelost.designkit.ui.CircleAccent
import com.adelost.designkit.ui.CircleAccentStrength
import com.adelost.designkit.ui.RingIcons
import com.adelost.designkit.ui.RingTokens
import com.adelost.designkit.ui.circleAccentColor
import org.junit.Assert.assertEquals
import org.junit.Test

class RingMessageLayoutTest {
    @Test fun anUnaccentedMessageKeepsTodaysLook() {
        assertEquals(RingMessageLayout(RingTokens.Dim, null, 0), ringMessageLayout(RingMessageSpec("YOU", "Hej"), round = false))
    }

    @Test fun aSenderAccentColoursTheLabelAndEdgeButNeverTheBody() {
        val layout = ringMessageLayout(RingMessageSpec("claw:1", "Svar", accent = CircleAccent.SKY), round = false)
        assertEquals(circleAccentColor(CircleAccent.SKY, CircleAccentStrength.ACTIVE), layout.authorColor)
        assertEquals(circleAccentColor(CircleAccent.SKY, CircleAccentStrength.SUPPORTING), layout.edgeColor)
    }

    @Test fun theReadersOwnWordsSitInsetSoRolesSurviveGreyscale() {
        assertEquals(48, ringMessageLayout(RingMessageSpec("YOU", "Hej", side = RingMessageSide.END), round = false).startInsetDp)
        assertEquals(16, ringMessageLayout(RingMessageSpec("YOU", "Hej", side = RingMessageSide.END), round = true).startInsetDp)
    }

    @Test fun anOptionAccentNamesItsRowWhileTheSelectedCheckStays() {
        val rows = ringSelectionRows(
            listOf(RingSelectionOption("claw:1", "claw:1", accent = CircleAccent.VIOLET), RingSelectionOption("lsrc:3", "lsrc:3")),
            "claw:1", RingIcons.Target,
        ) {}
        assertEquals(CircleAccent.VIOLET to RingIcons.Check, rows[0].accent to rows[0].icon)
    }
}

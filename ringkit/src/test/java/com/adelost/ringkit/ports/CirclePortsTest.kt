package com.adelost.ringkit.ports

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CirclePortsTest {
    private fun port(
        id: String,
        role: CirclePortRole = CirclePortRole.DATA,
        quality: CirclePortQuality = CirclePortQuality.LIVE,
        required: Boolean = false,
        value: String? = null,
        ageMs: Long? = null,
    ) = CirclePortInspection(id, id.substringBeforeLast('.'), role, "c", "OUTPUT", "PRESENTATION", required, quality, value, ageMs)

    @Test fun aDeclaredPortLandsInTheGroupNamedByItsDeclaration() {
        val groups = circlePortGroups(listOf(port("wake.service.status"), port("conversation.service.status"), port("wake.presentation.model")))
        assertEquals(listOf("Conversation" to 1, "Wake" to 2), groups.map { it.title to it.ports.size })
        assertEquals("Status", port("wake.service.status").shortName())
    }

    @Test fun aCommandNeverSentIsIdleNotUnavailable() {
        val command = port("capture.talk.command", role = CirclePortRole.COMMAND, quality = CirclePortQuality.UNAVAILABLE)
        assertEquals(CirclePortStatus.IDLE, command.status())
        assertEquals("not fired yet", circlePortPreview(command))
        assertFalse(command.needsAttention())
    }

    @Test fun anUnboundPortIsBrokenNeedsAttentionAndPullsItsGroupToTheTop() {
        val unbound = port("zeta.service.status", quality = CirclePortQuality.UNBOUND)
        assertTrue(unbound.needsAttention())
        assertEquals("Zeta", circlePortGroups(listOf(port("alpha.service.status"), unbound)).first().title)
    }

    @Test fun oldDataIsMutedAndOnlyNeedsAttentionWhenSomethingRequiresIt() {
        assertFalse(port("a.b.c", quality = CirclePortQuality.STALE).needsAttention())
        assertTrue(port("a.b.c", quality = CirclePortQuality.STALE, required = true).needsAttention())
    }

    @Test fun theSummaryCountsEveryStatusAPersonReads() {
        val ports = listOf(port("a.b.c"), port("a.b.d"), port("a.b.e", quality = CirclePortQuality.STALE),
            port("a.b.f", role = CirclePortRole.COMMAND, quality = CirclePortQuality.UNAVAILABLE), port("a.b.g", quality = CirclePortQuality.UNBOUND))
        assertEquals("2 LIVE · 1 STALE · 1 IDLE · 1 BROKEN", circlePortSummary(ports))
    }

    @Test fun aSnapshotValueReadsFieldByFieldWithItsAge() {
        val status = port("wake.service.status", value = "LinkWakePresentation(phase=LISTENING, detail=null, detections=3)", ageMs = 30_000)
        assertEquals("LISTENING · 30 s", circlePortPreview(status))
        assertEquals(listOf("Phase" to "LISTENING", "Detail" to "null", "Detections" to "3"), circlePortValueFields(status.value!!))
    }
}

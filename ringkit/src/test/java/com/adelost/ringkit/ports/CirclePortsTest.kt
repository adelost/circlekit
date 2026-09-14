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
        bindings: Set<String> = emptySet(),
    ) = CirclePortInspection(id, id.substringBeforeLast('.'), role, "c", "OUTPUT", "PRESENTATION", required, quality, value, ageMs,
        bindings = bindings)

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

    @Test fun twoPortsWithTheSameShortNameInOneGroupStayTellable() {
        val names = circlePortNames(listOf(port("capture.talk.command"), port("capture.service.command"),
            port("capture.service.status"), port("wake.service.command")))
        assertEquals(mapOf("capture.talk.command" to "Talk command", "capture.service.command" to "Service command",
            "capture.service.status" to "Status", "wake.service.command" to "Command"), names)
    }

    // skyvw:0 2026-09-14: 174 of Skyvw's 478 ports landed in one "UI" group, because every projection is declared under ui.projection.*.
    @Test fun aProjectionJoinsTheGroupOfTheComponentItFeeds() {
        val ports = listOf(
            port("ui.projection.home-dial.altimeter", bindings = setOf("NODE_INPUT:flight.service.altimeter->ui.projection.home-dial.altimeter")),
            port("ui.projection.home-dial.model", bindings = setOf("COMPONENT_INPUT:ui.projection.home-dial.model->instrument.altitude-dial.model")),
            port("instrument.altitude-dial.model", bindings = setOf("COMPONENT_INPUT:ui.projection.home-dial.model->instrument.altitude-dial.model")),
            port("flight.service.altimeter", bindings = setOf("NODE_INPUT:flight.service.altimeter->ui.projection.home-dial.altimeter",
                "COMPONENT_INPUT:flight.service.altimeter->map.surface.altimeter")),
            port("ui.surface-interaction.open", bindings = setOf("COMPONENT_EVENT:instrument.altitude-dial.open->ui.surface-interaction.open",
                "COMPONENT_EVENT:map.surface.open->ui.surface-interaction.open")),
        )
        assertEquals(listOf("Flight" to 1, "Instrument" to 3, "Ui" to 1), circlePortGroups(ports).map { it.title to it.ports.size })
    }

    // skyvw:0 2026-09-14: "Availability state presentation adapter presentation" was cut off on the round watch.
    @Test fun aSharedNameGainsOnlyTheOwnerWordThatTellsItApart() {
        val names = circlePortNames(listOf(
            port("position.availability-state.presentation-adapter.presentation"),
            port("position.home-guidance.presentation"),
            port("position.home-guidance.home"),
            port("position.flight-context.home"),
            port("position.service.fix"),
        ))
        assertEquals(listOf("Availability state presentation", "Home guidance presentation", "Home guidance home", "Flight context home", "Fix"),
            names.values.toList())
    }

    // skyvw:0 2026-09-14: a row previewed a whole nested record, "PositionObservation(timeEpochMs=1789411102967, elaps...".
    @Test fun aPreviewShowsTheFirstPlainFieldNotATimestampOrANestedRecord() {
        val fix = port("position.service.fix", ageMs = 38_000,
            value = "PositionObservation(timeEpochMs=1789411102967, elapsedRealtimeNanos=99, latitude=55.6, longitude=13.1)")
        assertEquals("55.6 · 38 s", circlePortPreview(fix))
        val flight = port("position.flight-context.state", ageMs = 6_000,
            value = "PositionFlightFix(observation=PositionObservation(timeEpochMs=1, latitude=55.6), phase=FREEFALL)")
        assertEquals("FREEFALL · 6 s", circlePortPreview(flight))
        val nestedOnly = port("position.home-guidance.presentation", ageMs = 6_000,
            value = "PositionPresentation(observation=PositionObservation(timeEpochMs=1, latitude=55.6))")
        assertEquals("55.6 · 6 s", circlePortPreview(nestedOnly))
    }
}

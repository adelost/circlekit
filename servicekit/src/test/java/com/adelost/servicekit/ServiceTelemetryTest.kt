package com.adelost.servicekit

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ServiceTelemetryTest {
    private val clock = FakeClock()

    @Test
    fun `operation and transfer stay separate while success and byte totals remain honest`() {
        val telemetry = ServiceTelemetry(clock)
        val id = ServiceId("weather")

        val operation = telemetry.beginOperation(id)
        assertEquals(1, telemetry.snapshots.value.getValue(id).activeOperations)
        clock.advance(120)
        val transfer = telemetry.beginTransfer(id)
        assertEquals(1, telemetry.snapshots.value.getValue(id).activeTransfers)
        transfer.http(200)
        transfer.downloaded(1_024)
        clock.advance(30)
        transfer.success()
        clock.advance(50)
        operation.success()

        val snapshot = telemetry.snapshots.value.getValue(id)
        assertEquals(200L, snapshot.lastAttempt?.durationMs)
        assertEquals(30L, snapshot.lastTransfer?.durationMs)
        assertEquals(1_024L, snapshot.lastTransfer?.downloadedBytes)
        assertEquals(1_024L, snapshot.totalDownloadedBytes)
        assertEquals(1L, snapshot.attemptCount)
        assertEquals(1L, snapshot.networkCallCount)
        assertEquals(0, snapshot.activeOperations)
        assertEquals(0, snapshot.activeTransfers)
        assertEquals(clock.wallMs(), snapshot.lastSuccessAtMs)
    }

    @Test
    fun `failure never erases the previous success and secrets are not persisted in detail`() {
        val telemetry = ServiceTelemetry(clock)
        val id = ServiceId("trackbook")
        telemetry.beginOperation(id).success()
        val successAt = telemetry.snapshots.value.getValue(id).lastSuccessAtMs

        clock.advance(10)
        telemetry.beginOperation(id).failed("GET https://secret.invalid/path?token=abc")

        val snapshot = telemetry.snapshots.value.getValue(id)
        assertEquals(successAt, snapshot.lastSuccessAtMs)
        assertEquals(ServiceOutcome.FAILED, snapshot.lastAttempt?.outcome)
        assertEquals("GET URL", snapshot.lastAttempt?.detail)
    }

    @Test
    fun `durable snapshots restore but process event history does not`() {
        val stored = MemoryStore()
        val first = ServiceTelemetry(clock)
        first.install(stored)
        first.beginTransfer(ServiceId("terrain")).apply {
            downloaded(55)
            success()
        }
        first.recordCache(ServiceId("terrain"), bytes = 4_096, itemCount = 2)

        val restored = ServiceTelemetry(clock)
        restored.install(stored)

        val snapshot = restored.snapshots.value.getValue(ServiceId("terrain"))
        assertEquals(55L, snapshot.totalDownloadedBytes)
        assertEquals(4_096L, snapshot.cache?.bytes)
        assertEquals(2, snapshot.cache?.itemCount)
        assertEquals(emptyList<ServiceEvent>(), restored.events.value)
        assertNull(restored.snapshots.value[ServiceId("unknown")])
    }

    private class FakeClock : ServiceClock {
        private var nowMs = 1_000L
        override fun wallMs(): Long = nowMs
        override fun monotonicNs(): Long = nowMs * 1_000_000L
        fun advance(ms: Long) { nowMs += ms }
    }

    private class MemoryStore : ServiceSnapshotStore {
        private var snapshots = emptyList<ServiceSnapshot>()
        override fun load(): List<ServiceSnapshot> = snapshots
        override fun save(snapshots: List<ServiceSnapshot>) { this.snapshots = snapshots }
    }
}

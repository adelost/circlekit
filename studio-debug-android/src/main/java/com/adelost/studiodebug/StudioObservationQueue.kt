package com.adelost.studiodebug

import java.util.ArrayDeque

/** Bounded producer queue. Loss is explicit so Studio never joins across dropped observations. */
internal class StudioObservationQueue(
    private val maxEvents: Int = 2048,
    private val maxBytes: Int = 1024 * 1024,
) {
    sealed interface Entry {
        val from: Int
        val to: Int
    }
    data class Event(override val from: Int, val atMs: Long, val raw: String) : Entry {
        override val to: Int get() = from
    }
    data class Loss(override val from: Int, override var to: Int, val reason: String) : Entry

    private val pending = ArrayDeque<Entry>()
    private var bytes = 0
    private var eventCount = 0
    private var sequence = 0

    @Synchronized
    fun offer(raw: String, atMs: Long) {
        val next = sequence++
        val size = raw.toByteArray(Charsets.UTF_8).size
        if (size > 4096 || size == 0) {
            loss(next, "invalid-generated-event")
        } else if (eventCount >= maxEvents || bytes + size > maxBytes) {
            loss(next, "producer-queue-full")
        } else {
            pending.addLast(Event(next, atMs, raw))
            eventCount++
            bytes += size
        }
    }

    @Synchronized
    fun take(maxEntries: Int = 32, maxBytes: Int = 32 * 1024): List<Entry> {
        val result = mutableListOf<Entry>()
        var takenBytes = 0
        while (pending.isNotEmpty() && result.size < maxEntries) {
            val next = pending.first()
            val size = if (next is Event) next.raw.toByteArray(Charsets.UTF_8).size else 0
            if (result.isNotEmpty() && takenBytes + size > maxBytes) break
            pending.removeFirst()
            if (next is Event) {
                bytes -= size
                eventCount--
            }
            result += next
            takenBytes += size
        }
        return result
    }

    @Synchronized
    fun isEmpty(): Boolean = pending.isEmpty()

    private fun loss(next: Int, reason: String) {
        val tail = pending.peekLast()
        if (tail is Loss && tail.reason == reason && tail.to + 1 == next) {
            tail.to = next
        } else {
            pending.addLast(Loss(next, next, reason))
        }
    }
}

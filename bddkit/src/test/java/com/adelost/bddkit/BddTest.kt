package com.adelost.bddkit

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class BddTest {
    @Test
    fun `given flows into when and then`() = unit("a discount on a large order") {
        given("an order worth 600") { 600 }
            .whenever("the volume discount is applied") { total -> total - total / 10 }
            .then("10 percent is taken off") { discounted, original ->
                assertEquals(540, discounted)
                assertEquals(600, original)
            }
    }

    @Test
    fun `a unit scenario past its limit fails naming the level`() {
        val failure = assertThrows(LevelExceeded::class.java) {
            unit("a unit that sleeps") {
                given("nothing") { }
                    .then("it waited too long") { Thread.sleep(400) }
            }
        }
        assertEquals(Level.UNIT, failure.level)
        assertTrue(failure.message!!, failure.message!!.contains("[UNIT] 'a unit that sleeps'"))
        assertTrue(failure.message!!, failure.message!!.contains("limit 100 ms"))
    }

    @Test
    fun `a hung scenario is interrupted instead of blocking the suite`() {
        val started = System.nanoTime()
        assertThrows(LevelExceeded::class.java) {
            unit("a unit that never returns") {
                given("a latch nobody opens") { java.util.concurrent.CountDownLatch(1) }
                    .then("it waits forever") { latch -> latch.await() }
            }
        }
        val tookMs = (System.nanoTime() - started) / 1_000_000
        assertTrue("took $tookMs ms", tookMs < 2_000)
    }

    @Test
    fun `a failure inside then names the phase and keeps the cause`() {
        val failure = assertThrows(PhaseFailure::class.java) {
            unit("a wrong expectation") {
                given("two") { 2 }
                    .then("it is three") { value -> assertEquals(3, value) }
            }
        }
        assertEquals("then", failure.phase)
        assertTrue(failure.message!!, failure.message!!.startsWith("[then] it is three:"))
        assertTrue(failure.cause is AssertionError)
    }

    @Test
    fun `a blank description is refused before the phase runs`() {
        var ran = false
        val failure = assertThrows(IllegalArgumentException::class.java) {
            unit("an undocumented step") {
                given(" ") { ran = true }
                    .then("never reached") { }
            }
        }
        assertTrue(failure.message!!, failure.message!!.contains("given phase has no description"))
        assertEquals(false, ran)
    }

    @Test
    fun `the steps a scenario ran are recorded in order`() {
        var recorded: List<String> = emptyList()
        component("a recorded scenario") {
            val proof = given("a seed") { 1 }
                .whenever("it is doubled") { it * 2 }
                .then("it is two") { doubled, _ -> assertEquals(2, doubled) }
            recorded = proof.steps
            proof
        }
        assertEquals(listOf("given: a seed", "when: it is doubled", "then: it is two"), recorded)
    }

    @Test
    fun `a slow scenario inside its limit passes`() = host("a host scenario that takes a moment", slow = true) {
        whenever("real storage is exercised") { Thread.sleep(120) }
            .then("it completes within the host budget") { _, _ -> }
    }
}

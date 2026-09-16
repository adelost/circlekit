package com.adelost.bddkit

/**
 * Scenario levels with hard time limits.
 *
 * The limit is enforced inside the scenario, not by a gate that runs later:
 * a test that outgrows its level fails where it is written, naming the level,
 * so a slow "unit" test cannot land and be found weeks later. `warnMs` only
 * prints; `limitMs` fails.
 */
enum class Level(val warnMs: Long, val limitMs: Long) {
    /** Pure logic, no I/O, no Android. */
    UNIT(warnMs = 50, limitMs = 100),

    /** One component or composable on the JVM, fakes at its edges. */
    COMPONENT(warnMs = 500, limitMs = 1_000),

    /** Real runtime code across a service or process boundary, hardware faked. */
    HOST(warnMs = 2_000, limitMs = 5_000),

    /** A whole page or scene, Robolectric or an emulator. */
    SCENE(warnMs = 60_000, limitMs = 120_000),
}

/** The proof that a scenario asserted something. Only [then] can make one. */
class Then internal constructor(val steps: List<String>)

fun unit(name: String, slow: Boolean = false, body: Scenario.() -> Then): Unit =
    runScenario(Level.UNIT, name, slow, body)

fun component(name: String, slow: Boolean = false, body: Scenario.() -> Then): Unit =
    runScenario(Level.COMPONENT, name, slow, body)

fun host(name: String, slow: Boolean = false, body: Scenario.() -> Then): Unit =
    runScenario(Level.HOST, name, slow, body)

fun scene(name: String, slow: Boolean = false, body: Scenario.() -> Then): Unit =
    runScenario(Level.SCENE, name, slow, body)

/**
 * One scenario: setup, action, assertion, each with a required description.
 *
 * `body` must return a [Then], and only `then` produces one, so a scenario
 * without an assertion does not compile. A blank description fails at once.
 */
class Scenario internal constructor(val level: Level, val name: String) {
    internal val steps = mutableListOf<String>()

    fun <G> given(description: String, setup: () -> G): Given<G> {
        val value = phase("given", description) { setup() }
        return Given(this, value)
    }

    /** A scenario that starts from the action, with no setup worth naming. */
    fun <W> whenever(description: String, act: () -> W): When<Unit, W> {
        val value = phase("when", description) { act() }
        return When(this, Unit, value)
    }

    internal fun <T> phase(phase: String, description: String, block: () -> T): T {
        require(description.isNotBlank()) { "[${level.name}] '$name': the $phase phase has no description" }
        steps += "$phase: $description"
        return try {
            block()
        } catch (failure: Throwable) {
            throw PhaseFailure(phase, description, failure)
        }
    }
}

class Given<G> internal constructor(private val scenario: Scenario, val value: G) {
    fun <W> whenever(description: String, act: (G) -> W): When<G, W> {
        val result = scenario.phase("when", description) { act(value) }
        return When(scenario, value, result)
    }

    /** Setup then assertion, when there is no action to name. */
    fun then(description: String, check: (G) -> Unit): Then {
        scenario.phase("then", description) { check(value) }
        return Then(scenario.steps.toList())
    }
}

class When<G, W> internal constructor(private val scenario: Scenario, val given: G, val result: W) {
    fun then(description: String, check: (result: W, given: G) -> Unit): Then {
        scenario.phase("then", description) { check(result, given) }
        return Then(scenario.steps.toList())
    }
}

/** A failure that names the phase and its description, keeping the original cause. */
class PhaseFailure(val phase: String, val description: String, cause: Throwable) :
    AssertionError("[$phase] $description: ${cause.message ?: cause::class.simpleName}", cause)

/** A scenario that ran past its level's limit. */
class LevelExceeded(val level: Level, val name: String, val tookMs: Long) :
    AssertionError("[${level.name}] '$name' took $tookMs ms, limit ${level.limitMs} ms; wrong level?")

/**
 * Runs the body on the calling thread so JUnit rules, Robolectric and Compose
 * test hosts keep their thread. A watchdog interrupts the caller once the
 * limit passes, so a hung scenario fails instead of blocking the suite, and
 * a scenario that returns late fails on its measured time.
 */
private fun runScenario(level: Level, name: String, slow: Boolean, body: Scenario.() -> Then) {
    require(name.isNotBlank()) { "[${level.name}] a scenario has no name" }
    val caller = Thread.currentThread()
    val watchdog = Thread({
        try {
            Thread.sleep(level.limitMs)
            caller.interrupt()
        } catch (_: InterruptedException) {
            // The scenario finished first.
        }
    }, "bddkit-watchdog").apply { isDaemon = true }
    val started = System.nanoTime()
    watchdog.start()
    try {
        Scenario(level, name).body()
    } catch (failure: Throwable) {
        if (failure.isWatchdogInterrupt()) throw LevelExceeded(level, name, elapsedMs(started))
        throw failure
    } finally {
        watchdog.interrupt()
        Thread.interrupted() // clear a late interrupt so the next test starts clean
    }
    val tookMs = elapsedMs(started)
    if (tookMs > level.limitMs) throw LevelExceeded(level, name, tookMs)
    if (tookMs > level.warnMs && !slow) {
        System.err.println("[${level.name}] '$name' took $tookMs ms (warn ${level.warnMs} ms, limit ${level.limitMs} ms). Wrong level, or pass slow = true.")
    }
}

private fun elapsedMs(startedNanos: Long): Long = (System.nanoTime() - startedNanos) / 1_000_000

/** The watchdog's interrupt surfaces raw, or wrapped by the phase it landed in. */
private fun Throwable.isWatchdogInterrupt(): Boolean =
    this is InterruptedException || (this is PhaseFailure && cause is InterruptedException)

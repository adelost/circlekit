package com.adelost.designkit.ui

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * THE LOCK HAS ONE READER, counted rather than asserted about.
 *
 * [resolveCircleTiming] takes the lock as an ARGUMENT, which is what lets a rule case walk locked and
 * unlocked without mounting anything. It is also what makes it the one door in this design that can be
 * opened with the lock hardcoded off: a gesture site calling it with `locked = false` is a control that
 * is never locked, anywhere, with nothing red. `internal` closes that door for products and not for
 * this kit's own twenty gesture sites, so it is counted here instead (skyvw:1, 2026-09-20).
 *
 * The count is over every module's production source, derived from the repository rather than listed,
 * because a scan that names its own directories goes quietly green when the code moves.
 */
class TheLockHasOneReaderTest {

    @Test
    fun `exactly one production caller reads the lock, and it is the builder`() {
        val callers = productionSources()
            .filter { it.readText().contains("$RULE(") }
            .map { it.name }
            .sorted()
            .toList()

        assertEquals(
            "the rule that takes the lock as an argument is called from ${callers.size} production " +
                "files: $callers. Only $BUILDER may call it, because it is the only thing that reads " +
                "the surface's lock instead of being handed one",
            listOf(BUILDER_FILE),
            callers,
        )
    }

    @Test
    fun `the scan can see the file it is about`() {
        // A completeness canary. A scan that found nothing would pass the case above by listing
        // nothing, and this repository has moved its modules before.
        val sources = productionSources().toList()
        assertEquals(
            "the scan found $BUILDER_FILE ${sources.count { it.name == BUILDER_FILE }} times under " +
                "${repositoryRoot()}, so it is not looking where the kit keeps its source",
            1,
            sources.count { it.name == BUILDER_FILE },
        )
    }

    private fun productionSources(): Sequence<File> =
        repositoryRoot().walkTopDown()
            .filter { it.isFile && it.extension == "kt" }
            .filter { it.invariantSeparatorsPath.contains("/src/main/") }

    private fun repositoryRoot(): File {
        var here = File(".").canonicalFile
        while (!File(here, "settings.gradle.kts").isFile) {
            here = here.parentFile ?: error("no settings.gradle.kts above ${File(".").canonicalFile}")
        }
        return here
    }

    private companion object {
        const val RULE = "resolveCircleTiming"
        const val BUILDER = "circleResolvedTiming"
        const val BUILDER_FILE = "CircleActionTimings.kt"
    }
}

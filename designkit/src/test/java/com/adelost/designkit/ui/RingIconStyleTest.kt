package com.adelost.designkit.ui

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The catalogue's style law, enforced at the source: every icon is a filled
 * silhouette, and a line motif is the only allowed exception.
 *
 * House rule (Mattias 2026-08-17): flat style only — a filled silhouette, with
 * EvenOdd holes only for recognition, and line motifs drawn as thick strokes.
 * An object drawn as an outline (the wireframe cube was the one that got
 * caught on glass) reads as a different style family next to the filled set.
 * This test makes the next one a red build instead of a visual review finding.
 */
class RingIconStyleTest {

    /** Motifs that ARE a line by nature: arrows, chevrons, signs, streaks and
     *  rotation arrows. Everything else must be a filled silhouette. */
    private val lineMotifs = setOf(
        "Arrow", "ChevronLeft", "ChevronRight", "ChevronUp", "ChevronDown",
        "Plus", "Minus", "Check", "Cross", "Zigzag",
        "Wind", "Yaw", "Pitch", "RotationRate", "SinkRate",
        "TouchdownRun", "TouchdownSink",
    )

    private val source: String by lazy {
        File("src/main/java/com/adelost/designkit/ui/RingIcons.kt").readText()
    }

    @Test
    fun `every icon is a filled silhouette or a declared line motif`() {
        val glyphBlocks = Regex(
            "val (\\w+): ImageVector by lazy \\{ glyph\\(\"[^\"]+\"\\) \\{(.*?)} }",
        ).findAll(source).toList()
        assertTrue("icon catalogue must not be empty", glyphBlocks.size > 40)
        val strokeOnly = glyphBlocks
            .filter { !it.groupValues[2].contains("fill(") }
            .map { it.groupValues[1] }
        val undeclared = strokeOnly.filter { it !in lineMotifs }
        assertTrue(
            "outline-only icons outside the line-motif allowance: $undeclared — " +
                "an object must be a filled silhouette; a line motif must be declared",
            undeclared.isEmpty(),
        )
    }

    @Test
    fun `strokes are always thick`() {
        val thin = Regex("stroke\\(\"[^\"]+\", ([\\d.]+)f\\)")
            .findAll(source)
            .map { it.groupValues[1].toFloat() }
            .filter { it < 2.2f }
            .toList()
        assertTrue("strokes thinner than the house minimum (2.2): $thin", thin.isEmpty())
    }
}

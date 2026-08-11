package com.adelost.renderkit.list

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * What stops a wide host from declaring the screen a second time.
 *
 * RecordsScreen built its content twice — once as a SkyvwListSpec and once as a
 * LazyVerticalGrid beside it — and the phone copy drifted: it discarded a spec
 * that had already computed its padding and hardcoded the same three numbers
 * again. The defence is that the column count is a translation of ONE sequence,
 * and that the translation is checkable here rather than by looking at two
 * devices.
 */
class SkyvwListLinesTest {

    private fun item(key: String) = SkyvwListItem(key = key) {}

    /** chips, title, then two categories of a header plus two rows each. */
    private val recordsLike = buildSkyvwList {
        add(item("period"))
        add(item("title"))
        group("record-alt") {
            add(item("alt-header"))
            add(item("alt-1"))
            add(item("alt-2"))
        }
        group("record-speed") {
            add(item("speed-header"))
            add(item("speed-1"))
            add(item("speed-2"))
        }
    }.items

    private fun keysOf(lines: List<List<SkyvwListCell>>) =
        lines.flatten().flatMap { cell -> cell.items.map { it.key } }

    @Test
    fun `every declared item reaches the screen exactly once, at every column count`() {
        // The one assertion that would have caught the original fault: a host
        // may re-shape the sequence, never drop, duplicate or reorder it.
        val declared = recordsLike.map { it.key }

        (1..6).forEach { columns ->
            assertEquals(
                "columns=$columns",
                declared,
                keysOf(skyvwListLines(recordsLike, columns)),
            )
        }
    }

    @Test
    fun `one column is the declared sequence, one item per line`() {
        // The property that protects every round screen: with a single column
        // this contract cannot express anything the old one could not.
        val lines = skyvwListLines(recordsLike, columns = 1)

        assertEquals(recordsLike.size, lines.sumOf { line -> line.sumOf { it.items.size } })
        assertEquals(
            listOf("period", "title", "record-alt", "record-speed"),
            lines.map { it.single().key },
        )
    }

    @Test
    fun `a group is one cell and is never split across a line`() {
        val lines = skyvwListLines(recordsLike, columns = 2)
        val altCell = lines.flatten().single { it.key == "record-alt" }

        assertEquals(
            listOf("alt-header", "alt-1", "alt-2"),
            altCell.items.map { it.key },
        )
        // Both categories fit beside each other at two columns.
        assertEquals(
            listOf("record-alt", "record-speed"),
            lines.last().map { it.key },
        )
    }

    @Test
    fun `a full-line cell never shares its line`() {
        val lines = skyvwListLines(recordsLike, columns = 3)

        lines.forEach { line ->
            if (line.any { it.fullLine }) {
                assertEquals("a full-line cell must stand alone", 1, line.size)
            }
        }
        assertEquals(listOf("period"), lines.first().map { it.key })
    }

    @Test
    fun `cells fill up to the column count and then wrap`() {
        val many = buildSkyvwList {
            repeat(5) { index -> group("g$index") { add(item("i$index")) } }
        }.items

        assertEquals(
            listOf(listOf("g0", "g1"), listOf("g2", "g3"), listOf("g4")),
            skyvwListLines(many, columns = 2).map { line -> line.map { it.key } },
        )
    }

    @Test
    fun `an interrupted group is two groups, because reuniting it would reorder`() {
        val split = buildSkyvwList {
            group("g") { add(item("a")) }
            add(item("between"))
            group("g") { add(item("b")) }
        }.items
        val lines = skyvwListLines(split, columns = 2)

        // Order is preserved and "between" is not jumped over.
        assertEquals(listOf("a", "between", "b"), keysOf(lines))
    }

    @Test
    fun `an ungrouped screen is unchanged by having a column count`() {
        // Every existing screen: no groups, so every item owns its line no
        // matter how wide the host claims to be.
        val plain = buildSkyvwList {
            add(item("a"))
            add(item("b"))
            add(item("c"))
        }.items

        assertEquals(
            skyvwListLines(plain, columns = 1).map { line -> line.map { it.key } },
            skyvwListLines(plain, columns = 4).map { line -> line.map { it.key } },
        )
    }

    @Test
    fun `an empty group is refused rather than silently dropped`() {
        val failure = runCatching {
            buildSkyvwList { group("nothing") {} }
        }.exceptionOrNull()

        assertTrue(failure is IllegalArgumentException)
    }

    @Test
    fun `a policy cannot declare fewer than one column`() {
        assertTrue(
            runCatching { SkyvwListPolicy(columns = 0) }.exceptionOrNull()
                is IllegalArgumentException,
        )
    }
}

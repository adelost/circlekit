package com.adelost.renderkit.list

import androidx.compose.runtime.Immutable

/**
 * One cell of a line: either a full-line item or an indivisible group.
 *
 * [key] is the cell's identity for the host's item keys — a group's own key,
 * or the single item's key when it stands alone.
 */
@Immutable
class SkyvwListCell(
    val key: Any,
    val items: List<SkyvwListItem>,
    /** A full-line cell owns its line; nothing may sit beside it. */
    val fullLine: Boolean,
) {
    /** A lone item lends the host its content type; a group has no single one. */
    fun contentType(): Any? = items.singleOrNull()?.contentType
}

/**
 * Split one declared sequence into the lines a host renders.
 *
 * This is the whole of the multi-column translation, and it is a pure function
 * on purpose: the property worth guarding — every declared item reaches the
 * screen exactly once, whatever the column count — is then a unit test rather
 * than something you can only see by looking at two devices. The fault this
 * closes was a phone that rebuilt the sequence beside the spec and drifted.
 *
 * The rules, in full:
 * - items marked by [SkyvwListScope.group] coalesce into ONE cell, in order;
 * - every other item is its own FULL-LINE cell, because a screen that has not
 *   said "these belong together" has not earned a shared line;
 * - a full-line cell never shares a line;
 * - cells otherwise fill up to [columns] per line.
 *
 * At `columns = 1` every cell sits alone, so flattening the result returns the
 * declared sequence unchanged. That is what makes this safe to put under
 * screens that have only ever had one column.
 */
internal fun skyvwListLines(
    items: List<SkyvwListItem>,
    columns: Int,
): List<List<SkyvwListCell>> {
    require(columns >= 1) { "A list needs at least one column, got $columns" }
    val cells = skyvwListCells(items)
    val lines = mutableListOf<List<SkyvwListCell>>()
    var current = mutableListOf<SkyvwListCell>()

    fun flush() {
        if (current.isNotEmpty()) {
            lines += current.toList()
            current = mutableListOf()
        }
    }

    cells.forEach { cell ->
        if (cell.fullLine) {
            flush()
            lines += listOf(cell)
            return@forEach
        }
        current += cell
        if (current.size == columns) flush()
    }
    flush()
    return lines
}

/** The sequence as cells, before any line has a width. */
private fun skyvwListCells(items: List<SkyvwListItem>): List<SkyvwListCell> {
    val cells = mutableListOf<SkyvwListCell>()
    var index = 0
    while (index < items.size) {
        val item = items[index]
        val group = item.groupKey
        if (group == null) {
            cells += SkyvwListCell(key = item.key, items = listOf(item), fullLine = true)
            index++
            continue
        }
        // Consecutive-only on purpose: a group interrupted by other content is
        // two groups, and silently reuniting them would reorder the screen.
        val run = mutableListOf<SkyvwListItem>()
        while (index < items.size && items[index].groupKey == group) {
            run += items[index]
            index++
        }
        cells += SkyvwListCell(key = group, items = run.toList(), fullLine = false)
    }
    return cells
}

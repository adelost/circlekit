package com.adelost.designkit.ui

import androidx.compose.ui.graphics.Color

/**
 * Whether a row's leading ring means anything.
 *
 * The ring is the circle language's one mark for "you can do something with
 * this". It is the same shape as a launcher tile, and on a toggle the ring IS
 * the state. Drawing it around a reading spends that meaning on nothing:
 * SYSTEM's version number, MEMORY, the barometer's capability and the cache
 * sizes all wore the same circle as the rows beside them that actually do
 * something, so the shape stopped answering the only question it exists to
 * answer (Mattias 2026-08-06, to a photo of the SYSTEM menu: "saker som går
 * att roggla eller klicka på, men saker som vara är display har annan ux ...
 * som itne går att klicka på, ej har en cirkel runt ikonen?").
 *
 * The answer is DERIVED from the row's own action and never declared beside
 * it. [of] is the only way to obtain one, and it demands the action itself, so
 * there is no value a caller can pass that would put a ring around a row it
 * cannot press — the same reason [com.adelost.ringkit.ui.RowKind] is derived
 * rather than accepted as a parameter. A new row answers this question by
 * existing; there is no field to forget.
 */
@JvmInline
value class CircleRowAffordance private constructor(val operable: Boolean) {
    companion object {
        /** The grammar, stated once: the action IS the ring. */
        fun of(action: (() -> Unit)?): CircleRowAffordance =
            CircleRowAffordance(operable = action != null)
    }
}

/**
 * The contour a row's leading ring is drawn with, or null when there is no
 * ring to draw.
 *
 * The whole grammar is these three lines, and it sits here rather than inside
 * the layout so it can be read, tested and mutated on its own — the same
 * split the rest of the kit keeps between deciding and drawing. A renderer
 * that wants to disagree has to delete this function first.
 */
fun circleRowRingContour(
    affordance: CircleRowAffordance,
    active: Boolean?,
    activeColor: Color,
): Color? = when {
    !affordance.operable -> null
    active == true -> activeColor
    else -> MenuDesign.ringNeutral
}

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
 * How a row's leading disc is drawn: its ground, its contour (null when there is no ring) and its icon.
 *
 * Style C (Mattias 2026-10-17, the plan's "Ikonskiva"): a disc wears its kind's ground with a fine edge in its
 * colour and the icon strong; lit, the edge takes the full colour; off, the disc loses its ground, the edge turns
 * the grey that means off and the icon dims. A reading has no disc at all, only its icon (Mattias 2026-08-06).
 *
 * The whole grammar is these four lines, and it sits here rather than inside the layout so it can be read, tested
 * and mutated on its own. A renderer that wants to disagree has to delete this function first.
 */
fun circleRowDiscLook(
    affordance: CircleRowAffordance,
    active: Boolean?,
    tones: CircleTones,
): CircleDiscLook = circleDiscLook(affordance.operable, active, tones)

/** [circleRowDiscLook] for any disc: a launcher is operable by being one, and a disabled one wears off. */
fun circleDiscLook(operable: Boolean, active: Boolean?, tones: CircleTones): CircleDiscLook = when {
    !operable -> CircleDiscLook(ground = Color.Transparent, contour = null, icon = tones.strong)
    active == false -> CircleDiscLook(ground = Color.Transparent, contour = CircleStyleTokens.Off, icon = tones.dim)
    active == true -> CircleDiscLook(ground = tones.ground, contour = tones.strong, icon = tones.strong)
    else -> CircleDiscLook(ground = tones.ground, contour = tones.edge, icon = tones.strong)
}

/** A leading disc's three colours; [contour] null draws no ring. */
data class CircleDiscLook(val ground: Color, val contour: Color?, val icon: Color)

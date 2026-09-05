package com.adelost.ringkit.ui

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.adelost.designkit.ui.CircleActionTiming
import com.adelost.designkit.ui.CircleChoiceRole
import com.adelost.designkit.ui.CircleChromeSlot
import com.adelost.designkit.ui.roundSafeRectHorizontalInsetsDp
import com.adelost.designkit.ui.roundSafeInsetDp

/**
 * Semantic row data. Renderers consume [RowSpec.kind] and never classify UI.
 *
 * The line between the last two matters to the reader, not just the code: a
 * FINITE set of named states is a [CHOICE_OF_N] and shows the shared step
 * indicator, so its size and position are visible at a glance. [ADJUSTMENT]
 * is for continuous values — an altitude, a speed — which open their own
 * +/- screen and have no meaningful "3 of 5" to show.
 */
enum class RowKind {
    INFORMATION,
    ACTION,
    TOGGLE,

    /** A finite, named set. Cycles in place and renders step dots. */
    CHOICE_OF_N,

    /** A continuous value. Opens the adjustment screen; never shows dots. */
    ADJUSTMENT,
}

internal fun rowKind(row: RowSpec): RowKind = row.kind

internal fun rowKindFor(
    onTap: (() -> Unit)?,
    onDec: (() -> Unit)?,
    onInc: (() -> Unit)?,
    choices: List<String>,
    choiceRole: CircleChoiceRole,
): RowKind = when {
    onDec != null || onInc != null -> RowKind.ADJUSTMENT
    choices.isNotEmpty() && choiceRole == CircleChoiceRole.TOGGLE ->
        RowKind.TOGGLE
    choices.isNotEmpty() -> RowKind.CHOICE_OF_N
    onTap != null -> RowKind.ACTION
    else -> RowKind.INFORMATION
}

internal data class ChoiceRowInteraction(
    val holdMs: Long,
    val timing: CircleActionTiming,
)

/** Both Watch and Phone consume the exact cadence declared by row data. */
internal fun choiceRowInteraction(row: RowSpec): ChoiceRowInteraction {
    require(row.kind == RowKind.TOGGLE || row.kind == RowKind.CHOICE_OF_N) {
        "Only semantic choice rows have a choice interaction"
    }
    return ChoiceRowInteraction(
        holdMs = row.holdMs,
        timing = row.actionTiming,
    )
}

internal data class RingRowHorizontalInsets(
    val start: Dp,
    val end: Dp,
)

/**
 * The rectangular host's card margin. A phone row is bounded by the screen,
 * not by a circle, so nothing computes a clearance for it and this IS its
 * margin.
 */
internal val settingsRowInsetH: Dp = 36.dp

/**
 * ROUND's base margin is only the breathing room Mattias asked for (2026-07-23:
 * "gör den typ 10% smalare.. så man har lite mer margins till sidorna").
 *
 * It used to be 36 dp here too, sized to clear the floating X@9. Since #510 the
 * real clearance — the chord at THIS row's height plus whichever chrome buttons
 * actually overlap it — comes from
 * [com.adelost.designkit.ui.roundSafeContentInset], so the constant was
 * charging every row for the worst case twice over: rows across the middle of
 * the face, where the circle is widest and no button sits beside them, lost
 * 26 dp they did not owe and clipped their own titles to CONTRO, GROUN, TRAC.
 */
internal val roundRowInsetH: Dp = 10.dp

/**
 * The BASE margin a menu row keeps, before the face's own geometry has a say.
 * The atom adds only the surplus over this, so a smaller base can never make a
 * row unsafe — it only stops the row from paying twice.
 */
internal fun ringRowHorizontalInsets(round: Boolean): RingRowHorizontalInsets {
    val inset = if (round) roundRowInsetH else settingsRowInsetH
    return RingRowHorizontalInsets(start = inset, end = inset)
}

/**
 * Horizontal clearance for the shared continuous-value editor.
 *
 * The step controls are vertically centred, therefore their geometry is
 * deterministic and does not need a position-observer. Using the editor's
 * own viewport also keeps the answer correct when a round watch face is
 * embedded in a larger rectangular host for preview or testing.
 */
internal fun adjustmentRowInsetDp(
    viewportWidthDp: Float,
    viewportHeightDp: Float,
    round: Boolean,
    baseInsetDp: Float,
    reservedSlots: List<CircleChromeSlot>,
): Float = if (round) {
    maxOf(
        baseInsetDp,
        roundSafeInsetDp(
            viewportWidthDp = viewportWidthDp,
            viewportHeightDp = viewportHeightDp,
            contentCenterYDp = viewportHeightDp / 2f,
            reservedSlots = reservedSlots,
        ),
    )
} else {
    baseInsetDp
}

/**
 * The straight horizontal inset a rows list keeps on a round face.
 *
 * A reading list keeps a STRAIGHT left edge, so ONE width has to be safe for
 * the whole band the rows occupy — not just for the middle of it. It was
 * measured at the viewport centre, where the circle takes nothing away at
 * all, which left the floating chrome as the only thing holding rows inside
 * the arc. A screen that mounts no chrome (first-run setup) therefore drew
 * its rows straight through the glass: "DATA CAN BE WRONG" lost its G and
 * the icon ring beside it lost its right half, with no ellipsis to admit
 * either (menu UX audit 2026-07-27, finding 9).
 *
 * The band starts just under the title, and for a straight edge it ends at
 * the mirrored depth. So the widest a row may be is the chord AT THE TOP of
 * that band, and that same width is then safe all the way down to its
 * mirror. Chrome can still ask for more — it can no longer be the only thing
 * asking.
 */
internal fun rowsListInsetsDp(
    viewportWidthDp: Float,
    viewportHeightDp: Float,
    titleBandBottomDp: Float,
    baseInsetDp: Float,
    reservedSlots: List<CircleChromeSlot>,
): RingRowHorizontalInsets {
    // Reserve the entire reading band. Sampling only its centre misses an
    // escape at ten/two even though it intersects the first visible rows.
    val band = roundSafeRectHorizontalInsetsDp(
        viewportWidthDp = viewportWidthDp,
        viewportHeightDp = viewportHeightDp,
        contentCenterYDp = viewportHeightDp / 2f,
        contentHeightDp = (viewportHeightDp - 2f * titleBandBottomDp).coerceAtLeast(1f),
        reservedSlots = reservedSlots,
    )
    return RingRowHorizontalInsets(
        start = maxOf(baseInsetDp, band.start).dp,
        end = maxOf(baseInsetDp, band.end).dp,
    )
}

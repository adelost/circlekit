package com.adelost.designkit.ui

import androidx.compose.foundation.shape.CornerSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

/**
 * THE PRESS CUE FOR A CARD: its own rounded frame traced clockwise from the top centre, over a faint lift.
 *
 * The sibling of [circleProgressSweep] (a label's wash) and [circleProgressContour] (a disc's ring), for
 * an entry that is a card rather than a label or a disc. A logbook day used to take the gesture's own cue
 * AND a label wash, so a near-square day drew a ring around the whole day and a rectangle through it at
 * once; Mattias 2026-10-09: "en jätteful progress bar ... detta känns inte alls polished". One card, one
 * cue: the frame fills while the finger spends the gate, and a press let go early drains back the way it
 * came. A [corner] of half the shorter side makes the frame a disc, so one renderer serves a card, a round
 * picture and a whole round face.
 *
 * [progress] is read in the draw phase for the reason [circleProgressSweep] gives: read in composition it
 * is a frame late, and a press would recompose the whole card sixty times a second.
 */
fun Modifier.circleProgressOutline(
    progress: () -> Float,
    corner: CornerSize,
    color: Color,
    lift: Color = Color.White.copy(alpha = OUTLINE_LIFT_ALPHA),
): Modifier = drawWithCache {
    val stroke = MenuDesign.iconRingStroke.toPx()
    val cornerPx = corner.toPx(size, this)
    val trace = Path()
    onDrawWithContent {
        val fraction = progress().coerceIn(0f, 1f)
        if (fraction > 0f) {
            // The lift arrives with the first sixth of the gate, so a brush that never becomes a press barely
            // moves the card, and a press is a card the moment it is one.
            val appear = (fraction / OUTLINE_LIFT_RAMP).coerceAtMost(1f)
            drawRoundRect(
                color = lift.copy(alpha = lift.alpha * appear),
                cornerRadius = CornerRadius(min(cornerPx, size.minDimension / 2f)),
            )
        }
        drawContent()
        if (fraction > 0f) {
            trace.reset()
            circleOutlineTrace(size, cornerPx, inset = stroke / 2f, fraction).appendTo(trace)
            drawPath(trace, color, style = Stroke(width = stroke, cap = StrokeCap.Round))
        }
    }
}

/**
 * The card's cue for a gated entry: the press the gesture is timing, drawn as [circleProgressOutline].
 *
 * Pair it with [CirclePressCue.OWNED] on the gesture; a card that forgets says the wait twice, which is
 * the defect this replaced. [feedback] takes the gesture's STATE, never a duration, for the reason
 * [circleLabelProgress] gives: one clock for one wait.
 */
@Composable
fun Modifier.circleCardProgress(
    feedback: CircleActionFeedbackState,
    corner: CornerSize,
    color: Color? = null,
): Modifier {
    val sweep = rememberCircleFeedbackSweep(progress = null, feedback = feedback)
    return circleProgressOutline(progress = sweep, corner = corner, color = color ?: circleBrandColor())
}

/** One stretch of a traced frame: a straight run to [end], or part of a corner's quarter circle. */
internal sealed interface OutlinePiece {
    val end: Offset

    data class Line(override val end: Offset) : OutlinePiece

    data class Arc(val oval: Rect, val startDeg: Float, val sweepDeg: Float) : OutlinePiece {
        override val end: Offset
            get() {
                val radians = (startDeg + sweepDeg) * PI / 180.0
                return Offset(
                    oval.center.x + oval.width / 2f * cos(radians).toFloat(),
                    oval.center.y + oval.height / 2f * sin(radians).toFloat(),
                )
            }
    }
}

/** The pieces after [start], as the path the frame draws. */
internal data class OutlineTrace(val start: Offset, val pieces: List<OutlinePiece>) {
    fun appendTo(path: Path) {
        path.moveTo(start.x, start.y)
        pieces.forEach { piece ->
            when (piece) {
                is OutlinePiece.Line -> path.lineTo(piece.end.x, piece.end.y)
                is OutlinePiece.Arc -> path.arcTo(piece.oval, piece.startDeg, piece.sweepDeg, forceMoveTo = false)
            }
        }
    }
}

/**
 * The first [fraction] of a rounded frame inset by [inset], starting at the top centre and running
 * clockwise: right along the top, down the right side, back along the bottom and up the left.
 *
 * Built as data rather than measured off a platform path, so what the wearer sees (where it starts, which
 * way it turns, where it ends) is stated in plain geometry and holds on any renderer.
 */
internal fun circleOutlineTrace(size: Size, cornerPx: Float, inset: Float, fraction: Float): OutlineTrace {
    val left = inset
    val top = inset
    val right = size.width - inset
    val bottom = size.height - inset
    val radius = cornerPx.coerceIn(0f, min(right - left, bottom - top) / 2f)
    val centreX = size.width / 2f
    fun corner(cx: Float, cy: Float) = Rect(cx - radius, cy - radius, cx + radius, cy + radius)
    val quarter = (PI / 2.0 * radius).toFloat()
    // The whole frame, in order. Each stretch is (length, its full piece, its piece cut to a length).
    val stretches: List<Triple<Float, OutlinePiece, (Float) -> OutlinePiece>> = listOf(
        line(Offset(centreX, top), Offset(right - radius, top)),
        arc(corner(right - radius, top + radius), -90f, quarter),
        line(Offset(right, top + radius), Offset(right, bottom - radius)),
        arc(corner(right - radius, bottom - radius), 0f, quarter),
        line(Offset(right - radius, bottom), Offset(left + radius, bottom)),
        arc(corner(left + radius, bottom - radius), 90f, quarter),
        line(Offset(left, bottom - radius), Offset(left, top + radius)),
        arc(corner(left + radius, top + radius), 180f, quarter),
        line(Offset(left + radius, top), Offset(centreX, top)),
    )
    var remaining = stretches.sumOf { it.first.toDouble() }.toFloat() * fraction.coerceIn(0f, 1f)
    val pieces = buildList {
        for ((length, whole, cut) in stretches) {
            if (remaining <= 0f) break
            if (length <= 0f) continue
            if (remaining >= length) add(whole) else add(cut(remaining))
            remaining -= length
        }
    }
    return OutlineTrace(Offset(centreX, top), pieces)
}

private fun line(from: Offset, to: Offset): Triple<Float, OutlinePiece, (Float) -> OutlinePiece> {
    val length = (to - from).getDistance()
    return Triple(length, OutlinePiece.Line(to)) { part ->
        OutlinePiece.Line(from + (to - from) * (part / length))
    }
}

private fun arc(oval: Rect, startDeg: Float, length: Float): Triple<Float, OutlinePiece, (Float) -> OutlinePiece> =
    Triple(length, OutlinePiece.Arc(oval, startDeg, 90f)) { part ->
        OutlinePiece.Arc(oval, startDeg, 90f * part / length)
    }

/** How much a held card brightens, as white over black: enough to read as lifted on OLED, never a plate. */
private const val OUTLINE_LIFT_ALPHA = 0.06f

/** The share of the gate over which the lift arrives. */
private const val OUTLINE_LIFT_RAMP = 1f / 6f

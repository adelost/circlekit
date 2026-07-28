package com.adelost.designkit.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Product semantics stay data: a boolean may light its ring, an ordered
 * selection stays neutral and lets the position mark carry the state. */
enum class CircleChoiceRole { TOGGLE, STEPPED }

/**
 * Position in a finite choice set. The state names stay in product data;
 * this atom only needs count + selected index and therefore works for every
 * enum without knowing whether it represents units, clouds or a camera axis.
 */
data class CircleChoiceState(
    val optionCount: Int,
    val selectedIndex: Int,
) {
    init {
        require(optionCount in MIN_OPTIONS..MAX_OPTIONS) {
            "Choice indicators support $MIN_OPTIONS..$MAX_OPTIONS options"
        }
        require(selectedIndex in 0 until optionCount) {
            "Selected choice $selectedIndex is outside 0 until $optionCount"
        }
    }

    companion object {
        const val MIN_OPTIONS = 2
        const val MAX_OPTIONS = 7
    }
}

/** Converts any ordered choice catalog to its renderer-neutral position. */
fun <T> circleChoiceState(options: List<T>, selected: T): CircleChoiceState {
    require(options.distinct().size == options.size) { "Choice options must be unique" }
    val selectedIndex = options.indexOf(selected)
    require(selectedIndex >= 0) { "Selected value '$selected' is not one of $options" }
    return CircleChoiceState(options.size, selectedIndex)
}

/**
 * How wide the mark may be for [optionCount] positions.
 *
 * It grows with the count but STOPS: past the cap the dots simply pack
 * tighter, because a row's title must not shrink just because a setting
 * gained a step. Owned here rather than by each caller, so the mark cannot
 * have two different widths on two screens.
 */
fun circleChoiceIndicatorWidth(optionCount: Int): Dp =
    minOf(optionCount * 5 + 5, CHOICE_INDICATOR_MAX_WIDTH_DP).dp

/** Past this the dots pack tighter instead of taking the title's room. */
private const val CHOICE_INDICATOR_MAX_WIDTH_DP = 26

/**
 * The shared finite-choice mark. Two choices read as a tiny switch rail;
 * three or more read as discrete positions. The selected bead glides between
 * them while the unselected positions remain quiet contours.
 */
@Composable
fun CircleChoiceIndicator(
    state: CircleChoiceState,
    modifier: Modifier = Modifier,
    selectedColor: Color = RingTokens.Ink,
    restColor: Color = RingTokens.Outline,
) {
    val animatedIndex by animateFloatAsState(
        targetValue = state.selectedIndex.toFloat(),
        animationSpec = tween(durationMillis = 180),
        label = "circleChoicePosition",
    )
    Canvas(
        modifier = modifier.semantics {
            contentDescription = "Option ${state.selectedIndex + 1} of ${state.optionCount}"
        },
    ) {
        val radius = 1.9.dp.toPx()
        val selectedRadius = 2.25.dp.toPx()
        val usableWidth = (size.width - selectedRadius * 2f).coerceAtLeast(0f)
        val step = usableWidth / (state.optionCount - 1)
        val centerY = size.height / 2f
        val xFor: (Float) -> Float = { index -> selectedRadius + step * index }

        if (state.optionCount == 2) {
            drawLine(
                color = restColor,
                start = Offset(xFor(0f), centerY),
                end = Offset(xFor(1f), centerY),
                strokeWidth = 0.7.dp.toPx(),
                cap = StrokeCap.Round,
            )
        }
        repeat(state.optionCount) { index ->
            drawCircle(
                color = restColor,
                radius = radius,
                center = Offset(xFor(index.toFloat()), centerY),
                style = Stroke(width = 0.7.dp.toPx()),
            )
        }
        drawCircle(
            color = selectedColor,
            radius = selectedRadius,
            center = Offset(xFor(animatedIndex), centerY),
        )
    }
}

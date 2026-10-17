package com.adelost.designkit.ui

import androidx.compose.ui.unit.Dp

/** Progress around a large control is geometry, six percent of its diameter, rather than another fixed line role. */
fun circleProgressStroke(diameter: Dp): Dp = diameter * PROGRESS_DIAMETER_SHARE

private const val PROGRESS_DIAMETER_SHARE = 0.06f

/** One centred line, plus a halo of [side] on each side, all in the caller's same unit. */
fun circleHaloStroke(core: Float, side: Float): Float = core + 2f * side

/** A contour painted under a fill keeps its outer half visible at the role's full width. */
fun circleContourUnderfill(edge: Float): Float = edge * 2f

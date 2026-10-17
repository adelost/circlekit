package com.adelost.designkit.ui

import androidx.compose.ui.unit.Dp

/** Progress around a large control is geometry, six percent of its diameter, rather than another fixed line role. */
fun circleProgressStroke(diameter: Dp): Dp = diameter * PROGRESS_DIAMETER_SHARE

private const val PROGRESS_DIAMETER_SHARE = 0.06f

package com.adelost.designkit.ui

import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip

/**
 * The one host-shape boundary. Watch content keeps its physical circular
 * crop; rectangular hosts never inherit a decorative watch mask.
 */
@Composable
fun Modifier.circleHostClip(): Modifier =
    if (LocalCircleSurfaceLayout.current.surfaceClass == CircleSurfaceClass.ROUND) {
        clip(CircleShape)
    } else {
        this
    }

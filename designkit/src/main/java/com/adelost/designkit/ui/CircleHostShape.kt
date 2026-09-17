package com.adelost.designkit.ui

import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer

/**
 * The one host-shape boundary. Watch content keeps its physical circular
 * crop; rectangular hosts never inherit a decorative watch mask.
 */
@Composable
fun Modifier.circleHostClip(): Modifier =
    if (LocalCircleSurfaceLayout.current.surfaceClass == CircleSurfaceClass.ROUND) {
        roundFaceClip()
    } else {
        this
    }

/**
 * A round face's crop, applied once to everything drawn inside it.
 *
 * A plain clip anti-aliases every drawing against the circle on its own, so an
 * opaque sheet over a page does not cover the page at the rim: where the edge
 * keeps a fraction c of each drawing, the page keeps c and the sheet removes
 * only c of that, leaving c(1 - c) of the page, up to a quarter. Skyvw row 123:
 * page text showed through an (i) sheet as a faint arc at the face's bottom
 * edge. Composited offscreen first, the face is one image and the circle cuts
 * it once.
 */
fun Modifier.roundFaceClip(): Modifier = graphicsLayer {
    shape = CircleShape
    clip = true
    compositingStrategy = CompositingStrategy.Offscreen
}

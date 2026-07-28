package com.adelost.designkit.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Rectangular host for the same data and atoms as the canonical round surface.
 * Products provide content; CircleKit alone resolves capacity and placement.
 */
@Composable
fun SkyvwResponsiveSurface(
    modifier: Modifier = Modifier,
    content: @Composable (SkyvwUiProfile) -> Unit,
) {
    BoxWithConstraints(
        modifier = modifier.fillMaxSize().background(Color.Black),
        contentAlignment = Alignment.TopCenter,
    ) {
        val widthDp = maxWidth.value
        val heightDp = maxHeight.value
        val surface = remember(widthDp, heightDp) {
            resolveSkyvwSurfaceLayout(
                widthDp = widthDp,
                heightDp = heightDp,
                round = false,
            )
        }
        val profile = remember(surface.surfaceClass) {
            SkyvwUiProfiles.phoneProfileFor(surface.surfaceClass)
        }
        CompositionLocalProvider(LocalSkyvwSurfaceLayout provides surface) {
            Box(
                modifier = Modifier
                    .widthIn(max = surface.contentMaxWidthDp.dp)
                    .fillMaxSize()
                    .safeDrawingPadding(),
            ) {
                content(profile)
            }
        }
    }
}

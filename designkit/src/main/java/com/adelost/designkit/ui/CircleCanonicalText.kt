package com.adelost.designkit.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf

internal val LocalCircleCanonicalText = staticCompositionLocalOf { false }

/** A watch composition scaled as one face keeps its watch text, not the outer phone layout's text. */
@Composable
fun CircleCanonicalText(content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalCircleCanonicalText provides true, content = content)
}

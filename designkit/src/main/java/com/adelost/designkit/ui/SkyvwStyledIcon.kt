package com.adelost.designkit.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color

/**
 * The only renderer needed for both plain and multi-colour RingKit icons.
 * Geometry and colours stay in [SkyvwIconStyle]; hosts only choose size,
 * accessibility text and state strength.
 */
@Composable
fun SkyvwStyledIcon(
    style: SkyvwIconStyle,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    strength: SkyvwAccentStrength = SkyvwAccentStrength.ACTIVE,
    tintOverride: Color? = null,
) {
    Box(modifier) {
        val setStyle = LocalSkyvwIconSetStyle.current
        style.layers.forEachIndexed { index, layer ->
            SkyvwIcon(
                imageVector = skyvwIconVariant(layer.icon, setStyle),
                contentDescription = contentDescription.takeIf { index == 0 },
                tint = tintOverride ?: skyvwAccentColor(layer.accent, strength),
                modifier = Modifier.fillMaxSize(),
            )
        }
    }
}

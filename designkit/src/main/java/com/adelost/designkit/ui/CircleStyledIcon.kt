package com.adelost.designkit.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color

/**
 * The only renderer needed for both plain and multi-colour RingKit icons.
 * Geometry and colours stay in [CircleIconStyle]; hosts only choose size,
 * accessibility text and state strength.
 */
@Composable
fun CircleStyledIcon(
    style: CircleIconStyle,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    strength: CircleAccentStrength = CircleAccentStrength.ACTIVE,
    tintOverride: Color? = null,
) {
    Box(modifier) {
        val setStyle = LocalCircleIconSetStyle.current
        style.layers.forEachIndexed { index, layer ->
            CircleIcon(
                imageVector = circleIconVariant(layer.icon, setStyle),
                contentDescription = contentDescription.takeIf { index == 0 },
                tint = tintOverride ?: circleAccentColor(layer.accent, strength),
                modifier = Modifier.fillMaxSize(),
            )
        }
    }
}

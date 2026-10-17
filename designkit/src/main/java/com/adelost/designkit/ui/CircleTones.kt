package com.adelost.designkit.ui

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

/**
 * A colour's four tones. A product writes the colour once, as its strong tone, and the rest follow at build time by
 * the house tone rule (circlekit-assets/src/circle-tone.ts), so no runtime rounds the same colour two ways.
 *
 * A surface picks a tone by its role, never a pigment: [strong] is what you read now (the value, a lit icon, the
 * dial's front), [dim] the rest (the band behind the value, the scale, what is not now), [ground] the disc behind an
 * icon and [edge] that disc's fine ring.
 */
@Immutable
data class CircleTones(
    val strong: Color,
    val dim: Color,
    val ground: Color,
    val edge: Color,
)

// GENERATED from circlekit-assets/src/circle-style.ts - do not edit.
package com.adelost.designkit.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/** Opinionated cross-product chrome. Semantic product colour lives in ProductPalette. */
object CircleStyleTokens {
    val Surface = Color(0xFF000000)
    val Sheet = Color(0xFF121316)
    val Card = Color(0xFF1C1D20)
    val Line = Color(0xFF2A2B2E)
    val Off = Color(0xFF373C44)
    val Faint = Color(0xFF5F656F)
    val ActionMuted = Color(0xFF8B939E)
    val Action = Color(0xFFF2F4F7)

    /** The tones of a thing that is about no kind: a pointer, the weather, an icon without a colour. */
    val NeutralTones = CircleTones(strong = Color(0xFFF2F4F7), dim = Color(0xFF8B939E), ground = Color(0xFF232429), edge = Color(0xFF373C44))
}

/** The house tone rule, as circle-tone.ts applies it at build time. Read, never re-implemented, at runtime. */
object CircleToneRule {
    const val GroundLightness = 0.325f
    const val GroundChromaMax = 0.05f
    const val GroundChromaShare = 0.55f
    const val DimAt = 0.376f
    const val EdgeAt = 0.42f
}

/** The house colours of the kit's icon vocabulary, tones derived at build time. A product supplies its own. */
internal val CIRCLE_ACCENT_DEFAULT_TONES: Map<CircleAccent, CircleTones> = mapOf(
    CircleAccent.NEUTRAL to CircleTones(strong = Color(0xFFF2F4F7), dim = Color(0xFF8B939E), ground = Color(0xFF232429), edge = Color(0xFF373C44)),
    CircleAccent.SKY to CircleTones(strong = Color(0xFF83B0E4), dim = Color(0xFF436182), ground = Color(0xFF21354D), edge = Color(0xFF486689)),
    CircleAccent.SUN to CircleTones(strong = Color(0xFFEEC649), dim = Color(0xFF7B6627), ground = Color(0xFF3E3313), edge = Color(0xFF836D29)),
    CircleAccent.CLOUD to CircleTones(strong = Color(0xFFF2F4F7), dim = Color(0xFF8B939E), ground = Color(0xFF232429), edge = Color(0xFF373C44)),
    CircleAccent.RAIN to CircleTones(strong = Color(0xFF6C91BB), dim = Color(0xFF3E5672), ground = Color(0xFF243549), edge = Color(0xFF415A77)),
    CircleAccent.COLD to CircleTones(strong = Color(0xFFD7E7EE), dim = Color(0xFF697377), ground = Color(0xFF2E3538), edge = Color(0xFF707B7F)),
    CircleAccent.POSITIVE to CircleTones(strong = Color(0xFF1BC279), dim = Color(0xFF236B46), ground = Color(0xFF1C3C2A), edge = Color(0xFF247149)),
    CircleAccent.CAUTION to CircleTones(strong = Color(0xFFEEC649), dim = Color(0xFF7B6627), ground = Color(0xFF3E3313), edge = Color(0xFF836D29)),
    CircleAccent.DANGER to CircleTones(strong = Color(0xFFEB483C), dim = Color(0xFF84372F), ground = Color(0xFF4B2A25), edge = Color(0xFF8B3930)),
    CircleAccent.ACHIEVEMENT to CircleTones(strong = Color(0xFFD9B45C), dim = Color(0xFF75602D), ground = Color(0xFF3F3213), edge = Color(0xFF7C6530)),
    CircleAccent.VIOLET to CircleTones(strong = Color(0xFFCBA8EF), dim = Color(0xFF6D5883), ground = Color(0xFF3B2D48), edge = Color(0xFF745D8A)),
    CircleAccent.PLACE to CircleTones(strong = Color(0xFF5BE2CD), dim = Color(0xFF29766A), ground = Color(0xFF0F3C36), edge = Color(0xFF2D7D71)),
    CircleAccent.SOUND to CircleTones(strong = Color(0xFFE498C1), dim = Color(0xFF7E5069), ground = Color(0xFF472939), edge = Color(0xFF85556F)),
)

/** The on/off switch's geometry. */
object CircleSwitchTokens {
    val Width = 22.dp
    val Height = 12.dp
    val KnobInset = 2.dp
}

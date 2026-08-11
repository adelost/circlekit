package com.adelost.renderkit.surface

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.adelost.designkit.ui.CircleSurfaceClass
import com.adelost.designkit.ui.LocalCircleSurfaceLayout
import com.adelost.designkit.ui.roundSafeContentInset

/**
 * The edge inset THIS surface actually needs.
 *
 * [roundSafeContentInset] answers a round-face question: how much width the
 * circle's chord and the floating rim chrome take at a given height. Its
 * `enabled` flag exists because a caller that can also land on a rectangular
 * host has to say so — a phone viewport is not a circle, so asking the chord
 * question of one answers for the widest circle that fits INSIDE it.
 *
 * The damage is all at the ends. On a 360x800 dp phone the inscribed circle is
 * 360 dp wide at the vertical centre and has closed completely by 180 dp from
 * it, so identical content is untouched in the middle and squeezed to zero
 * width — while still holding its height — near either edge. The records
 * period chips sit 102 dp down and vanished; a centred empty state survived on
 * the accident that a portrait phone is exactly viewport-wide at its centre.
 * An accident is not a contract, and it stops holding the moment a viewport is
 * wider than it is tall.
 *
 * So shared content that renders on both surfaces asks this instead, and
 * roundness is read once from the surface itself — the same way
 * [com.adelost.designkit.ui.circleHostClip] answers the matching shape
 * question. Content reached only through a round branch keeps calling the kit
 * atom directly: there the branch has already established the face.
 */
@Composable
fun Modifier.surfaceSafeContentInset(baseInsetDp: Float = 0f): Modifier =
    roundSafeContentInset(
        enabled = LocalCircleSurfaceLayout.current.surfaceClass == CircleSurfaceClass.ROUND,
        baseInsetDp = baseInsetDp,
    )

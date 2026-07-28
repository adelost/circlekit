package com.adelost.designkit.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf

/**
 * One explicit sizing policy for every Circle renderer.
 *
 * Resolution may select [surfaceClass] and therefore how content is arranged,
 * but it never derives the global [atomScale]. Components that are designed as
 * one proportional viewport opt into [CircleContentScale.CanonicalFit] locally;
 * ordinary rows, buttons and type remain fixed atoms.
 */
@Immutable
data class CircleUiProfile(
    val surfaceClass: CircleSurfaceClass,
    val atomScale: Float,
    /** Non-null only when a non-Wear host must emulate the canonical round app. */
    val canonicalRoundViewportDp: Float?,
) {
    init {
        require(atomScale > 0f && atomScale.isFinite())
        require(canonicalRoundViewportDp == null || canonicalRoundViewportDp > 0f)
    }
}

object CircleUiProfiles {
    /** The canon design canvas: every round surface lays out on this logical
     *  size and the HOST scales the whole canvas to the real viewport
     *  (Mattias 2026-07-18: a bigger watch shows the SAME layout larger —
     *  buttons grow, spacing grows, relative sizes never change). Canvas
     *  scaling is the host frame's job (density), which is why [atomScale]
     *  stays 1: atoms never scale themselves. */
    const val CANON_ROUND_CANVAS_DP = 192f

    /** The approved Wear design. Hardware and the phone-hosted Wear debug app share it verbatim. */
    val WatchCanonical = CircleUiProfile(
        surfaceClass = CircleSurfaceClass.ROUND,
        atomScale = 1f,
        canonicalRoundViewportDp = CANON_ROUND_CANVAS_DP,
    )

    /**
     * The two NAMED phone compositions. There is no scale knob: a phone
     * renders ordinary atoms at 1x and gains SPACE. A component may still
     * declare CanonicalFit for its own subtree; that does not create another
     * app profile (circle:4 P1-7: no caller may invent a third profile).
     */
    val PhoneCompact = CircleUiProfile(
        surfaceClass = CircleSurfaceClass.PHONE_COMPACT,
        atomScale = 1f,
        canonicalRoundViewportDp = null,
    )

    val PhoneWide = CircleUiProfile(
        surfaceClass = CircleSurfaceClass.PHONE_WIDE,
        atomScale = 1f,
        canonicalRoundViewportDp = null,
    )

    /** Resolve the named profile for a non-round surface class. */
    fun phoneProfileFor(surfaceClass: CircleSurfaceClass): CircleUiProfile = when (surfaceClass) {
        CircleSurfaceClass.PHONE_COMPACT -> PhoneCompact
        CircleSurfaceClass.PHONE_WIDE -> PhoneWide
        CircleSurfaceClass.ROUND ->
            throw IllegalArgumentException("round surfaces use WatchCanonical, never a phone profile")
    }
}

val LocalCircleUiProfile = staticCompositionLocalOf { CircleUiProfiles.WatchCanonical }

@Composable
@ReadOnlyComposable
fun circleUiProfile(): CircleUiProfile = LocalCircleUiProfile.current

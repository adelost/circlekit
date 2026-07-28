package com.adelost.designkit.ui

/**
 * One optical weight for the segmented altitude ring, its intro counterpart
 * and the compass cues that sit inside it.
 *
 * The value is a fraction of the component's canonical short side rather than
 * a copied dp constant. That lets the 192 dp instrument and the 320-unit intro
 * mark speak exactly the same visual language while each remains scalable as
 * one proportional viewport.
 */
object CircleRadialBarDesign {
    const val StrokeFractionOfShortSide = 0.03515625f
    const val CanonicalInstrumentStrokeDp =
        CircleUiProfiles.CANON_ROUND_CANVAS_DP * StrokeFractionOfShortSide

    fun strokeForShortSide(shortSide: Float, weightScale: Float = 1f): Float {
        require(shortSide > 0f && shortSide.isFinite())
        require(weightScale > 0f && weightScale.isFinite())
        return shortSide * StrokeFractionOfShortSide * weightScale
    }
}

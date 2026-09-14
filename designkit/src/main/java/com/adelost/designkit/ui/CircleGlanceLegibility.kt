package com.adelost.designkit.ui

import kotlin.math.ceil
import kotlin.math.tan

/**
 * Round menu row type, DERIVED from the smallest watch it must stay readable
 * on rather than picked (Mattias 2026-09-14: "försök ändå räkna ut vad som
 * hade varit optimal storlek men ändå tillåta dig att läsa bättre").
 *
 * The round canvas is always [CircleUiProfiles.CANON_ROUND_CANVAS_DP] logical
 * dp scaled to the physical face, so the smallest face draws the smallest
 * letters. The floors are angular letter sizes at the viewing distance; the
 * derivation and its assumptions are in
 * docs/decisions/2026-09-14-round-menu-back-layer.md.
 */
object CircleGlanceLegibility {
    /** 1.2 in across: the smallest supported round watch face. */
    const val SMALLEST_FACE_DIAMETER_MM: Float = 30.48f

    /** A glance at a raised wrist. */
    const val VIEWING_DISTANCE_MM: Float = 300f

    /** Onest OS/2 metrics (res/font/onest.ttf, 1000 units per em). */
    const val CAP_HEIGHT_EM: Float = 0.707f
    const val X_HEIGHT_EM: Float = 0.527f

    /** A short bold uppercase identity, read at a glance. */
    const val TITLE_CAP_HEIGHT_ARCMIN: Float = 12f

    /** Mixed-case supporting value: its lowercase body is what must resolve. */
    const val VALUE_X_HEIGHT_ARCMIN: Float = 8f

    /** Antialiasing and density rounding eat a little of every letter. */
    const val RENDERING_MARGIN: Float = 1.05f

    const val SP_STEP: Float = 0.5f

    private val mmPerCanvasDp: Float
        get() = SMALLEST_FACE_DIAMETER_MM / CircleUiProfiles.CANON_ROUND_CANVAS_DP

    private val mmPerArcmin: Float
        get() = (VIEWING_DISTANCE_MM * tan(Math.toRadians(1.0 / 60.0))).toFloat()

    /** Angular height of a letter part ([letterEm] of the em) at [sp] on the smallest face. */
    fun letterArcmin(sp: Float, letterEm: Float): Float = sp * mmPerCanvasDp * letterEm / mmPerArcmin

    /** The smallest [SP_STEP] size whose letter part clears [floorArcmin] with the rendering margin. */
    fun smallestReadableSp(floorArcmin: Float, letterEm: Float): Float {
        val exact = floorArcmin * RENDERING_MARGIN * mmPerArcmin / (mmPerCanvasDp * letterEm)
        return ceil(exact / SP_STEP) * SP_STEP
    }

    val rowTitleSp: Float = smallestReadableSp(TITLE_CAP_HEIGHT_ARCMIN, CAP_HEIGHT_EM)
    val rowValueSp: Float = smallestReadableSp(VALUE_X_HEIGHT_ARCMIN, X_HEIGHT_EM)
}

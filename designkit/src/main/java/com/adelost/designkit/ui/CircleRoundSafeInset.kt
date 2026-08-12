package com.adelost.designkit.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.layout.findRootCoordinates
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Twelve angular slots around a round face. Rim controls align to clock
 * positions instead of ad hoc degrees, and the shared names let CONTENT ask
 * which positions are occupied instead of guessing a margin.
 */
enum class CircleChromeSlot(val angleFromTopDeg: Float) {
    HOUR_12(0f),
    HOUR_1(30f),
    HOUR_2(60f),
    HOUR_3(90f),
    HOUR_4(120f),
    HOUR_5(150f),
    HOUR_6(180f),
    HOUR_7(210f),
    HOUR_8(240f),
    HOUR_9(270f),
    HOUR_10(300f),
    HOUR_11(330f),
}

/**
 * The chrome reservation in force for the content below it, published by the
 * shell that MOUNTS the floating buttons. Content reads it and steps aside; it
 * never restates geometry it does not own. Empty by default — a surface
 * without floating chrome (phone hosts, previews, tests) reserves nothing.
 */
val LocalRoundChromeReservation = compositionLocalOf<List<CircleChromeSlot>> { emptyList() }

/** Directional edge claims for content inside a round viewport. */
data class CircleHorizontalInsetsDp(
    val start: Float,
    val end: Float,
)

/**
 * ONE answer to "how close to the edge may content sit at this height?".
 *
 * A round face takes width away twice, and both bites depend on the height:
 * the circle narrows toward top and bottom, and the floating chrome buttons
 * claim their own bands mid-face. A per-SCREEN constant is wrong in both
 * directions at once — too narrow in the middle, too wide at the ends — so
 * this is always evaluated at a given content centre.
 */
fun roundSafeInsetDp(
    viewportWidthDp: Float,
    viewportHeightDp: Float,
    contentCenterYDp: Float,
    reservedSlots: List<CircleChromeSlot>,
    buttonDiameterDp: Float = MenuDesign.watchActionRingDiameter.value,
    gapDp: Float = ROUND_SAFE_CONTENT_GAP_DP,
): Float = roundSafeHorizontalInsetsDp(
    viewportWidthDp = viewportWidthDp,
    viewportHeightDp = viewportHeightDp,
    contentCenterYDp = contentCenterYDp,
    reservedSlots = reservedSlots,
    buttonDiameterDp = buttonDiameterDp,
    gapDp = gapDp,
).let { maxOf(it.start, it.end) }

/**
 * The exact start/end clearance at one height. The circle itself is symmetric;
 * floating chrome is not. Mirroring X@9's left-side claim onto the free right
 * edge made a narrow watch row pay for the same button twice and ellipsise copy
 * that physically fit. Each edge now pays only for what is mounted there.
 */
fun roundSafeHorizontalInsetsDp(
    viewportWidthDp: Float,
    viewportHeightDp: Float,
    contentCenterYDp: Float,
    reservedSlots: List<CircleChromeSlot>,
    buttonDiameterDp: Float = MenuDesign.watchActionRingDiameter.value,
    gapDp: Float = ROUND_SAFE_CONTENT_GAP_DP,
): CircleHorizontalInsetsDp {
    val chord = roundChordInsetDp(viewportWidthDp, viewportHeightDp, contentCenterYDp)
    val chrome = roundChromeHorizontalInsetsDp(
        viewportWidthDp = viewportWidthDp,
        viewportHeightDp = viewportHeightDp,
        contentCenterYDp = contentCenterYDp,
        reservedSlots = reservedSlots,
        buttonDiameterDp = buttonDiameterDp,
        gapDp = gapDp,
    )
    return CircleHorizontalInsetsDp(
        start = maxOf(chord, chrome.start),
        end = maxOf(chord, chrome.end),
    )
}

/**
 * Directional clearance for a rectangle, including every point across its
 * height. This is the stable-plot counterpart to [roundSafeHorizontalInsetsDp]:
 * a tall plot must clear rim chrome that intersects its top or bottom even
 * when the plot centre itself is outside the button's band.
 */
fun roundSafeRectHorizontalInsetsDp(
    viewportWidthDp: Float,
    viewportHeightDp: Float,
    contentCenterYDp: Float,
    contentHeightDp: Float,
    reservedSlots: List<CircleChromeSlot>,
    buttonDiameterDp: Float = MenuDesign.watchActionRingDiameter.value,
    gapDp: Float = ROUND_SAFE_CONTENT_GAP_DP,
): CircleHorizontalInsetsDp {
    if (viewportWidthDp <= 0f || viewportHeightDp <= 0f || contentHeightDp <= 0f) {
        return CircleHorizontalInsetsDp(0f, 0f)
    }
    val halfHeightDp = contentHeightDp / 2f
    val topDp = contentCenterYDp - halfHeightDp
    val bottomDp = contentCenterYDp + halfHeightDp
    val chord = maxOf(
        roundChordInsetDp(viewportWidthDp, viewportHeightDp, topDp),
        roundChordInsetDp(viewportWidthDp, viewportHeightDp, bottomDp),
    )
    val chrome = roundChromeHorizontalInsetsForHalfHeightDp(
        viewportWidthDp = viewportWidthDp,
        viewportHeightDp = viewportHeightDp,
        contentCenterYDp = contentCenterYDp,
        contentHalfHeightDp = halfHeightDp,
        reservedSlots = reservedSlots,
        buttonDiameterDp = buttonDiameterDp,
        gapDp = gapDp,
    )
    return CircleHorizontalInsetsDp(
        start = maxOf(chord, chrome.start),
        end = maxOf(chord, chrome.end),
    )
}

/**
 * Half the chord of a circle at [distanceFromCenter] from its centre.
 *
 * The one primitive every round-geometry question reduces to. Unit-neutral:
 * px in gives px out, dp in gives dp out. Everything else here — the inset a
 * row needs, the height at which a width fits, how far a rim button must be
 * pulled in — is this formula read differently, so it exists once.
 */
fun circleHalfChord(radius: Float, distanceFromCenter: Float): Float {
    if (radius <= 0f) return 0f
    val clamped = abs(distanceFromCenter).coerceAtMost(radius)
    return sqrt((radius * radius - clamped * clamped).coerceAtLeast(0f))
}

/** The circle's own bite at this height: how far its chord is from the box. */
fun roundChordInsetDp(
    viewportWidthDp: Float,
    viewportHeightDp: Float,
    contentCenterYDp: Float,
): Float {
    if (viewportWidthDp <= 0f || viewportHeightDp <= 0f) return 0f
    val radiusDp = minOf(viewportWidthDp, viewportHeightDp) / 2f
    return radiusDp - circleHalfChord(radiusDp, contentCenterYDp - viewportHeightDp / 2f)
}

/**
 * The chrome's bite at this height: zero unless a reserved button overlaps the
 * content vertically, so a button at 6 o'clock cannot narrow a row at the top.
 * Kept as a scalar compatibility answer for centred callers; directional row
 * layout uses [roundChromeHorizontalInsetsDp].
 */
fun roundChromeInsetDp(
    viewportWidthDp: Float,
    viewportHeightDp: Float,
    contentCenterYDp: Float,
    reservedSlots: List<CircleChromeSlot>,
    buttonDiameterDp: Float = MenuDesign.watchActionRingDiameter.value,
    gapDp: Float = ROUND_SAFE_CONTENT_GAP_DP,
): Float = roundChromeHorizontalInsetsDp(
    viewportWidthDp = viewportWidthDp,
    viewportHeightDp = viewportHeightDp,
    contentCenterYDp = contentCenterYDp,
    reservedSlots = reservedSlots,
    buttonDiameterDp = buttonDiameterDp,
    gapDp = gapDp,
).let { maxOf(it.start, it.end) }

/** The chrome claim split by the edge on which each mounted slot lives. */
fun roundChromeHorizontalInsetsDp(
    viewportWidthDp: Float,
    viewportHeightDp: Float,
    contentCenterYDp: Float,
    reservedSlots: List<CircleChromeSlot>,
    buttonDiameterDp: Float = MenuDesign.watchActionRingDiameter.value,
    gapDp: Float = ROUND_SAFE_CONTENT_GAP_DP,
): CircleHorizontalInsetsDp = roundChromeHorizontalInsetsForHalfHeightDp(
    viewportWidthDp = viewportWidthDp,
    viewportHeightDp = viewportHeightDp,
    contentCenterYDp = contentCenterYDp,
    contentHalfHeightDp = 0f,
    reservedSlots = reservedSlots,
    buttonDiameterDp = buttonDiameterDp,
    gapDp = gapDp,
)

private fun roundChromeHorizontalInsetsForHalfHeightDp(
    viewportWidthDp: Float,
    viewportHeightDp: Float,
    contentCenterYDp: Float,
    contentHalfHeightDp: Float,
    reservedSlots: List<CircleChromeSlot>,
    buttonDiameterDp: Float,
    gapDp: Float,
): CircleHorizontalInsetsDp {
    if (viewportWidthDp <= 0f || viewportHeightDp <= 0f || reservedSlots.isEmpty()) {
        return CircleHorizontalInsetsDp(0f, 0f)
    }
    val buttonRadiusDp = buttonDiameterDp / 2f
    val centerXDp = viewportWidthDp / 2f
    val centerYDp = viewportHeightDp / 2f
    val slotRadiusDp =
        minOf(viewportWidthDp, viewportHeightDp) / 2f * RadialChromeDesign.slotRadiusFraction
    var start = 0f
    var end = 0f
    reservedSlots.forEach { slot ->
        val angleRad = Math.toRadians(slot.angleFromTopDeg.toDouble())
        val slotXDp = centerXDp + slotRadiusDp * sin(angleRad).toFloat()
        val slotYDp = centerYDp - slotRadiusDp * cos(angleRad).toFloat()
        if (abs(contentCenterYDp - slotYDp) <= contentHalfHeightDp + buttonRadiusDp + gapDp) {
            if (slotXDp <= centerXDp) {
                start = maxOf(start, (slotXDp + buttonRadiusDp + gapDp).coerceAtLeast(0f))
            } else {
                end = maxOf(
                    end,
                    (viewportWidthDp - (slotXDp - buttonRadiusDp - gapDp)).coerceAtLeast(0f),
                )
            }
        }
    }
    return CircleHorizontalInsetsDp(start, end)
}

/**
 * The same chord, solved for the other unknown: the vertical inset from the
 * top of a round frame at which a centred block of [contentWidthDp] first
 * fits fully inside the circle. `d = (D - sqrt(D^2 - w^2)) / 2`.
 *
 * [roundChordInsetDp] answers "how much width does the circle take at this
 * height"; this answers "at what height does this width fit". Same geometry,
 * dual forms — so they live together, and a caller can never solve one of
 * them again locally with a slightly different rounding.
 *
 * RingKit screens live inside a round frame on EVERY form factor (the watch
 * physically, the phone via the WatchFrame simulation), so a full-width row
 * laid out above this depth gets its corners and text eaten by the arc
 * (Mattias 2026-07-10: "VIBRATION" rendered as "…ATION").
 */
fun circleSafeTopInsetDp(diameterDp: Float, contentWidthDp: Float): Float {
    if (diameterDp <= 0f || contentWidthDp <= 0f) return 0f
    // Wider than the frame never fits: the widest chord is the centre line.
    if (contentWidthDp >= diameterDp) return diameterDp / 2f
    // Same primitive, read the other way: the half-chord for HALF the width
    // is the vertical distance from the centre at which that width still fits.
    return diameterDp / 2f - circleHalfChord(diameterDp / 2f, contentWidthDp / 2f)
}

/** Breathing room between a chrome button and the nearest content. */
const val ROUND_SAFE_CONTENT_GAP_DP = 4f

/**
 * Keep this content clear of the round face's edge AND of the floating chrome,
 * measured at wherever the content actually lands.
 *
 * This is the atom every scrolling surface uses — lazy lists, menu rows,
 * grids — so "how wide may I be here" has exactly one implementation. It
 * measures its own position, which is what lets a single modifier serve a lazy
 * list and a plain scrolling column alike.
 *
 * [baseInsetDp] is padding the caller already applies; only the surplus is
 * added, so a surface's own margin is never counted twice.
 */
fun Modifier.roundSafeContentInset(
    enabled: Boolean = true,
    baseInsetDp: Float = 0f,
): Modifier = composed {
    if (!enabled) {
        this
    } else {
        val reservedSlots = LocalRoundChromeReservation.current
        val density = LocalDensity.current.density
        var extraInsets by remember(reservedSlots, baseInsetDp) {
            mutableStateOf(CircleHorizontalInsetsDp(0f, 0f))
        }
        this
            .onGloballyPositioned { coordinates ->
                val root = coordinates.findRootCoordinates()
                val topInRootPx = root.localPositionOf(coordinates, Offset.Zero).y
                val safe = roundSafeHorizontalInsetsDp(
                    viewportWidthDp = root.size.width / density,
                    viewportHeightDp = root.size.height / density,
                    contentCenterYDp = (topInRootPx + coordinates.size.height / 2f) / density,
                    reservedSlots = reservedSlots,
                )
                extraInsets = CircleHorizontalInsetsDp(
                    start = (safe.start - baseInsetDp).coerceAtLeast(0f),
                    end = (safe.end - baseInsetDp).coerceAtLeast(0f),
                )
            }
            .padding(start = extraInsets.start.dp, end = extraInsets.end.dp)
    }
}

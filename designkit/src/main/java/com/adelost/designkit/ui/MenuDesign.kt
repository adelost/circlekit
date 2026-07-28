package com.adelost.designkit.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** One form-factor-neutral design spec for the canonical Circle menu row. */
object MenuDesign {
    /** Calm centred composition shared by menu grids on every host.
     * The remaining 25% is split symmetrically by the renderer. */
    const val centeredGridWidthFraction: Float = 0.75f

    val rowInsetH: Dp = 26.dp
    val rowPaddingH: Dp = 2.dp
    val rowPaddingV: Dp = 4.dp

    /** THE watch action-ring standard: the home screen's rim buttons
     *  (HOME_SLOT_BUTTON_DP app-side). Every watch grid, menu option, icon
     *  ring and launcher uses this one size — the watch has exactly one
     *  action-ring diameter (Mattias 2026-07-23: "knapparna är för stora...
     *  normalisera all storlek för all klock ux så knapparna på huvudsidan
     *  är standard storleken"). Rectangular hosts keep their own 56 dp
     *  standard via phoneSurfaceDesign, never this token. */
    val watchActionRingDiameter: Dp = 30.dp

    val iconRingDiameter: Dp = watchActionRingDiameter
    val iconRingStroke: Dp = 1.5.dp
    val contourStroke: Dp = 1.dp
    val iconSize: Dp = 14.dp
    val rowCenterValueSize: TextUnit = 7.5.sp
    val iconTextGap: Dp = 8.dp

    val statRingDiameter: Dp = 46.dp
    val statValueSize: TextUnit = 12.sp
    val launcherDiameter: Dp = watchActionRingDiameter
    val cornerDiameter: Dp = watchActionRingDiameter
    val stepperIconSize: Dp = 10.dp
    val stepperIconGap: Dp = 3.dp
    // 10 sp keeps "12.0 m/s" on one line inside the narrowed ROUND settings
    // rows (36 dp insets leave a 60 dp value column; 12 sp wrapped mid-unit).
    val stepperValueSize: TextUnit = 10.sp

    val titleSize: TextUnit = 11.sp
    val titleSizeNoIcon: TextUnit = 12.sp
    val titleTracking: TextUnit = 0.2.sp
    val subSize: TextUnit = 9.5.sp
    /** Round titles clear the physical circle chord. This is content
     * geometry, not a top shelf or navigation-crown reserve. */
    val roundTitleTopPadding: Dp = 26.dp

    /** The title's own line box at 11 sp bold. Everything below it is the row
     *  band, which is what a rows list has to size its straight edge for. */
    val roundTitleHeight: Dp = 14.dp

    val ringActive: Color = RingTokens.Accent
    val ringResting: Color = RingTokens.Outline
    val ringNeutral: Color = RingTokens.NeutralRing

    /** What [circleRingContour] actually leaves on screen: the circle clip eats
     * the outer half of [iconRingStroke]. A straight line that must read as
     * the SAME chrome as the icon rings is drawn at this width, not at the
     * stroke the arc is issued with (Mattias 2026-07-21: "samma som gråa
     * strecket runt ikoner.. samma tjocklek också"). */
    val contourHairline: Dp = iconRingStroke / 2

    // THE press-and-hold ladder. Every hold in the product is one of these
    // rungs — no control invents its own number.

    /** Advancing a settings choice (RingChoiceRow and friends). */
    const val holdDeliberateMs: Long = 500L

    /** Every plain action's short intent gate, via [circleSafeTap]. It remains
     * visibly different from an instant touch, without making navigation feel
     * like a confirmation gesture. Settings choices keep their deliberate
     * half-second rung below; destructive actions stay longer still. */
    const val tapHoldMs: Long = 200L

    /** Brief centre acknowledgement after either action category commits. */
    const val actionConfirmationMs: Long = 240L

    /**
     * How long the centre cue stays up after an action that had something to
     * SAY — a new state, or a sentence explaining itself.
     *
     * 240 ms is enough to register that something happened and far too short
     * to read what (Mattias 2026-07-27: "istället för att den försvinner lika
     * snabbt så kanske den ska dröja kvar en liten stund ... om man hade råkat
     * trigga den"). This is the dwell for the accidental press: long enough to
     * read the result, short enough that a deliberate press does not feel
     * blocked.
     */
    const val actionExplainMs: Long = 1_600L

    /**
     * How long a hint may be before the centre cue ellipsises it.
     *
     * The cue reads four lines at 10 sp, which is where the chord clearance
     * below the ring runs out — roughly 90 characters on the shipped face.
     * Past that a row loses the end of the very sentence it exists to
     * deliver: SPOT stopped at "Your PULL height ca…".
     *
     * The cue is shared, so the budget is shared. It lived in the ISO option
     * catalogue, which was the only place paying it, while the settings hints
     * ran to 111 and 132 characters and were silently cut (menu UX audit
     * 2026-07-27, finding 10).
     */
    const val hintMaxChars: Int = 90

    /** Destructive / state-swapping pills (HoldPill). */
    const val holdDestructiveMs: Long = 900L

    /** Hold-to-confirm edge actions — screen unlock, home-set. */
    const val holdConfirmMs: Long = 1_000L

    val backDiameter: Dp = 40.dp
    val backDiameterCompact: Dp = 34.dp
    val backChevronSize: Dp = 18.dp
    val backTouchTarget: Dp = 48.dp
    const val backPressScale: Float = 0.93f
    const val backHoldMs: Long = holdDeliberateMs
    val overlayScrim: Color = Color.Black.copy(alpha = 0.45f)
    val textActionSize: TextUnit = 10.5.sp
    val textActionTracking: TextUnit = 1.5.sp
}

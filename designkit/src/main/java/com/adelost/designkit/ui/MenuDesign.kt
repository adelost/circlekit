package com.adelost.designkit.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.PI
import kotlin.math.cos

/** WHAT: Defines form-factor-neutral Circle menu dimensions. WHY: Keeps renderers from inventing competing geometry. */
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
    /** Transient explanation affordance shown only on the last-touched row. */
    val rowInfoDiameter: Dp = 22.dp
    val rowInfoIconSize: Dp = 10.dp
    val rowCenterValueSize: TextUnit = 7.5.sp
    val iconTextGap: Dp = 8.dp
    val roundMediaContentWidth: Dp = 112.dp
    val mediaTrackHeight: Dp = 3.dp
    val mediaContentGap: Dp = 4.dp

    val statRingDiameter: Dp = 46.dp
    /** The round STATUS hub's content column: two stat rings close enough to the centre that their labels fit the chord. */
    val roundStatusGridMaxWidth: Dp = 128.dp
    val statValueSize: TextUnit = 12.sp
    val statLabelSize: TextUnit = 6.5.sp
    val launcherDiameter: Dp = watchActionRingDiameter
    val cornerDiameter: Dp = watchActionRingDiameter
    val stepperIconSize: Dp = 10.dp
    val stepperIconGap: Dp = 3.dp
    // 10 sp keeps "12.0 m/s" on one line inside the narrowed ROUND settings
    // rows (36 dp insets leave a 60 dp value column; 12 sp wrapped mid-unit).
    val stepperValueSize: TextUnit = 10.sp

    /** Derived from the smallest supported watch, see [CircleGlanceLegibility]
     *  (10 sp; was 11 sp before Mattias 2026-09-14 asked for smaller rows). */
    val titleSize: TextUnit = CircleGlanceLegibility.rowTitleSp.sp
    /** A row without an icon keeps its one-step larger identity (11 sp; was 12). */
    val titleSizeNoIcon: TextUnit = (CircleGlanceLegibility.rowTitleSp + 1f).sp
    val titleTracking: TextUnit = 0.2.sp
    /** Derived like [titleSize] (9 sp; was 9.5 sp). */
    val subSize: TextUnit = CircleGlanceLegibility.rowValueSp.sp

    /**
     * Maximum authored label for the compact option rows on a 192 dp round
     * face. A longer label already ellipsises at the shipped font/geometry;
     * the product should name the question briefly and leave detail to the
     * value and hint.
     */
    const val menuOptionLabelMaxChars: Int = 11

    /**
     * Maximum one-glance action name in the centre cue. The cue has two lines
     * in its 96 dp text column, while authored action names intentionally fit
     * on one. This is distinct from row titles, which may use wider host
     * geometry and are not governed by this budget.
     */
    const val actionCueLabelMaxChars: Int = 12
    /** Round titles clear the physical circle chord. This is content
     * geometry, not a top shelf or navigation-crown reserve. */
    val roundTitleTopPadding: Dp = 26.dp

    /** The title's own line box at 11 sp bold. Everything below it is the row
     *  band, which is what a rows list has to size its straight edge for. */
    val roundTitleHeight: Dp = 14.dp

    /**
     * The shared round escape's centre, from the canvas top. It is its own
     * layer at 12 o'clock (Mattias 2026-09-14: "bakknappen ska väl vara ett
     * eget lager"): the circle is already narrow there, so it costs rows no
     * width, and its whole [backTouchTarget] lies on the canvas.
     */
    val roundBackLayerCenterY: Dp = 24.dp

    /** Where content that must be visible at rest (the title) starts under the escape. */
    val roundBackLayerContentTop: Dp = roundBackLayerCenterY + watchActionRingDiameter / 2 + 4.dp

    /** The escape's cap fades out here: inside the resting title's line box, above its letters. */
    val roundBackLayerCapBottom: Dp = roundBackLayerContentTop + 2.dp

    /**
     * How far around the face one companion seat sits from the escape: one
     * clock hour, the kit's own unit for rim placement.
     *
     * Mattias 2026-09-17, on a JUMP LOG picture: "om det går att få in tre
     * knappar ganska litet bredvid varandra i toppen liksom ... bak-knapp,
     * settings-knapp och sen kanske rotationsknapp", and "helst vill vi ha
     * samma storlek på alla cirklarna". So the run is three seats of ONE
     * diameter, and the step has to be the largest the glass can hold.
     *
     * Measured on the 192 dp canon, where the escape's centre is 24 dp from the
     * top, i.e. 72 dp from the face centre. A seat one hour along that same
     * radius lands 36.0 dp sideways and 33.6 dp down, 87.0 dp from the centre
     * with its ink, so it clears the 96 dp glass by 9.0 dp. Its neighbours'
     * centres are 37.3 dp apart, wider than the 30 dp discs, so no two seats'
     * targets overlap.
     *
     * A FOURTH seat is refused for two reasons, and neither is the glass edge:
     * every seat on this radius keeps its ink 87.0 dp from the centre however
     * far around it sits. First, an even run has no seat at twelve, so the
     * escape would have to leave the place it has held since 2026-09-14.
     * Second, the next odd run, five, puts its outer seats two hours out, where
     * their ink ends 65.1 dp down: past the title and into the scrolling row
     * band, which is the exact cost this layer exists to avoid ("de andra
     * meny-itemsen ska inte tryckas undan"). So the run is one seat or three,
     * and [roundTopRunMaxSeats] is what says so.
     */
    val roundTopRunStepDeg: Float = 30f

    /** Three seats: eleven, twelve, one. There is no fourth on a 192 dp face. */
    const val roundTopRunMaxSeats: Int = 3

    /** The run's radius: the escape's own distance from the face centre. */
    val roundTopRunRadius: Dp =
        (CircleUiProfiles.CANON_ROUND_CANVAS_DP / 2f).dp - roundBackLayerCenterY

    /** A companion seat's centre, from the canvas top. Derived, never typed. */
    val roundTopRunSeatCenterY: Dp = (
        CircleUiProfiles.CANON_ROUND_CANVAS_DP / 2f -
            roundTopRunRadius.value * cos(roundTopRunStepDeg * PI.toFloat() / 180f)
        ).dp

    /**
     * Where a title starts on a page that fills a companion seat.
     *
     * A companion's centre is lower than the escape's (the run follows the
     * face), so its ink ends lower too, and a centred title would otherwise
     * run into it. Derived, never typed: the seat's own bottom plus the same
     * 4 dp of air [roundBackLayerContentTop] uses.
     */
    val roundTopRunContentTop: Dp =
        roundTopRunSeatCenterY + watchActionRingDiameter / 2 + 4.dp

    val ringActive: Color = RingTokens.Accent
    val ringResting: Color = RingTokens.Outline
    val ringNeutral: Color = RingTokens.NeutralRing

    /** What [circleRingContour] actually leaves on screen: the circle clip eats
     * the outer half of [iconRingStroke]. A straight line that must read as
     * the SAME chrome as the icon rings is drawn at this width, not at the
     * stroke the arc is issued with (Mattias 2026-07-21: "samma som gråa
     * strecket runt ikoner.. samma tjocklek också"). */
    val contourHairline: Dp = iconRingStroke / 2

    /** The one suggested-contour dash: drawn mark, then gap. A suggestion is
     * read as geometry, so every product's suggested ring dashes the same. */
    val suggestedDashOn: Dp = 3.4.dp
    val suggestedDashOff: Dp = 2.6.dp

    // THE press-and-hold ladder. Every hold in the product is one of these
    // rungs — no control invents its own number.

    /** Advancing a settings choice (RingChoiceRow and friends). */
    const val holdDeliberateMs: Long = 500L

    /** The info icon is deliberately harder to open than an ordinary row. */
    const val rowInfoHoldMs: Long = holdDeliberateMs

    /** Every plain action's short intent gate, via [circleSafeTap]. It remains
     * visibly different from an instant touch, without making navigation feel
     * like a confirmation gesture. Settings choices keep their deliberate
     * half-second rung below; destructive actions stay longer still. */
    const val wornTouchCostMs: Long = 200L

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

    /** Glanced UI copy, read at arm's length on a watch face. */
    private const val hintReadCharsPerSecond: Float = 30f

    /**
     * How long a cue that carries a SENTENCE needs to stay up, DERIVED from
     * the budget that sentence is written to rather than picked.
     *
     * [actionExplainMs] is the dwell for a new VALUE — a word you recognise
     * rather than read. A worst-case [hintMaxChars] hint is a different amount
     * of reading, and sizing both with one number means either the value feels
     * sticky or the sentence disappears half-read. This moves with the budget:
     * widen the hint and the window widens with it.
     */
    const val hintReadingMs: Long =
        (hintMaxChars / hintReadCharsPerSecond * 1_000f).toLong()

    /** Fail at the authoring seam instead of shipping a truncated option. */
    fun requireMenuOptionLabel(label: String, owner: String) {
        require(label.length <= menuOptionLabelMaxChars) {
            "$owner label '$label' has ${label.length} characters; the round option budget is " +
                "$menuOptionLabelMaxChars"
        }
    }

    /** Fail at the authoring seam instead of shipping an unreadable cue. */
    fun requireActionCueLabel(label: String, owner: String) {
        require(label.length <= actionCueLabelMaxChars) {
            "$owner cue '$label' has ${label.length} characters; the action-cue budget is " +
                "$actionCueLabelMaxChars"
        }
    }

    /** Destructive / state-swapping pills (HoldPill). */
    const val holdDestructiveMs: Long = 900L

    /** Hold-to-confirm edge actions — screen unlock, home-set. */
    const val holdConfirmMs: Long = 1_000L

    val backDiameter: Dp = watchActionRingDiameter
    val backDiameterCompact: Dp = watchActionRingDiameter
    val backChevronSize: Dp = iconSize
    val backTouchTarget: Dp = 48.dp
    const val backPressScale: Float = 0.93f
    const val backHoldMs: Long = holdDeliberateMs
    val overlayScrim: Color = Color.Black.copy(alpha = 0.45f)
    val actionCueScrim: Color = Color.Black
    val textActionSize: TextUnit = 10.5.sp
    val textActionTracking: TextUnit = 1.5.sp
}

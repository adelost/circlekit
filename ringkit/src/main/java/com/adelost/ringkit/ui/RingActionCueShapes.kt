package com.adelost.ringkit.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Icon
import androidx.wear.compose.material.Text
import com.adelost.designkit.ui.CircleAccent
import com.adelost.designkit.ui.CircleAccentStrength
import com.adelost.designkit.ui.CircleActionCue
import com.adelost.designkit.ui.CircleChoiceState
import com.adelost.designkit.ui.CircleSurfaceClass
import com.adelost.designkit.ui.LocalCircleSurfaceLayout
import com.adelost.designkit.ui.LocalRoundChromeReservation
import com.adelost.designkit.ui.ROUND_SAFE_CONTENT_GAP_DP
import com.adelost.designkit.ui.RingTokens
import com.adelost.designkit.ui.circleAccentColor
import com.adelost.designkit.ui.circleBrandColor
import com.adelost.designkit.ui.roundSafeInsetDp

/** The disc a bare cue sits on, so a single word reads over any scene. */
internal val RING_CUE_SURFACE_COLOR = RingTokens.ProgressSurface

/**
 * The three shapes the one centre cue takes. [RingActionCueHost] owns WHEN a
 * cue is shown and for how long; this file owns what it looks like.
 *
 * Explaining and confirming are opposite jobs, so they get opposite shapes.
 *
 * BEFORE the action commits, nothing has happened yet and the reader is
 * deciding — covering the surface is free, and the space buys a full sentence.
 *
 * AFTER it commits, the reader wants to see WHAT THEY JUST DID. A menu option
 * usually changes the scene behind the overlay, so a covering confirmation
 * hides the very thing it is confirming (Mattias 2026-07-27: "sabbar det när
 * man klickar fel?" — it did: a mistap blacked out the screen for 1.6 s and
 * then revealed a scene you never saw change). The settled cue therefore
 * floats: it names what moved and where it landed, over a visible result.
 *
 * A settled cue that also has a SENTENCE takes the middle shape. The row's
 * explanation was published with every confirmation and thrown away here, so
 * the only way to read what an option meant was to hold it long enough to
 * decide against it (Mattias 2026-08-06: "långtryck visar redan förklaringen
 * i mitten — det som saknas är att en vanlig dutt visar den kort").
 */
internal enum class RingActionCueShape { DECIDING, SETTLED_EXPLAIN, BARE }

/**
 * Which shape a cue takes, as a decision separate from the drawing.
 *
 * Pulled out because the defect it prevents is not a pixel one: the sentence
 * was published, carried all the way here, and dropped by the last `when`.
 * A rendering test cannot see that; this can.
 */
internal fun ringActionCueShapeFor(cue: CircleActionCue): RingActionCueShape = when {
    // A lingering answer is NOT a decision in progress. The deciding shape
    // reveals its sentence as a function of hold progress (see
    // [explainReveal]), which is right while a ring is filling and wrong for
    // an answer to a press that already ended: its progress is honestly zero,
    // so the deciding shape drew it perfectly and invisibly. Measured on
    // wear34 -- the cue was published, carried, and rendered at zero alpha.
    cue.lingers -> RingActionCueShape.SETTLED_EXPLAIN
    cue.explains && !cue.confirmed -> RingActionCueShape.DECIDING
    cue.hint != null -> RingActionCueShape.SETTLED_EXPLAIN
    else -> RingActionCueShape.BARE
}

@Composable
internal fun RingActionCueContent(cue: CircleActionCue) {
    when (ringActionCueShapeFor(cue)) {
        RingActionCueShape.DECIDING -> RingExplainingCue(cue)
        RingActionCueShape.SETTLED_EXPLAIN -> RingSettledExplainCue(cue)
        RingActionCueShape.BARE -> RingBareCue(cue)
    }
}

/**
 * The acknowledgement for a control that has nothing to add: a ring, its icon
 * and its verb.
 *
 * The icon and text are one centred column inside the ring. Previously the
 * icon was centred alone and a second, tiny text block offset down across it.
 * Keep the existing 114 dp footprint clear of the dial controls; no caption
 * outside the badge or second overlay owner (Mattias 2026-09-11).
 */
@Composable
private fun RingBareCue(cue: CircleActionCue) {
    val ringSize = 104.dp
    Box(contentAlignment = Alignment.Center) {
        Box(
            Modifier
                .size(114.dp)
                .background(RING_CUE_SURFACE_COLOR.copy(alpha = 1f), CircleShape),
        )
        ProgressRing(
            progress = cue.progress,
            diameter = ringSize,
            trackWidth = 6.dp,
            progressWidth = 6.dp,
            progressColor = cue.ringColor(),
        )
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(3.dp),
            modifier = Modifier.widthIn(max = 76.dp),
        ) {
            Icon(
                imageVector = cue.icon,
                contentDescription = cue.label,
                tint = cue.inkColor(),
                modifier = Modifier.size(24.dp).rotate(cue.iconRotationDeg),
            )
            Text(
                text = cue.label,
                color = RingTokens.Ink,
                fontSize = 12.sp,
                lineHeight = 13.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 0.5.sp,
                textAlign = TextAlign.Center,
                maxLines = 2,
                // Authored labels are verbs and fit. A few are data — a filter
                // chip carries its tag's name — and those have no length the
                // product controls, so the overflow is stated rather than
                // clipped mid-glyph as if nothing had been cut.
                overflow = TextOverflow.Ellipsis,
            )
            // A switch names its answer three ways at once: glyph, word and
            // its answers below, lit at that same answer (Mattias 2026-09-14, C).
            cue.choiceState?.let { RingActionCueChoiceMark(it, cue.inkColor()) }
            // Where it landed. Without this the lingering confirmation says
            // only that SOMETHING happened, which is the part the reader
            // already knew.
            cue.value?.takeIf { cue.confirmed }?.let { value ->
                Text(
                    text = value,
                    color = cue.ringColor(),
                    fontSize = 11.sp,
                    lineHeight = 12.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.5.sp,
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

/**
 * The settled cue when the row had something to SAY.
 *
 * A CARD rather than the covering shape [RingExplainingCue] uses: the action has
 * already happened, so the face behind is the result and must stay readable.
 * The card takes exactly the room its own words need and leaves the rest.
 *
 * It is also why the sentence is capped shorter here than while deciding — a
 * card that grows to four lines is a scrim with rounded corners.
 */
@Composable
private fun RingSettledExplainCue(cue: CircleActionCue) {
    val sentence = cue.hint ?: return
    BoxWithConstraints(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        val round = LocalCircleSurfaceLayout.current.surfaceClass == CircleSurfaceClass.ROUND
        val diameter = minOf(maxWidth, maxHeight)
        val reserved = LocalRoundChromeReservation.current
        // The card is centred, so its lowest line sits SETTLED_CARD_EXTENT_DP
        // below the middle and that is the height the chord must clear. Asking
        // at the centre line would charge the card nothing for the curve.
        val inset = if (!round) {
            SETTLED_FLAT_MARGIN
        } else {
            roundSafeInsetDp(
                viewportWidthDp = diameter.value,
                viewportHeightDp = maxHeight.value,
                contentCenterYDp = maxHeight.value / 2f + SETTLED_CARD_EXTENT_DP,
                reservedSlots = reserved,
            ).dp
        }
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier
                .padding(horizontal = inset + ROUND_SAFE_CONTENT_GAP_DP.dp)
                .background(SETTLED_CARD_COLOR, RoundedCornerShape(SETTLED_CARD_RADIUS))
                .padding(horizontal = 14.dp, vertical = 12.dp),
        ) {
            Box(contentAlignment = Alignment.Center) {
                ProgressRing(
                    progress = 1f,
                    diameter = SETTLED_RING_DIAMETER,
                    trackWidth = 3.dp,
                    progressWidth = 3.dp,
                    progressColor = cue.ringColor(),
                )
                Icon(
                    imageVector = cue.icon,
                    contentDescription = cue.label,
                    tint = cue.inkColor(),
                    modifier = Modifier.size(18.dp).rotate(cue.iconRotationDeg),
                )
            }
            Text(
                text = cue.label,
                color = cue.inkColor(),
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.8.sp,
                textAlign = TextAlign.Center,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            cue.value?.let { value ->
                Text(
                    text = value,
                    color = cue.ringColor(),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.6.sp,
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Text(
                text = sentence,
                color = RingTokens.Dim,
                fontSize = 10.sp,
                lineHeight = 13.sp,
                textAlign = TextAlign.Center,
                maxLines = SETTLED_HINT_MAX_LINES,
                overflow = TextOverflow.Ellipsis,
            )
            cue.infoAction?.let { action ->
                TextAction(text = action.label, onTap = action.onInvoke)
            }
        }
    }
}

/**
 * The same cue when the control has something to SAY and has not fired yet:
 * name, where it stands, and one sentence about what it does.
 *
 * It covers the face rather than floating over it. That is the honest shape —
 * the cue is answering "what am I about to do?", so the controls it would
 * otherwise collide with are exactly the thing the reader is not using yet.
 * Covering also means the text column can be laid out against the circle
 * instead of squeezed into a disc, which is what kept the old cue down to one
 * 10 sp word.
 *
 * On a round host the column is inset by the chord at each band's own height,
 * so the sentence cannot run into the curve however long it is. A rectangular
 * host keeps a plain margin.
 */
@Composable
private fun RingExplainingCue(cue: CircleActionCue) {
    // Hesitation reveals the help. The explanation ramps in over the first
    // part of the hold, so a confident press sees almost nothing and a press
    // that pauses to think gets the sentence. Without this, every deliberate
    // tap in the product flashed a wall of text at someone who already knew
    // what the row does.
    val reveal = explainReveal(cue.progress)
    BoxWithConstraints(
        modifier = Modifier
            .fillMaxSize()
            // Near-opaque at full reveal. At 0.45 the menu rows behind it read
            // straight through the sentence and the two lists fought for the
            // same pixels; a cue that is answering "what am I about to do?"
            // should own the face while it does.
            .background(EXPLAIN_SCRIM_COLOR.copy(alpha = explainScrimAlpha(reveal))),
        contentAlignment = Alignment.Center,
    ) {
        val round = LocalCircleSurfaceLayout.current.surfaceClass == CircleSurfaceClass.ROUND
        val diameter = minOf(maxWidth, maxHeight)
        val centerYDp = maxHeight.value / 2f
        val reserved = LocalRoundChromeReservation.current

        /**
         * The clearance where a line actually sits, not where the block does.
         *
         * A rectangular host has no curve to clear, and asking the chord atom
         * anyway would charge a tall phone for a circle it does not have — the
         * atom would happily answer using min(w, h) as a diameter. It keeps the
         * plain reading margin instead.
         */
        fun insetAt(offsetFromCenterDp: Float) = if (!round) {
            EXPLAIN_FLAT_MARGIN
        } else {
            roundSafeInsetDp(
                viewportWidthDp = diameter.value,
                viewportHeightDp = maxHeight.value,
                contentCenterYDp = centerYDp + offsetFromCenterDp,
                reservedSlots = reserved,
            ).dp
        }

        // Evaluated per band, because a centred column is only widest on the
        // centre line: the sentence sits well below it, where the circle has
        // already closed in. Measuring once at the middle is what let the
        // hint run off both edges.
        val headInset = insetAt(EXPLAIN_HEAD_EXTENT_DP)
        val hintInset = insetAt(EXPLAIN_HINT_BOTTOM_DP)
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier
                .padding(horizontal = headInset + ROUND_SAFE_CONTENT_GAP_DP.dp)
                .alpha(reveal),
        ) {
            Box(contentAlignment = Alignment.Center) {
                ProgressRing(
                    progress = cue.progress,
                    diameter = EXPLAIN_RING_DIAMETER,
                    trackWidth = 4.dp,
                    progressWidth = 4.dp,
                    progressColor = cue.ringColor(),
                )
                Icon(
                    imageVector = cue.icon,
                    contentDescription = cue.label,
                    tint = cue.inkColor(),
                    modifier = Modifier.size(22.dp).rotate(cue.iconRotationDeg),
                )
            }
            Text(
                text = cue.label,
                color = cue.inkColor(),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
                textAlign = TextAlign.Center,
                maxLines = 1,
            )
            cue.value?.let { value ->
                Text(
                    text = value,
                    color = cue.ringColor(),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 0.6.sp,
                    textAlign = TextAlign.Center,
                    maxLines = 1,
                )
            }
            cue.hint?.let { sentence ->
                Text(
                    text = sentence,
                    color = RingTokens.Dim,
                    fontSize = 10.sp,
                    lineHeight = 13.sp,
                    textAlign = TextAlign.Center,
                    maxLines = EXPLAIN_HINT_MAX_LINES,
                    overflow = TextOverflow.Ellipsis,
                    // The sentence lives lowest, so it pays the deepest chord.
                    modifier = Modifier.padding(
                        horizontal = (hintInset - headInset).coerceAtLeast(0.dp),
                    ),
                )
            }
        }
    }
}

/**
 * Four lines, and the number is COUPLED to [EXPLAIN_HINT_BOTTOM_DP] below:
 * that constant is where the fourth line ends, and it is the height the chord
 * clearance is asked for. Raising one without the other lets the last line
 * clip against the curve — which is what a five-line cap did until skyvw:1
 * did the arithmetic (2026-07-27). The catalogue caps hint length to match.
 */
private const val EXPLAIN_HINT_MAX_LINES = 4
private val EXPLAIN_RING_DIAMETER = 46.dp

/**
 * Where the cue's bands sit relative to the face centre, used to ask the
 * chord atom for clearance at the right height. Both are worst-case, and the
 * second is derived, not guessed: ring 46 + 6 + label 14 + 6 + value 13 + 6 +
 * [EXPLAIN_HINT_MAX_LINES] x 13 sp = ~143 dp tall, centred, so the last line
 * ends ~72 dp below the middle.
 */
private const val EXPLAIN_HEAD_EXTENT_DP = 34f
private const val EXPLAIN_HINT_BOTTOM_DP = 72f

/** A rectangular host's reading margin: bounded by the screen, not a curve. */
private val EXPLAIN_FLAT_MARGIN = 28.dp

/** The cue owns the face while it explains; it is not a floating badge. */
private val EXPLAIN_SCRIM_COLOR = Color.Black
private const val EXPLAIN_SCRIM_ALPHA = 0.93f

/**
 * Three lines, because the settled card is a badge and not a page. Same
 * coupling as the deciding cue: [SETTLED_CARD_EXTENT_DP] is where the third
 * line ends, and it is the height the chord clearance is asked for.
 *
 * Derived: ring 30 + 4 + label 14 + 4 + value 14 + 4 + 3 x 13 sp lines + 12 dp
 * of bottom padding = ~121 dp tall, centred, so the card's lower edge sits
 * ~61 dp below the middle.
 */
private const val SETTLED_HINT_MAX_LINES = 3
private const val SETTLED_CARD_EXTENT_DP = 61f
private val SETTLED_RING_DIAMETER = 30.dp
private val SETTLED_CARD_RADIUS = 18.dp
private val SETTLED_FLAT_MARGIN = 28.dp

/**
 * Opaque enough that the list behind stops competing for the same pixels.
 * The shared [RING_CUE_SURFACE_COLOR] disc sits at 0.72 and works under a
 * single word; a sentence needs the contrast the deciding scrim already uses.
 */
private val SETTLED_CARD_COLOR = Color.Black.copy(alpha = EXPLAIN_SCRIM_ALPHA)

/**
 * How far into the hold the explanation has faded in.
 *
 * Zero until [EXPLAIN_REVEAL_START] of the hold has passed, then ramps to full
 * by [EXPLAIN_REVEAL_FULL]. A press that commits at the normal pace barely
 * shows it; a press that lingers gets the whole sentence. This is the same
 * bargain a tooltip delay makes, and it is what keeps the help from becoming
 * noise on every single deliberate tap in the product.
 */
internal fun explainReveal(progress: Float): Float =
    ((progress - EXPLAIN_REVEAL_START) / (EXPLAIN_REVEAL_FULL - EXPLAIN_REVEAL_START))
        .coerceIn(0f, 1f)

/**
 * The scrim must always be able to CARRY the sentence it sits under.
 *
 * Scrim and text used to ramp on the SAME reveal, so mid-hold the face showed
 * a half-faded sentence over half-faded menu rows — text on text (Mattias
 * 2026-08-17: the ONE FINGER peek over AUTO-UPDATE and UPDATE). The scrim now
 * reaches full strength at half the text's reveal: whenever the sentence is
 * legible at all, the rows behind it are already gone.
 */
internal fun explainScrimAlpha(reveal: Float): Float =
    EXPLAIN_SCRIM_ALPHA * (reveal * 2f).coerceAtMost(1f)

private const val EXPLAIN_REVEAL_START = 0.35f
private const val EXPLAIN_REVEAL_FULL = 0.85f

/** Confirmed recolours to semantic green for the settled cue. */
@Composable
private fun CircleActionCue.ringColor() =
    if (confirmed) circleAccentColor(CircleAccent.POSITIVE, CircleAccentStrength.ACTIVE)
    else com.adelost.designkit.ui.circleBrandColor()

@Composable
private fun CircleActionCue.inkColor() =
    if (confirmed) circleAccentColor(CircleAccent.POSITIVE, CircleAccentStrength.ACTIVE) else RingTokens.Ink

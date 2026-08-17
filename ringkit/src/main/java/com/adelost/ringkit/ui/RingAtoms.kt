package com.adelost.ringkit.ui

import com.adelost.designkit.ui.*

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.onLongClick
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Icon
import androidx.wear.compose.material.Text
import com.adelost.ringkit.data.Health

/** Deliberate-setting gesture: rejects a brush without feeling like a warning. */
const val DELIBERATE_CHANGE_HOLD_MS = MenuDesign.holdDeliberateMs

/**
 * The RingKit atoms (RingKit W2a, spec docs/qa/2026-07-09-ringkit-master/):
 * everything on a round watch is a ring on a black disc. These are the leaf
 * composables every screen is built from — variants are PARAMETERS, never
 * sibling composables (the check-ui-atoms ratchet enforces that).
 *
 * Colour discipline: semantic tokens only ([RingTokens]); a screen never
 * picks its own hex. Colour means STATE — grey until something deviates.
 *
 * Outline language (Mattias 2026-07-15): controls are CONTOURS, not slabs —
 * transparent on the OLED-black disc with a faint ink outline; the selected
 * or active element steps up to [RingTokens.OutlineStrong]. Filled chrome is
 * reserved for the hold-sweep feedback, which stays a translucent wash.
 *
 * Circle amendment (Mattias 2026-07-16: menyerna droppar pillen, cirklar
 * rakt igenom — mockup B): LIST ROWS carry no row contour — each row's icon
 * sits in a RING, the same shape as the launcher and the dial, and a
 * toggle's state IS its ring ([RingRow.ringActive]). Navigation is a quiet
 * chevron ring ([BackRing]); chrome stays reserved for verbs ([HoldPill],
 * steppers).
 *
 * REDESIGN SEAM: every menu dimension/type/state colour lives in
 * [MenuDesign], and only [CircleRingRowContent] (and [BackRing]
 * for the back shape) turn that spec into layout. A new design language
 * edits the spec and those molecules; screens and settings catalogs never
 * change.
 */

/**
 * A data source as a mini-ring: icon + ONE value + the freshness ring.
 * The centre always shows the VALUE; age is the ring colour's job.
 */
@Composable
fun StatRing(
    icon: ImageVector,
    iconRotationDeg: Float = 0f,
    value: String,
    health: Health,
    label: String,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
    diameter: Dp = MenuDesign.statRingDiameter,
) {
    CircleIconRing(
        icon = icon,
        label = label,
        onTap = onTap,
        modifier = modifier,
        diameter = diameter,
        fontFamily = androidx.wear.compose.material.MaterialTheme.typography.caption2.fontFamily,
        labelSize = MenuDesign.statLabelSize,
        centerValue = value,
        contourColor = health.ringColor(),
        iconRotationDegrees = iconRotationDeg,
    )
}

/** A navigation / launcher ring: neutral grey, icon only, label under. */
@Composable
fun IconRing(
    icon: ImageVector,
    label: String,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
    diameter: Dp = MenuDesign.launcherDiameter,
    active: Boolean? = null,
    accent: CircleAccent = ringIconAccent(icon),
    sub: String? = null,
    choiceState: CircleChoiceState? = null,
    labelSize: androidx.compose.ui.unit.TextUnit = 9.5.sp,
    centerValue: String? = null,
    iconRotationDegrees: Float = 0f,
    actionTiming: CircleActionTiming = CircleActionTiming.DELIBERATE,
    enabled: Boolean = true,
) {
    CircleIconRing(
        icon = icon,
        label = label,
        onTap = onTap,
        modifier = modifier,
        diameter = diameter,
        active = active,
        accent = accent,
        fontFamily = androidx.wear.compose.material.MaterialTheme.typography.caption2.fontFamily,
        sub = sub,
        choiceState = choiceState,
        labelSize = labelSize,
        centerValue = centerValue,
        iconRotationDegrees = iconRotationDegrees,
        timing = actionTiming,
        enabled = enabled,
    )
}

/**
 * A pill that requires a sustained press: the fill sweeps left-to-right
 * while held and the action fires only when it completes. Destructive or
 * state-swapping actions get this instead of a tap so a sleeve-brush can
 * never wipe a cache or replace a reference value.
 */
@Composable
fun HoldPill(
    text: String,
    onConfirm: () -> Unit,
    modifier: Modifier = Modifier,
    destructive: Boolean = false,
    holdMs: Long = MenuDesign.holdDestructiveMs,
) {
    val fill = if (destructive) RingTokens.Broken else circleBrandColor()
    HoldFillBox(
        // The visible text is this control's complete merged name.
        label = null,
        onLongClickLabel = text,
        onConfirm = onConfirm,
        fill = fill,
        background = Color.Transparent,
        outline = if (destructive) RingTokens.Broken.copy(alpha = 0.7f) else RingTokens.Outline,
        holdMs = holdMs,
        modifier = modifier,
        contentPaddingH = 16.dp,
        contentPaddingV = 5.dp,
    ) {
        Text(
            text = text,
            color = if (destructive) RingTokens.Broken else RingTokens.Dim,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp,
        )
    }
}

/**
 * The one hold-gesture implementation every hold variant shares.
 *
 * Progress belongs in the action's label as a translucent sweep, never under
 * the finger on the pressed target and never as a separate progress bar.
 * [HoldProgressFeedback] deliberately has no `None` case: a gated control
 * cannot be constructed without either its own sweep or an external progress
 * owner.
 */
sealed interface HoldProgressFeedback {
    data object LocalSweep : HoldProgressFeedback

    class External(val publish: (Float?) -> Unit) : HoldProgressFeedback
}

internal enum class HoldProgressRoute { LOCAL_SWEEP, EXTERNAL_PUBLISHER }

internal fun holdProgressRoute(feedback: HoldProgressFeedback): HoldProgressRoute = when (feedback) {
    HoldProgressFeedback.LocalSweep -> HoldProgressRoute.LOCAL_SWEEP
    is HoldProgressFeedback.External -> HoldProgressRoute.EXTERNAL_PUBLISHER
}

@Composable
fun HoldFillBox(
    /**
     * Required name ownership decision. A non-null value makes this atom the
     * named, non-merging action node; explicit null deliberately merges the
     * visible children as its name. Omission is not a third, silent state.
     */
    label: String?,
    /**
     * The already-declared phrase TalkBack uses for the long-click action.
     * Required-but-nullable keeps the absence deliberate for compact controls
     * whose visible symbol is their complete action vocabulary.
     */
    onLongClickLabel: String?,
    onConfirm: () -> Unit,
    fill: Color,
    background: Color,
    shape: Shape = CircleShape,
    outline: Color? = null,
    modifier: Modifier = Modifier,
    holdMs: Long = MenuDesign.holdDestructiveMs,
    contentPaddingH: Dp = 16.dp,
    contentPaddingV: Dp = 5.dp,
    contentAlignment: Alignment = Alignment.Center,
    enabled: Boolean = true,
    progressFeedback: HoldProgressFeedback = HoldProgressFeedback.LocalSweep,
    content: @Composable () -> Unit,
) {
    require(holdMs > 0L) { "Hold duration must be positive" }
    var pressed by remember { mutableStateOf(false) }
    var fraction by remember { mutableStateOf(0f) }
    val progressRoute = holdProgressRoute(progressFeedback)
    val progressPublisher = (progressFeedback as? HoldProgressFeedback.External)?.publish
    val latestProgressPublisher = rememberUpdatedState(progressPublisher)
    val latestConfirm = rememberUpdatedState(onConfirm)

    DisposableEffect(Unit) {
        onDispose { latestProgressPublisher.value?.invoke(null) }
    }
    LaunchedEffect(pressed, enabled, holdMs) {
        if (!pressed || !enabled) {
            fraction = 0f
            latestProgressPublisher.value?.invoke(null)
            return@LaunchedEffect
        }
        val startNs = withFrameNanos { it }
        while (fraction < 1f) {
            withFrameNanos { now ->
                fraction = ((now - startNs) / 1_000_000f / holdMs).coerceAtMost(1f)
                latestProgressPublisher.value?.invoke(fraction)
            }
        }
        pressed = false
        latestConfirm.value()
    }
    Box(
        modifier = modifier
            .semantics(mergeDescendants = label == null) {
                if (label != null) contentDescription = label
                if (enabled) {
                    onLongClick(label = onLongClickLabel) {
                        latestConfirm.value()
                        true
                    }
                }
            }
            .clip(shape)
            .then(if (outline != null) Modifier.border(MenuDesign.contourStroke, outline, shape) else Modifier)
            .background(background)
            .then(
                if (enabled) {
                    Modifier.pointerInput(holdMs) {
                        detectTapGestures(onPress = {
                            pressed = true
                            try {
                                tryAwaitRelease()
                            } finally {
                                pressed = false
                            }
                        })
                    }
                } else {
                    Modifier
                },
            )
            .padding(horizontal = contentPaddingH, vertical = contentPaddingV)
            .holdProgressSweep(
                progress = fraction.takeIf { progressRoute == HoldProgressRoute.LOCAL_SWEEP },
                color = fill.copy(alpha = 0.35f),
            ),
        contentAlignment = contentAlignment,
    ) {
        content()
    }
}

/** Boolean choices keep the established OFF/ON ring; ordered selections
 * stay neutral because their dot position carries state. */
internal fun choiceIsActive(
    options: List<String>,
    selected: String,
    role: CircleChoiceRole,
): Boolean {
    require(selected in options) { "Selected value '$selected' is not one of $options" }
    return role == CircleChoiceRole.TOGGLE && selected != options.first()
}

/** The choice a completed hold advances to: next in declaration order,
 *  wrapping. Pure so the cycle is testable without Compose. */
internal fun nextChoice(options: List<String>, selected: String): String {
    require(selected in options) { "Selected value '$selected' is not one of $options" }
    return options[(options.indexOf(selected) + 1) % options.size]
}

/** Settings-list choice control in the circle language (Mattias 2026-07-16:
 * menu rows drop the pill, circles all the way — mockup B): one
 * [RingRow]-shaped row whose RING is the state — lit
 * accent past the resting option, faint otherwise. The whole row is the
 * target; the shared deliberate hold advances to the next choice. Progress
 * and confirmation are owned by [RingRow]'s one centre-screen action cue,
 * so choice rows cannot regress to a private label sweep. */
@Composable
fun RingChoiceRow(
    title: String,
    selected: String,
    options: List<String>,
    role: CircleChoiceRole,
    onSelect: (String) -> Unit,
    icon: ImageVector? = null,
    accent: CircleAccent = ringIconAccent(icon),
    modifier: Modifier = Modifier,
    holdMs: Long = DELIBERATE_CHANGE_HOLD_MS,
    actionTiming: CircleActionTiming = CircleActionTiming.DELIBERATE,
    /** One sentence opened only through the transient row-info affordance. */
    hint: String = "",
    /** Optional verb rendered with the transient information card. */
    infoAction: CircleActionCueInfoAction? = null,
    infoSelected: Boolean = false,
    onInfoTouch: (() -> Unit)? = null,
) {
    val active = choiceIsActive(options, selected, role)
    val choiceState = circleChoiceState(options, selected)
    RingRow(
        title = title,
        sub = selected,
        icon = icon,
        accent = accent,
        onTap = { onSelect(nextChoice(options, selected)) },
        ringActive = active,
        actionTiming = actionTiming,
        actionHoldMs = holdMs,
        hint = hint,
        infoAction = infoAction,
        infoSelected = infoSelected,
        onInfoTouch = onInfoTouch,
        trailing = {
            CircleChoiceIndicator(
                state = choiceState,
                modifier = Modifier.size(
                    width = circleChoiceIndicatorWidth(choiceState.optionCount),
                    height = 8.dp,
                ),
            )
        },
        modifier = modifier,
    )
}

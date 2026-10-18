package com.adelost.designkit.ui

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * The canonical Circle row renderer shared verbatim by Watch and Phone.
 * Hosts own list containers, rotary/touch behavior and responsive placement.
 */
@Composable
fun CircleRingRow(
    title: String,
    sub: CircleTextContent,
    onTap: (() -> Unit)?,
    icon: ImageVector? = null,
    modifier: Modifier = Modifier,
    onLongPress: (() -> Unit)? = null,
    ringActive: Boolean? = null,
    accent: CircleAccent = ringIconAccent(icon),
    semanticColor: Color? = null,
    /** Optional product-semantic colour for the title alone, when the title and the value carry different laws. */
    titleColor: Color? = null,
    labelProgress: CircleLabelProgress? = null,
    leading: (@Composable () -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
    centerValue: String? = null,
    /**
     * WHAT THIS ROW ASKS OF A FINGER, as one value that only [circleResolvedTiming] can make.
     *
     * It was a kind and a duration side by side, and those are two numbers that can disagree: a choice
     * row carrying half a second while its declared kind commits at once is how Link shipped a row
     * that filled an arc and switched on one millisecond.
     *
     * INGREDIENTS OR ANSWER, NEVER BOTH: this row takes the ANSWER, so it has no `effect` parameter
     * and must not grow one. See [CircleActionEffect].
     *
     * IT KEEPS ITS DEFAULT, unlike the gestures below it, and the reason is a measured one rather than
     * a preference: the gestures cannot default a value whose builder reads a composition local, while
     * a row can, and a default is allowed exactly when its direction is the safe one. DELIBERATE is
     * that direction, because a row whose author never stated a timing refuses a graze rather than
     * firing on one. [com.adelost.designkit.ui.ADefaultFailsTowardsTheGateTest] presses a row that
     * states nothing and proves it, so the direction is measured rather than asserted about.
     */
    timing: CircleResolvedTiming = circleResolvedTiming(CircleActionTiming.DELIBERATE),
    /**
     * Let the row grow to fit its words instead of ellipsising them.
     *
     * For a row you can PRESS, one line is right: its latest state is repeated
     * by the action receipt and its declared hint remains available through
     * the row's dedicated info affordance. A row you cannot press has no such
     * action receipt — and those are the ones carrying the longest text,
     * because they exist to explain rather than to be operated. The SAFETY page read
     * "SUPPLEMENTAR… / NOT A PRIMA…" with no way to see the rest.
     *
     * Height is free here precisely because there is no touch target to keep
     * predictable.
     */
    multiline: Boolean = false,
    iconRotationDeg: Float = 0f,
    /** See [CircleRingRowContent]. */
    endSlot: CircleRowEndSlot? = null,
) {
    val phoneDesign = phoneSurfaceDesignFor(LocalCircleSurfaceLayout.current.surfaceClass)
    val feedback = rememberCircleActionFeedbackState()
    val cue = if (onTap != null && icon != null) {
        rememberCircleActionCueController(
            icon = icon,
            label = title,
            timing = timing,
            pressed = feedback.pressed,
            // The row's own value line is already the honest state; the cue
            // repeats it in the action receipt without also smuggling the
            // row's explanation into an ordinary press.
            stateValue = sub.text.takeIf { it.isNotBlank() },
        )
    } else {
        null
    }
    val confirmedTap = onTap?.let { action ->
        {
            cue?.confirm()
            action()
        }
    }
    val interaction = confirmedTap?.let { tap ->
        modifier.circleRowGesture(
            feedback = feedback,
            timing = timing,
            label = circleRingRowAccessibilityLabel(title, sub.text),
            onLongPress = onLongPress,
            onTap = tap,
        )
    } ?: modifier
    Box(
        modifier = interaction.padding(
            horizontal = MenuDesign.rowPaddingH,
            vertical = phoneDesign?.rowPaddingVertical ?: MenuDesign.rowPaddingV,
        ),
    ) {
        val rowContent: @Composable () -> Unit = {
            CircleRingRowContent(
                title = title,
                sub = sub,
                icon = icon,
                ringActive = ringActive,
                // Read off the same action that decides whether anything happens
                // when the row is pressed, so the ring cannot promise a gesture
                // this row does not have.
                affordance = CircleRowAffordance.of(onTap),
                accent = accent,
                semanticColor = semanticColor,
                titleColor = titleColor,
                leading = leading,
                trailing = trailing,
                labelProgress = labelProgress,
                feedback = feedback,
                centerValue = centerValue,
                multiline = multiline,
                iconRotationDeg = iconRotationDeg,
                endSlot = endSlot,
            )
        }
        if (confirmedTap != null) {
            CircleRingRowActionContent(rowContent)
        } else {
            rowContent()
        }
    }
}

/**
 * WHICH GESTURE A PRESSED ROW TAKES, with everything the two arms share stated once.
 *
 * Split out in row 215 on the churn ledger's evidence, which named the price rather than the smell.
 * Two of this function's four fixes in 60 days had to be written into BOTH arms of the choice: the
 * spoken name a row answers to (ce700c82c) and who owns it (83773a6fa). Four of the five arguments
 * were identical in both arms, so every rule about a pressed row cost two edits, and the arm it
 * reached second was the one that had been wrong longest. The fixes came from this branching, not
 * from a constant or an upstream value, so the ledger's answer is SPLIT.
 *
 * A row with no action takes no gesture at all, which the caller decides; this is only the choice
 * between the two it can take.
 */
private fun Modifier.circleRowGesture(
    feedback: CircleActionFeedbackState,
    timing: CircleResolvedTiming,
    label: String,
    onLongPress: (() -> Unit)?,
    onTap: () -> Unit,
): Modifier = if (onLongPress == null) {
    circleSafeTap(
        feedback = feedback,
        timing = timing,
        label = label,
        // The row already paints the wait: on its leading ring, or as the wash under its own title
        // column when it has no ring. Row 215 leaves it exactly one cue.
        cue = CirclePressCue.OWNED,
        onTap = onTap,
    )
} else {
    circleSafeTapOrHold(
        feedback = feedback,
        timing = timing,
        label = label,
        cue = CirclePressCue.OWNED,
        onLongPress = onLongPress,
        onTap = onTap,
    )
}

/**
 * Content placed beneath a row action lets the action node own the visible
 * title and value exactly once. Other descendants, including explicit
 * trailing controls, keep their own semantics.
 *
 * RingKit's hold renderer uses the same content outside [CircleRingRow], so
 * this wrapper is public without changing the existing content function's ABI.
 */
@Composable
fun CircleRingRowActionContent(content: @Composable () -> Unit) {
    CompositionLocalProvider(LocalActionParentOwnsRowCopy provides true, content = content)
}

/** The exact spoken row grammar, independent of platform merge precedence. */
fun circleRingRowAccessibilityLabel(title: String, sub: String): String =
    sub.takeIf { it.isNotBlank() }?.let { "$title · $it" } ?: title

internal val LocalActionParentOwnsRowCopy = staticCompositionLocalOf { false }

/** Same pixels without gesture/padding, used inside Watch hold feedback. */
@Composable
fun CircleRingRowContent(
    title: String,
    sub: CircleTextContent,
    icon: ImageVector?,
    ringActive: Boolean?,
    /** No default: see [CircleRowAffordance]. Every renderer states what its
     *  row can do by handing over the action, and the ring follows. */
    affordance: CircleRowAffordance,
    accent: CircleAccent = ringIconAccent(icon),
    semanticColor: Color? = null,
    leading: (@Composable () -> Unit)?,
    trailing: (@Composable () -> Unit)?,
    labelProgress: CircleLabelProgress? = null,
    /**
     * The gesture whose wait this content draws, or explicit null when the content is not the thing
     * under the finger and its wait arrives as [labelProgress] instead.
     *
     * No default, and no duration. Row 215: a default here is wiring a caller can delete while every
     * leaf case stays green, and a duration here is a second clock beside the gate's.
     */
    feedback: CircleActionFeedbackState?,
    centerValue: String? = null,
    /** See [CircleRingRow]: a row nobody can press has no centre cue to fall
     *  back on, so it grows to fit its words instead of ellipsising them. */
    multiline: Boolean = false,
    iconRotationDeg: Float = 0f,
    /** See [CircleRingRow]. */
    titleColor: Color? = null,
    /**
     * See [CircleRowEndSlot]. Inside the value line the (i) made that line as tall as the button, and the row
     * grew and pushed the list down on touch (Skyvw row 118, Mattias 2026-09-16: "det ser ju fult ut").
     */
    endSlot: CircleRowEndSlot? = null,
) {
    val phoneDesign = phoneSurfaceDesignFor(LocalCircleSurfaceLayout.current.surfaceClass)
    val hasSlots = leading != null || trailing != null || endSlot != null
    val endSlotGap = phoneDesign?.controlGap ?: 6.dp
    val widthLentToEndSlot = endSlot?.takeUnless { it.occupied }?.let { it.width + endSlotGap } ?: 0.dp
    val hasLeadingRing = icon != null || centerValue != null
    // A passive, wrapping reading has no action ring to align with. Give its
    // identity the full reading width; the small source/status glyph belongs
    // with the supporting value. Actions and choices keep their shared column.
    if (phoneDesign == null && !affordance.operable && multiline && leading == null && centerValue == null) {
        CircleRowEndSlotted(endSlot, gap = endSlotGap) {
            CirclePassiveReadingContent(
                title, sub, icon, accent, semanticColor, trailing, iconRotationDeg, titleColor, widthLentToEndSlot,
            )
        }
        return
    }
    val feedbackSweep = rememberCircleFeedbackSweep(progress = labelProgress, feedback = feedback)
    Row(
        modifier = if (hasSlots) Modifier.fillMaxWidth() else Modifier,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (leading != null) {
            leading()
            Spacer(Modifier.size(7.dp))
        }
        if (hasLeadingRing) {
            CircleRowLeadingRing(
                icon = icon,
                centerValue = centerValue,
                active = ringActive,
                affordance = affordance,
                accent = accent,
                semanticColor = semanticColor,
                phoneDesign = phoneDesign,
                feedbackSweep = feedbackSweep,
                iconRotationDeg = iconRotationDeg,
            )
            Spacer(Modifier.size(phoneDesign?.rowIconTextGap ?: MenuDesign.iconTextGap))
        }
        Column(
            modifier = (if (hasSlots) Modifier.weight(1f) else Modifier)
                .then(
                    if (hasLeadingRing) {
                        Modifier
                    } else {
                        Modifier.circleProgressSweep(progress = feedbackSweep)
                    },
                ),
        ) {
            CircleText(
                text = title, role = CircleTextRole.NAME, color = titleColor ?: RingTokens.Ink,
                modifier = Modifier.circleRowTitleWidth(widthLentToEndSlot)
                    .then(if (LocalActionParentOwnsRowCopy.current) Modifier.clearAndSetSemantics { } else Modifier),
            )
            // The state indicator rides the VALUE line, not the whole row.
            // Sitting beside both lines, it charged the TITLE for width the
            // short value below was not using: ORIENTATION read "ORIENTATI…",
            // ACHIEVEMENTS "ACHIEVEM…", DIAL DIRECTION "DIAL DIRE…" — all
            // under twelve characters, all cut, while an 11-character title
            // on a row without a rail rendered whole (menu UX audit
            // 2026-07-27, finding 11). It indicates the value, so it belongs
            // on the value's line; the weight keeps it at the row's right
            // edge, so rails still line up down the list.
            if (sub.isNotBlank() || (trailing != null && phoneDesign == null)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    // A state sits on the value on every row, pressable or not; the glyph keeps its kind (style C).
                    val subColor = semanticColor ?: RingTokens.Dim
                    CircleContent(
                        content = sub, role = CircleTextRole.VALUE, color = subColor,
                        modifier = (if (trailing != null && phoneDesign == null) Modifier.weight(1f) else Modifier)
                            .then(if (LocalActionParentOwnsRowCopy.current) Modifier.clearAndSetSemantics { } else Modifier),
                    )
                    if (trailing != null && phoneDesign == null) {
                        Spacer(Modifier.size(6.dp))
                        trailing()
                    }
                }
            }
        }
        if (trailing != null && phoneDesign != null) {
            Spacer(Modifier.size(phoneDesign.controlGap))
            trailing()
        }
        if (endSlot != null) {
            Spacer(Modifier.size(endSlotGap))
            endSlot.content()
        }
    }
}

/**
 * A non-interactive reading keeps its full identity above its source/value,
 * centred in the row's own stable width. It used to shift each measured line
 * sideways while that line passed a rim button, so readings jumped as the list
 * scrolled (Mattias 2026-09-14: "menyerna inte ska hoppa"). The list edge is
 * the only clearance now.
 */
@Composable
private fun CirclePassiveReadingContent(
    title: String,
    sub: CircleTextContent,
    icon: ImageVector?,
    accent: CircleAccent,
    semanticColor: Color?,
    trailing: (@Composable () -> Unit)?,
    iconRotationDeg: Float,
    titleColor: Color?,
    widthLentToEndSlot: Dp,
) {
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        CircleText(text = title, role = CircleTextRole.NAME, color = titleColor ?: RingTokens.Ink,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            modifier = Modifier.circleRowTitleWidth(widthLentToEndSlot).fillMaxWidth())
        if (icon != null || sub.isNotBlank() || trailing != null) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (icon != null) {
                    CircleStyledIcon(style = ringIconStyle(icon, accent), contentDescription = null,
                        modifier = Modifier.size(MenuDesign.iconSize).rotate(iconRotationDeg))
                    if (sub.isNotBlank() || trailing != null) Spacer(Modifier.size(6.dp))
                }
                if (sub.isNotBlank()) {
                    CircleContent(content = sub, role = CircleTextRole.VALUE, color = semanticColor ?: RingTokens.Dim,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center, modifier = Modifier.weight(1f, fill = false))
                }
                if (trailing != null) {
                    if (sub.isNotBlank()) Spacer(Modifier.size(6.dp))
                    trailing()
                }
            }
        }
    }
}

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
    sub: String,
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
    actionTiming: CircleActionTiming = CircleActionTiming.DELIBERATE,
    actionHoldMs: Long = actionTiming.holdMs,
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
            timing = actionTiming,
            pressed = feedback.pressed,
            holdDurationMs = actionHoldMs,
            // The row's own value line is already the honest state; the cue
            // repeats it in the action receipt without also smuggling the
            // row's explanation into an ordinary press.
            stateValue = sub.takeIf { it.isNotBlank() },
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
    val interaction = when {
        confirmedTap == null -> modifier
        onLongPress == null -> modifier.circleSafeTap(
            feedback = feedback,
            holdMs = actionHoldMs,
            label = circleRingRowAccessibilityLabel(title, sub),
            onTap = confirmedTap,
        )
        else -> modifier.circleSafeTapOrHold(
            feedback = feedback,
            holdMs = actionHoldMs,
            label = circleRingRowAccessibilityLabel(title, sub),
            onLongPress = onLongPress,
            onTap = confirmedTap,
        )
    }
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
                pressed = feedback.pressed,
                pressHoldMs = actionHoldMs,
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
    sub: String,
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
    pressed: Boolean = false,
    pressHoldMs: Long = MenuDesign.tapHoldMs,
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
    val widthLentToEndSlot = endSlot?.let { it.width + endSlotGap } ?: 0.dp
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
    val feedbackSweep = rememberCircleFeedbackSweep(
        progress = labelProgress,
        pressed = pressed,
        pressHoldMs = pressHoldMs,
    )
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
                        Modifier.circleProgressSweep(
                            progress = feedbackSweep.takeIf { it > 0f },
                        )
                    },
                ),
        ) {
            // A row beside the floating chrome has roughly 40 dp of title
            // column left, which is five characters at the design size — and
            // maxLines=1 with the default Clip overflow turned CONTROL into
            // "CONTR" and DETAIL into "DETAI" with no sign anything was
            // missing (Mattias 2026-07-27). A title states which setting the
            // row IS, so it shrinks to stay whole rather than losing letters.
            CircleFittedTitle(
                text = title,
                color = titleColor ?: RingTokens.Ink,
                fontSizeSp = phoneDesign?.rowTitleSize?.value ?: (
                    if (icon == null) MenuDesign.titleSizeNoIcon else MenuDesign.titleSize
                    ).value,
                maxLines = if (multiline) Int.MAX_VALUE else 1,
                spoken = !LocalActionParentOwnsRowCopy.current,
                widthLentToEndSlot = widthLentToEndSlot,
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
                    // A passive reading's pigment describes its value, not
                    // just its icon. Ordinary action copy stays neutral.
                    val subColor = if (!affordance.operable) semanticColor ?: RingTokens.Dim else RingTokens.Dim
                    val subSizeSp = phoneDesign?.rowSubtitleSize?.value ?: MenuDesign.subSize.value
                    CircleRowLineKeepingOneLine(
                        text = sub, fontSizeSp = subSizeSp, letterSpacingSp = 0f, fontWeight = FontWeight.Normal,
                        lentWidth = widthLentToEndSlot, maxLines = if (multiline) Int.MAX_VALUE else 1,
                        modifier = (if (trailing != null && phoneDesign == null) Modifier.weight(1f) else Modifier)
                            .then(
                                if (LocalActionParentOwnsRowCopy.current) {
                                    Modifier.clearAndSetSemantics { }
                                } else {
                                    Modifier
                                },
                            ),
                    ) { lines, lineModifier ->
                        if (multiline && lines == 1) {
                            CircleFittedText(
                                text = sub, color = subColor, fontSizeSp = subSizeSp, maxLines = 1,
                                modifier = lineModifier,
                            )
                        } else {
                            CircleText(
                                text = sub, color = subColor, fontSizeSp = subSizeSp, maxLines = lines,
                                overflow = TextOverflow.Ellipsis, modifier = lineModifier,
                            )
                        }
                    }
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
    sub: String,
    icon: ImageVector?,
    accent: CircleAccent,
    semanticColor: Color?,
    trailing: (@Composable () -> Unit)?,
    iconRotationDeg: Float,
    titleColor: Color?,
    widthLentToEndSlot: Dp,
) {
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        CircleRowLineKeepingOneLine(
            text = title, fontSizeSp = MenuDesign.titleSize.value, letterSpacingSp = MenuDesign.titleTracking.value,
            fontWeight = FontWeight.Bold, lentWidth = widthLentToEndSlot, maxLines = Int.MAX_VALUE,
            modifier = Modifier.fillMaxWidth(),
        ) { maxLines, lineModifier ->
            CircleFittedText(
                text = title,
                color = titleColor ?: RingTokens.Ink,
                fontSizeSp = MenuDesign.titleSize.value,
                minFontSizeSp = if (maxLines == 1) CIRCLE_TITLE_MIN_SIZE_SP else MenuDesign.titleSize.value,
                fontWeight = FontWeight.Bold,
                letterSpacingSp = MenuDesign.titleTracking.value,
                maxLines = maxLines,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                modifier = lineModifier.fillMaxWidth(),
            )
        }
        if (icon != null || sub.isNotBlank() || trailing != null) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (icon != null) {
                    CircleStyledIcon(
                        style = ringIconStyle(icon, accent),
                        contentDescription = null,
                        tintOverride = semanticColor,
                        modifier = Modifier.size(MenuDesign.iconSize).rotate(iconRotationDeg),
                    )
                    if (sub.isNotBlank() || trailing != null) Spacer(Modifier.size(6.dp))
                }
                if (sub.isNotBlank()) {
                    // A reading wraps freely; balanced so "your phone's own,
                    // screen held / on" cannot leave a word alone (Skyvw row 117).
                    CircleRowLineKeepingOneLine(
                        text = sub, fontSizeSp = MenuDesign.subSize.value, letterSpacingSp = 0f,
                        fontWeight = FontWeight.Normal, lentWidth = widthLentToEndSlot, maxLines = Int.MAX_VALUE,
                        modifier = Modifier.weight(1f, fill = false),
                    ) { lines, lineModifier ->
                        if (lines == 1) {
                            CircleFittedText(
                                text = sub, color = semanticColor ?: RingTokens.Dim,
                                fontSizeSp = MenuDesign.subSize.value, maxLines = 1,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center, modifier = lineModifier,
                            )
                        } else {
                            CircleText(
                                text = sub,
                                color = semanticColor ?: RingTokens.Dim,
                                fontSizeSp = MenuDesign.subSize.value,
                                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                                modifier = lineModifier,
                                balancedLines = true,
                            )
                        }
                    }
                }
                if (trailing != null) {
                    if (sub.isNotBlank()) Spacer(Modifier.size(6.dp))
                    trailing()
                }
            }
        }
    }
}

/**
 * A row title that stays whole. It renders at the design size and steps down
 * only as far as [CIRCLE_TITLE_MIN_SIZE_SP] when the measured line would not
 * fit, so a wide row is unaffected and a narrow one loses weight instead of
 * letters. Below the floor it ellipsises: an unreadable title is worse than
 * an honest "…".
 */
@Composable
private fun CircleFittedTitle(
    text: String,
    color: Color,
    fontSizeSp: Float,
    maxLines: Int = 1,
    spoken: Boolean = true,
    widthLentToEndSlot: Dp = 0.dp,
) {
    // Delegates to the shared fitted-text atom so there is ONE shrink
    // mechanism; this wrapper only owns the row-title styling choices.
    CircleRowLineKeepingOneLine(
        text = text, fontSizeSp = fontSizeSp, letterSpacingSp = MenuDesign.titleTracking.value,
        fontWeight = FontWeight.Bold, lentWidth = widthLentToEndSlot, maxLines = maxLines,
    ) { lines, lineModifier ->
        CircleFittedText(
            text = text,
            color = color,
            fontSizeSp = fontSizeSp,
            minFontSizeSp = CIRCLE_TITLE_MIN_SIZE_SP,
            shrinkStepSp = CIRCLE_TITLE_SHRINK_STEP_SP,
            fontWeight = FontWeight.Bold,
            letterSpacingSp = MenuDesign.titleTracking.value,
            maxLines = lines,
            modifier = lineModifier.then(if (spoken) Modifier else Modifier.clearAndSetSemantics { }),
        )
    }
}

/** The smallest a row title may shrink before ellipsis takes over. */
private const val CIRCLE_TITLE_MIN_SIZE_SP = 7.5f
private const val CIRCLE_TITLE_SHRINK_STEP_SP = 0.5f

@Composable
private fun CircleRowLeadingRing(
    icon: ImageVector?,
    centerValue: String?,
    active: Boolean?,
    affordance: CircleRowAffordance,
    accent: CircleAccent,
    semanticColor: Color?,
    phoneDesign: PhoneSurfaceDesign?,
    feedbackSweep: Float,
    iconRotationDeg: Float,
) {
    val activeContour = circleBrandColor()
    val progressContour = circleBrandColor()
    // The start screen's language everywhere (Mattias 2026-07-21: "samma
    // ljusstyrka som på huvudsidan"): the icon always speaks at full
    // strength — the RING alone carries state, neutral unless the toggle
    // is ON. One shared contour renderer, so a row ring can never weigh
    // differently from a launcher or home ring again.
    //
    // A reading keeps the icon and keeps the SIZE — the list's titles still
    // line up down a straight edge, and nothing moves when a row's action
    // appears or goes away. Only the circle is withheld, because only the
    // circle was making a promise (see [CircleRowAffordance]).
    val contour = circleRowRingContour(affordance, active, activeContour)
    Box(
        modifier = Modifier
            .size(phoneDesign?.rowIconDiameter ?: MenuDesign.iconRingDiameter)
            .clip(CircleShape)
            .then(contour?.let { Modifier.circleRingContour(it) } ?: Modifier)
            .circleProgressContour(
                feedbackSweep.takeIf { it > 0f },
                color = progressContour,
            ),
        contentAlignment = Alignment.Center,
    ) {
        if (icon != null) {
            CircleStyledIcon(
                style = ringIconStyle(icon, accent),
                contentDescription = null,
                tintOverride = semanticColor,
                modifier = Modifier.size(phoneDesign?.rowIconSize ?: MenuDesign.iconSize).rotate(iconRotationDeg),
            )
        } else {
            CircleText(
                text = requireNotNull(centerValue),
                color = semanticColor ?: circleAccentColor(accent),
                fontSizeSp = (phoneDesign?.rowCenterValueSize ?: MenuDesign.rowCenterValueSize).value,
                fontWeight = FontWeight.Black,
                tabularNumerals = true,
                maxLines = 1,
            )
        }
    }
}

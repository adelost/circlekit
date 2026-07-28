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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

/**
 * The canonical Skyvw row renderer shared verbatim by Watch and Phone.
 * Hosts own list containers, rotary/touch behavior and responsive placement.
 */
@Composable
fun SkyvwRingRow(
    title: String,
    sub: String,
    onTap: (() -> Unit)?,
    icon: ImageVector? = null,
    modifier: Modifier = Modifier,
    onLongPress: (() -> Unit)? = null,
    ringActive: Boolean? = null,
    accent: SkyvwAccent = ringIconAccent(icon),
    labelProgress: SkyvwLabelProgress? = null,
    leading: (@Composable () -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
    centerValue: String? = null,
    actionTiming: SkyvwActionTiming = SkyvwActionTiming.DELIBERATE,
    actionHoldMs: Long = actionTiming.holdMs,
    /** One sentence about what this row does; read out by the centre cue. */
    hint: String = "",
    /**
     * Let the row grow to fit its words instead of ellipsising them.
     *
     * For a row you can PRESS, one line is right: holding it publishes the
     * whole title and value to the centre cue, so the list stays scannable and
     * nothing is actually lost. A row you cannot press has no such second
     * chance — and those are the ones carrying the longest text, because they
     * exist to explain rather than to be operated. The SAFETY page read
     * "SUPPLEMENTAR… / NOT A PRIMA…" with no way to see the rest.
     *
     * Height is free here precisely because there is no touch target to keep
     * predictable.
     */
    multiline: Boolean = false,
) {
    val phoneDesign = phoneSurfaceDesignFor(LocalSkyvwSurfaceLayout.current.surfaceClass)
    val feedback = rememberSkyvwActionFeedbackState()
    val cue = if (onTap != null && icon != null) {
        rememberSkyvwActionCueController(
            icon = icon,
            label = title,
            timing = actionTiming,
            pressed = feedback.pressed,
            holdDurationMs = actionHoldMs,
            // The row's own value line is already the honest state; the cue
            // repeats it so a held row explains itself without the reader
            // having to keep the list in view behind the overlay.
            stateValue = sub.takeIf { it.isNotBlank() },
            hint = hint.takeIf { it.isNotBlank() },
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
        onLongPress == null -> modifier.skyvwSafeTap(
            feedback = feedback,
            holdMs = actionHoldMs,
            onTap = confirmedTap,
        )
        else -> modifier.skyvwSafeTapOrHold(
            feedback = feedback,
            holdMs = actionHoldMs,
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
        SkyvwRingRowContent(
            title = title,
            sub = sub,
            icon = icon,
            ringActive = ringActive,
            accent = accent,
            leading = leading,
            trailing = trailing,
            labelProgress = labelProgress,
            pressed = feedback.pressed,
            pressHoldMs = actionHoldMs,
            centerValue = centerValue,
            multiline = multiline,
        )
    }
}

/** Same pixels without gesture/padding, used inside Watch hold feedback. */
@Composable
fun SkyvwRingRowContent(
    title: String,
    sub: String,
    icon: ImageVector?,
    ringActive: Boolean?,
    accent: SkyvwAccent = ringIconAccent(icon),
    leading: (@Composable () -> Unit)?,
    trailing: (@Composable () -> Unit)?,
    labelProgress: SkyvwLabelProgress? = null,
    pressed: Boolean = false,
    pressHoldMs: Long = MenuDesign.tapHoldMs,
    centerValue: String? = null,
    /** See [SkyvwRingRow]: a row nobody can press has no centre cue to fall
     *  back on, so it grows to fit its words instead of ellipsising them. */
    multiline: Boolean = false,
) {
    val phoneDesign = phoneSurfaceDesignFor(LocalSkyvwSurfaceLayout.current.surfaceClass)
    val hasSlots = leading != null || trailing != null
    val hasLeadingRing = icon != null || centerValue != null
    val feedbackSweep = rememberSkyvwFeedbackSweep(
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
            SkyvwRowLeadingRing(
                icon = icon,
                centerValue = centerValue,
                active = ringActive,
                accent = accent,
                phoneDesign = phoneDesign,
                feedbackSweep = feedbackSweep,
            )
            Spacer(Modifier.size(phoneDesign?.rowIconTextGap ?: MenuDesign.iconTextGap))
        }
        Column(
            modifier = (if (hasSlots) Modifier.weight(1f) else Modifier)
                .then(
                    if (hasLeadingRing) {
                        Modifier
                    } else {
                        Modifier.skyvwProgressSweep(
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
            SkyvwFittedTitle(
                text = title,
                fontSizeSp = phoneDesign?.rowTitleSize?.value ?: (
                    if (icon == null) MenuDesign.titleSizeNoIcon else MenuDesign.titleSize
                    ).value,
                maxLines = if (multiline) MULTILINE_TITLE_LINES else 1,
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
            Row(verticalAlignment = Alignment.CenterVertically) {
                SkyvwText(
                    text = sub,
                    color = RingTokens.Dim,
                    fontSizeSp = phoneDesign?.rowSubtitleSize?.value ?: MenuDesign.subSize.value,
                    maxLines = if (multiline) MULTILINE_SUB_LINES else 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = if (trailing != null) Modifier.weight(1f) else Modifier,
                )
                if (trailing != null) {
                    Spacer(Modifier.size(6.dp))
                    trailing()
                }
            }
        }
    }
}

/**
 * A row title that stays whole. It renders at the design size and steps down
 * only as far as [SKYVW_TITLE_MIN_SIZE_SP] when the measured line would not
 * fit, so a wide row is unaffected and a narrow one loses weight instead of
 * letters. Below the floor it ellipsises: an unreadable title is worse than
 * an honest "…".
 */
@Composable
private fun SkyvwFittedTitle(text: String, fontSizeSp: Float, maxLines: Int = 1) {
    var sizeSp by remember(text, fontSizeSp, maxLines) { mutableFloatStateOf(fontSizeSp) }
    SkyvwText(
        text = text,
        color = RingTokens.Ink,
        fontSizeSp = sizeSp,
        fontWeight = FontWeight.Bold,
        letterSpacingSp = MenuDesign.titleTracking.value,
        maxLines = maxLines,
        overflow = TextOverflow.Ellipsis,
        onTextLayout = { result ->
            if (result.hasVisualOverflow && sizeSp > SKYVW_TITLE_MIN_SIZE_SP) {
                sizeSp = (sizeSp - SKYVW_TITLE_SHRINK_STEP_SP)
                    .coerceAtLeast(SKYVW_TITLE_MIN_SIZE_SP)
            }
        },
    )
}

/** A passive row may take a second line for its name and three for its
 *  explanation. Past that it is not a row any more, it is a page. */
private const val MULTILINE_TITLE_LINES = 2
private const val MULTILINE_SUB_LINES = 3

/** The smallest a row title may shrink before ellipsis takes over. */
private const val SKYVW_TITLE_MIN_SIZE_SP = 7.5f
private const val SKYVW_TITLE_SHRINK_STEP_SP = 0.5f

@Composable
private fun SkyvwRowLeadingRing(
    icon: ImageVector?,
    centerValue: String?,
    active: Boolean?,
    accent: SkyvwAccent,
    phoneDesign: PhoneSurfaceDesign?,
    feedbackSweep: Float,
) {
    val activeContour = skyvwBrandColor()
    val progressContour = skyvwBrandColor()
    // The start screen's language everywhere (Mattias 2026-07-21: "samma
    // ljusstyrka som på huvudsidan"): the icon always speaks at full
    // strength — the RING alone carries state, neutral unless the toggle
    // is ON. One shared contour renderer, so a row ring can never weigh
    // differently from a launcher or home ring again.
    Box(
        modifier = Modifier
            .size(phoneDesign?.rowIconDiameter ?: MenuDesign.iconRingDiameter)
            .clip(CircleShape)
            .skyvwRingContour(if (active == true) activeContour else MenuDesign.ringNeutral)
            .skyvwProgressContour(
                feedbackSweep.takeIf { it > 0f },
                color = progressContour,
            ),
        contentAlignment = Alignment.Center,
    ) {
        if (icon != null) {
            SkyvwStyledIcon(
                style = ringIconStyle(icon, accent),
                contentDescription = null,
                modifier = Modifier.size(phoneDesign?.rowIconSize ?: MenuDesign.iconSize),
            )
        } else {
            SkyvwText(
                text = requireNotNull(centerValue),
                color = skyvwAccentColor(accent),
                fontSizeSp = (phoneDesign?.rowCenterValueSize ?: MenuDesign.rowCenterValueSize).value,
                fontWeight = FontWeight.Black,
                tabularNumerals = true,
                maxLines = 1,
            )
        }
    }
}

package com.adelost.ringkit.ui

import com.adelost.designkit.ui.*

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material.Icon
import androidx.wear.compose.material.Text

/** The shared navigation/actions/row vocabulary for every RingScreen. */

/** The back affordance in the circle language: a quiet chevron ring, same
 *  shape as the launcher rings, same spot on every screen. Pressing answers
 *  through the glove: the contour steps up to full ink and the disc dips
 *  ([MenuDesign.backPressScale]) — feedback lives in the press, never as
 *  resting chrome. The touch circle extends past the drawn ring to the Wear
 *  minimum ([MenuDesign.backTouchTarget]) without growing the layout
 *  footprint, so grazing taps still land. [scrim] fills the disc with
 *  translucent black for overlay surfaces (map, scrolling lists) where a
 *  bare ring would sit on live content.
 *
 *  [holdMs] switches the ring to the app's one hold-to-confirm grammar
 *  (same logic as the DIAL chips, not a lookalike): the press streams
 *  0..1 to [onHoldProgress] — render it at the SCREEN CENTRE where the
 *  eye is, never under the finger — and only a completed hold fires
 *  [onBack]. Early release cancels and reports null. Null [holdMs]
 *  keeps the plain single-tap back. */
@Composable
fun BackRing(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    scrim: Boolean = false,
    diameter: Dp = MenuDesign.backDiameter,
    holdMs: Long? = null,
    onHoldProgress: ((Float?) -> Unit)? = null,
) {
    if (holdMs != null && enabled) {
        HoldBackRing(onBack, scrim, diameter, holdMs, onHoldProgress, modifier)
    } else {
        TapBackRing(onBack, enabled, scrim, diameter, modifier)
    }
}

@Composable
private fun TapBackRing(
    onBack: () -> Unit,
    enabled: Boolean,
    scrim: Boolean,
    diameter: Dp,
    modifier: Modifier,
) {
    val feedback = rememberCircleActionFeedbackState()
    Box(modifier = modifier.size(diameter), contentAlignment = Alignment.Center) {
        Box(
            modifier = Modifier
                .requiredSize(maxOf(diameter, MenuDesign.backTouchTarget))
                .clip(CircleShape)
                .circleSafeTap(
                    feedback = feedback,
                    enabled = enabled,
                    onTap = onBack,
                ),
        )
        BackDisc(enabled = enabled, pressed = feedback.pressed, scrim = scrim, diameter = diameter)
    }
}

/** Hold-guarded back on the shared [HoldFillBox] engine. The finger covers
 *  the whole disc, so progress belongs in the caller's centre overlay. */
@Composable
private fun HoldBackRing(
    onBack: () -> Unit,
    scrim: Boolean,
    diameter: Dp,
    holdMs: Long,
    onHoldProgress: ((Float?) -> Unit)?,
    modifier: Modifier,
) {
    var holding by remember { mutableStateOf(false) }
    Box(modifier = modifier.size(diameter), contentAlignment = Alignment.Center) {
        HoldFillBox(
            onConfirm = onBack,
            fill = Color.Transparent,
            background = Color.Transparent,
            shape = CircleShape,
            modifier = Modifier.requiredSize(maxOf(diameter, MenuDesign.backTouchTarget)),
            holdMs = holdMs,
            contentPaddingH = 0.dp,
            contentPaddingV = 0.dp,
            progressFeedback = HoldProgressFeedback.External { progress ->
                holding = progress != null
                onHoldProgress?.invoke(progress)
            },
        ) {
            BackDisc(enabled = true, pressed = holding, scrim = scrim, diameter = diameter)
        }
    }
}

/** The drawn disc both gestures share: contour + chevron step to ink and
 *  the disc dips while pressed. */
@Composable
private fun BackDisc(
    enabled: Boolean,
    pressed: Boolean,
    scrim: Boolean,
    diameter: Dp,
) {
    CircleBackDisc(
        enabled = enabled,
        pressed = pressed,
        scrim = scrim,
        diameter = diameter,
        chevronSize = MenuDesign.backChevronSize,
        pressScale = MenuDesign.backPressScale,
        scrimColor = MenuDesign.overlayScrim,
    )
}

/** A labelled non-destructive action (REFRESH, OPEN MAP) as quiet text:
 *  chrome stays reserved for hold-to-confirm verbs ([HoldPill]). */
@Composable
fun TextAction(
    text: String,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    labelProgress: CircleLabelProgress? = null,
) {
    val feedback = rememberCircleActionFeedbackState()
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .circleSafeTap(feedback = feedback, enabled = enabled, onTap = onTap)
            .padding(horizontal = 18.dp, vertical = 7.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text,
            color = if (enabled) RingTokens.Dim else RingTokens.NeutralRing,
            fontSize = MenuDesign.textActionSize,
            fontWeight = FontWeight.Bold,
            letterSpacing = MenuDesign.textActionTracking,
            modifier = Modifier.circleLabelProgress(
                progress = labelProgress,
                pressed = feedback.pressed,
            ),
        )
    }
}

/** A menu/content row in the circle language: the icon sits in a ring —
 *  the same shape as the launcher and the dial — and the row carries no
 *  other chrome. [ringActive] lights the ring: a toggle's state IS its
 *  ring. The whole row is the tap target so gloves land it. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun RingRow(
    title: String,
    sub: String,
    onTap: (() -> Unit)?,
    icon: ImageVector? = null,
    modifier: Modifier = Modifier,
    holdToConfirm: Boolean = false,
    holdMs: Long = 900L,
    onLongPress: (() -> Unit)? = null,
    ringActive: Boolean? = null,
    accent: CircleAccent = ringIconAccent(icon),
    semanticColor: Color? = null,
    labelProgress: CircleLabelProgress? = null,
    leading: (@Composable () -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
    centerValue: String? = null,
    actionTiming: CircleActionTiming = CircleActionTiming.DELIBERATE,
    actionHoldMs: Long = actionTiming.holdMs,
    /** One sentence about what this row does; read out by the centre cue. */
    hint: String = "",
    /** Optional verb rendered with the transient information card. */
    infoAction: CircleActionCueInfoAction? = null,
) {
    if (holdToConfirm) {
        val confirm = requireNotNull(onTap) { "A hold row requires an action" }
        val brandColor = circleBrandColor()
        var holdProgress by remember { mutableStateOf<Float?>(null) }
        val cue = if (icon != null) {
            rememberCircleActionCueController(
                icon = icon,
                label = title,
                timing = CircleActionTiming.DELIBERATE,
                pressed = false,
                holdDurationMs = holdMs,
                determinateProgress = holdProgress,
                stateValue = sub.takeIf { it.isNotBlank() },
                hint = hint.takeIf { it.isNotBlank() },
                infoAction = infoAction,
            )
        } else {
            null
        }
        HoldFillBox(
            onConfirm = {
                cue?.confirm()
                confirm()
            },
            fill = brandColor,
            background = Color.Transparent,
            shape = RectangleShape,
            holdMs = holdMs,
            modifier = modifier,
            contentPaddingH = MenuDesign.rowPaddingH,
            contentPaddingV = MenuDesign.rowPaddingV,
            contentAlignment = Alignment.CenterStart,
            progressFeedback = HoldProgressFeedback.External { holdProgress = it },
        ) {
            CircleRingRowContent(
                title = title,
                sub = sub,
                icon = icon,
                ringActive = ringActive,
                // A hold row is defined by having something to confirm; the
                // require above is what proves it, and the ring says so.
                affordance = CircleRowAffordance.of(confirm),
                accent = accent,
                semanticColor = semanticColor,
                leading = leading,
                trailing = trailing,
                labelProgress = labelProgress ?: holdProgress?.let {
                    CircleLabelProgress.Determinate(it.coerceIn(0f, 1f))
                },
                pressHoldMs = holdMs,
                centerValue = centerValue,
            )
        }
        return
    }
    CircleRingRow(
        title = title,
        sub = sub,
        onTap = onTap,
        icon = icon,
        modifier = modifier,
        onLongPress = onLongPress,
        ringActive = ringActive,
        accent = accent,
        semanticColor = semanticColor,
        labelProgress = labelProgress,
        leading = leading,
        trailing = trailing,
        centerValue = centerValue,
        actionTiming = actionTiming,
        actionHoldMs = actionHoldMs,
        hint = hint,
        infoAction = infoAction,
        // DERIVED, not passed: a row with no tap cannot publish its title to
        // the centre cue, so an ellipsis there is the last word rather than a
        // summary. Reading it off the row's own data means no caller can
        // forget it — the same reason RowKind is derived instead of declared.
        multiline = onTap == null,
    )
}

/** Neutral semantic icon + title used by every settings-row shape. */
@Composable
internal fun RowTitle(
    icon: ImageVector?,
    title: String,
    color: Color,
    iconColor: Color = RingTokens.Dim,
    fontSize: androidx.compose.ui.unit.TextUnit,
    letterSpacing: androidx.compose.ui.unit.TextUnit,
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        if (icon != null) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = iconColor,
                modifier = Modifier.size(13.dp),
            )
            Spacer(Modifier.size(5.dp))
        }
        Text(
            text = title,
            color = color,
            fontSize = fontSize,
            fontWeight = FontWeight.Bold,
            letterSpacing = letterSpacing,
            textAlign = TextAlign.Center,
            maxLines = 1,
        )
    }
}

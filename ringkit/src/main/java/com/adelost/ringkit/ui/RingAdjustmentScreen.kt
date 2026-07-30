package com.adelost.ringkit.ui

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Icon
import androidx.wear.compose.material.Text
import com.adelost.designkit.ui.LocalCircleSurfaceLayout
import com.adelost.designkit.ui.LocalRoundChromeReservation
import com.adelost.designkit.ui.CircleSurfaceClass
import com.adelost.designkit.ui.MenuDesign
import com.adelost.designkit.ui.RingIcons
import com.adelost.designkit.ui.RingTokens
import com.adelost.designkit.ui.CircleAccent
import com.adelost.designkit.ui.CircleAccentStrength
import com.adelost.designkit.ui.CircleLabelProgress
import com.adelost.designkit.ui.rememberCircleActionFeedbackState
import com.adelost.designkit.ui.ringIconAccent
import com.adelost.designkit.ui.circleAccentColor
import com.adelost.designkit.ui.circleBrandColor
import com.adelost.designkit.ui.circleLabelProgress
import com.adelost.designkit.ui.circleSafeTap
import kotlinx.coroutines.flow.map

internal fun RingScreen.Rows.adjustmentScreen(initial: RowSpec): RingScreen.Adjustment {
    require(rowKind(initial) == RowKind.ADJUSTMENT) {
        "Only a row with both decrement and increment actions can open an adjustment screen"
    }
    return RingScreen.Adjustment(
        title = initial.title,
        initial = initial,
        row = items.map { latest ->
            latest.firstOrNull { it.key == initial.key } ?: initial
        },
    )
}

/**
 * Parent lists never expose +/- inline. Every continuous setting becomes an
 * ordinary link row while keeping its own catalog icon and accent. Its
 * complete adjustment contract stays on the original [RowSpec] and is
 * consumed only inside [RingScreen.Adjustment].
 */
internal fun adjustmentLinkRow(
    row: RowSpec,
    open: () -> Unit,
): RowSpec {
    require(rowKind(row) == RowKind.ADJUSTMENT)
    return row.copy(
        onTap = open,
        labelProgress = null,
        onDec = null,
        onInc = null,
        enabled = null,
        onToggle = null,
        holdToConfirm = false,
        adjustHoldMs = null,
        choices = emptyList(),
        onSelect = null,
        centerHoldMs = null,
        centerValue = null,
        // kind follows: with the steppers cleared and onTap set, this IS an
        // action row.
    )
}

@Composable
internal fun RingAdjustmentScreen(screen: RingScreen.Adjustment) {
    val row = screen.row.collectAsState(initial = screen.initial).value
    BoxWithConstraints(Modifier.fillMaxSize()) {
        val round = LocalCircleSurfaceLayout.current.surfaceClass == CircleSurfaceClass.ROUND
        val insets = ringRowHorizontalInsets(
            round = round,
        )
        val adjustmentInset = adjustmentRowInsetDp(
            viewportWidthDp = maxWidth.value,
            viewportHeightDp = maxHeight.value,
            round = round,
            baseInsetDp = insets.start.value,
            reservedSlots = LocalRoundChromeReservation.current,
        ).dp
        Box(modifier = Modifier.fillMaxSize()) {
            ScreenTitle(screen.title)
            StepperPillRow(
                title = "VALUE",
                value = row.sub,
                icon = row.icon,
                semanticColor = row.semanticColor,
                accent = row.accent,
                onDec = requireNotNull(row.onDec),
                onInc = requireNotNull(row.onInc),
                enabled = row.enabled,
                onToggle = row.onToggle,
                adjustHoldMs = row.adjustHoldMs,
                centerHoldMs = row.centerHoldMs,
                // Adjustment is one shared layout on every round host. Its
                // controls sit on the face centreline, so reserve that exact
                // chord and the floating chrome there. Measuring the local
                // BoxWithConstraints is essential: a watch face preview is a
                // nested square inside a rectangular phone root.
                modifier = Modifier
                    .align(Alignment.Center)
                    .fillMaxWidth()
                    .padding(horizontal = adjustmentInset),
            )
        }
    }
}

@Composable
internal fun PhoneAdjustmentScreen(
    screen: RingScreen.Adjustment,
    back: () -> Unit,
) {
    val row = screen.row.collectAsState(initial = screen.initial).value
    Column(
        modifier = Modifier.fillMaxSize().widthIn(max = 640.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        PhoneScreenHeader(screen.title, back)
        Spacer(Modifier.height(28.dp))
        StepperPillRow(
            title = "VALUE",
            value = row.sub,
            icon = row.icon,
            semanticColor = row.semanticColor,
            accent = row.accent,
            onDec = requireNotNull(row.onDec),
            onInc = requireNotNull(row.onInc),
            enabled = row.enabled,
            onToggle = row.onToggle,
            adjustHoldMs = row.adjustHoldMs,
            centerHoldMs = row.centerHoldMs,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp),
        )
    }
}

/**
 * The adjustment family's private atom. It lives beside both host renderers,
 * so ordinary menu screens cannot accidentally reintroduce inline steppers.
 */
@Composable
private fun StepperPillRow(
    title: String,
    value: String,
    onDec: () -> Unit,
    onInc: () -> Unit,
    icon: ImageVector? = null,
    semanticColor: Color? = null,
    accent: CircleAccent = ringIconAccent(icon),
    enabled: Boolean? = null,
    onToggle: (() -> Unit)? = null,
    adjustHoldMs: Long? = null,
    centerHoldMs: Long? = null,
    modifier: Modifier = Modifier,
) {
    var adjustmentProgress by remember { mutableStateOf<Float?>(null) }
    val centreFeedback = rememberCircleActionFeedbackState()
    val brandColor = circleBrandColor()
    Row(verticalAlignment = Alignment.CenterVertically, modifier = modifier) {
        StepCircle(
            text = "−",
            onTap = onDec,
            holdMs = adjustHoldMs,
            onProgressChange = { adjustmentProgress = it },
        )
        val valueContent: @Composable () -> Unit = {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.circleLabelProgress(
                    progress = adjustmentProgress?.let {
                        CircleLabelProgress.Determinate(it.coerceIn(0f, 1f))
                    },
                    pressed = centreFeedback.pressed,
                    color = brandColor.copy(alpha = 0.35f),
                ),
            ) {
                RowTitle(
                    icon = if (enabled != null) icon else null,
                    title = title,
                    color = RingTokens.Dim,
                    iconColor = semanticColor
                        ?: circleAccentColor(accent, CircleAccentStrength.SUPPORTING),
                    fontSize = 8.5.sp,
                    letterSpacing = 0.2.sp,
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (icon != null && enabled == null) {
                        Icon(
                            imageVector = icon,
                            contentDescription = null,
                            tint = semanticColor
                                ?: circleAccentColor(accent, CircleAccentStrength.SUPPORTING),
                            modifier = Modifier.size(MenuDesign.stepperIconSize),
                        )
                        Spacer(Modifier.size(MenuDesign.stepperIconGap))
                    }
                    Text(
                        text = value,
                        color = if (enabled == false) {
                            (semanticColor ?: RingTokens.Dim).copy(alpha = 0.45f)
                        } else {
                            semanticColor ?: brandColor
                        },
                        fontSize = MenuDesign.stepperValueSize,
                        fontWeight = FontWeight.Black,
                        textAlign = TextAlign.Center,
                    )
                    if (enabled != null) {
                        Icon(
                            imageVector = if (enabled) RingIcons.Eye else RingIcons.EyeOff,
                            contentDescription = if (enabled) "Enabled" else "Disabled",
                            tint = if (enabled) brandColor else RingTokens.Dim,
                            modifier = Modifier.padding(start = 5.dp).size(13.dp),
                        )
                    }
                }
            }
        }
        val centreHoldMs = centerHoldMs ?: adjustHoldMs
        if (onToggle != null && centreHoldMs != null) {
            HoldFillBox(
                onConfirm = onToggle,
                fill = brandColor,
                background = Color.Transparent,
                holdMs = centreHoldMs,
                modifier = Modifier.weight(1f),
                contentPaddingH = 0.dp,
                contentPaddingV = 2.dp,
            ) { valueContent() }
        } else {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .then(
                        if (onToggle != null) {
                            Modifier.circleSafeTap(feedback = centreFeedback, onTap = onToggle)
                        } else {
                            Modifier
                        },
                    ),
                contentAlignment = Alignment.Center,
            ) { valueContent() }
        }
        StepCircle(
            text = "+",
            onTap = onInc,
            holdMs = adjustHoldMs,
            onProgressChange = { adjustmentProgress = it },
        )
    }
}

@Composable
private fun StepCircle(
    text: String,
    onTap: () -> Unit,
    holdMs: Long?,
    onProgressChange: (Float?) -> Unit,
) {
    val brandColor = circleBrandColor()
    if (holdMs != null) {
        HoldFillBox(
            onConfirm = onTap,
            fill = brandColor,
            background = Color.Transparent,
            outline = RingTokens.Outline,
            holdMs = holdMs,
            modifier = Modifier.size(MenuDesign.iconRingDiameter),
            contentPaddingH = 0.dp,
            contentPaddingV = 0.dp,
            progressFeedback = HoldProgressFeedback.External(onProgressChange),
        ) {
            Text(text = text, color = RingTokens.Ink, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        }
        return
    }
    val feedback = rememberCircleActionFeedbackState()
    Box(
        modifier = Modifier
            .size(MenuDesign.iconRingDiameter)
            .clip(CircleShape)
            .border(MenuDesign.contourStroke, RingTokens.Outline, CircleShape)
            .circleSafeTap(feedback = feedback, onTap = onTap),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text,
            color = RingTokens.Ink,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.circleLabelProgress(pressed = feedback.pressed),
        )
    }
}

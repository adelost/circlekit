package com.adelost.designkit.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Pixel-only icon-ring frame shared by tap and continuous-press gestures. */
@Composable
internal fun CircleIconRingFrame(
    icon: ImageVector,
    label: String,
    modifier: Modifier,
    diameter: Dp,
    active: Boolean?,
    accent: CircleAccent,
    fontFamily: FontFamily?,
    labelSize: TextUnit,
    centerValue: String?,
    contourColor: Color?,
    iconRotationDegrees: Float,
    choiceState: CircleChoiceState?,
    sub: String?,
    enabled: Boolean,
    gestureModifier: Modifier,
    semanticColor: Color? = null,
) {
    val fontScale = LocalDensity.current.fontScale
    val activeContour = circleBrandColor()
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = modifier) {
        Box(
            modifier = Modifier
                .size(diameter)
                .clip(CircleShape)
                .then(gestureModifier),
            contentAlignment = Alignment.Center,
        ) {
            if (contourColor != null) {
                Canvas(Modifier.size(diameter)) {
                    drawCircle(
                        color = contourColor,
                        radius = size.minDimension / 2f - 2.dp.toPx(),
                        style = Stroke(width = RingMetrics.StrokeWidth.toPx()),
                    )
                }
            } else {
                Box(
                    Modifier
                        .size(diameter)
                        .circleRingContour(
                            when {
                                !enabled -> RingTokens.Off
                                active == true -> activeContour
                                else -> MenuDesign.ringNeutral
                            },
                        ),
                )
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                CircleStyledIcon(
                    style = ringIconStyle(icon, accent),
                    contentDescription = label.takeUnless { LocalActionParentOwnsRowCopy.current },
                    tintOverride = when {
                        !enabled -> RingTokens.Off
                        centerValue != null -> RingTokens.Ink
                        else -> semanticColor
                    },
                    modifier = Modifier
                        .size(
                            diameter * if (centerValue != null) {
                                RingMetrics.StatIconFraction
                            } else {
                                RingMetrics.IconFraction
                            },
                        )
                        .rotate(iconRotationDegrees),
                )
                centerValue?.let { value ->
                    BasicText(
                        text = value,
                        style = TextStyle(
                            color = RingTokens.Ink,
                            fontSize = fixedCircleUiSp(MenuDesign.statValueSize.value, fontScale).sp,
                            fontFamily = fontFamily,
                            fontWeight = FontWeight.Black,
                            textAlign = TextAlign.Center,
                        ),
                        maxLines = 1,
                    )
                }
            }
            choiceState?.let { state ->
                CircleChoiceIndicator(
                    state = state,
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = 5.dp)
                        .size(width = (state.optionCount * 5 + 5).dp, height = 7.dp),
                )
            }
        }
        BasicText(
            text = label,
            style = TextStyle(
                color = if (enabled) RingTokens.Dim else RingTokens.Off,
                fontSize = fixedCircleUiSp(labelSize.value, fontScale).sp,
                fontFamily = fontFamily,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
                textAlign = TextAlign.Center,
            ),
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier
                .padding(top = 4.dp)
                .then(
                    if (LocalActionParentOwnsRowCopy.current) {
                        Modifier.clearAndSetSemantics { }
                    } else {
                        Modifier
                    },
                ),
        )
        sub?.let {
            BasicText(
                text = it,
                style = TextStyle(
                    color = if (enabled) RingTokens.Dim else RingTokens.Off,
                    fontSize = fixedCircleUiSp(labelSize.value * 0.72f, fontScale).sp,
                    fontFamily = fontFamily,
                    textAlign = TextAlign.Center,
                ),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .padding(top = 1.dp)
                    .then(
                        if (LocalActionParentOwnsRowCopy.current) {
                            Modifier.clearAndSetSemantics { }
                        } else {
                            Modifier
                        },
                    ),
            )
        }
    }
}

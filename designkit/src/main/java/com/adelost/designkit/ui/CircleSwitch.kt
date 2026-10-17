package com.adelost.designkit.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription

/**
 * On or off, drawn big enough to read on a 192 dp face (style C, Mattias 2026-10-17 on SYSTEM's tiny rail: "om det
 * ska synas på något tydligare sätt"). On is a track in the row's own colour with the knob to the right; off is the
 * grey that means off, with the knob to the left. The geometry is [CircleSwitchTokens]; the state's colour is
 * [circleSwitchLook].
 */
@Composable
fun CircleSwitch(on: Boolean, tones: CircleTones, modifier: Modifier = Modifier) {
    val position by animateFloatAsState(if (on) 1f else 0f, tween(durationMillis = 180), label = "circleSwitch")
    val look = circleSwitchLook(on, tones)
    Canvas(
        modifier
            .size(CircleSwitchTokens.Width, CircleSwitchTokens.Height)
            .semantics { stateDescription = if (on) "On" else "Off" },
    ) {
        val inset = CircleSwitchTokens.KnobInset.toPx()
        val knob = size.height / 2f - inset
        drawRoundRect(look.track, cornerRadius = CornerRadius(size.height / 2f))
        val x = size.height / 2f + (size.width - size.height) * position
        drawCircle(look.knob, radius = knob, center = Offset(x, size.height / 2f))
    }
}

/** A switch's two colours: the track and its knob. */
data class CircleSwitchLook(val track: Color, val knob: Color)

/** On lights the track in the row's strong colour under a black knob; off is the off grey under a muted one. */
fun circleSwitchLook(on: Boolean, tones: CircleTones): CircleSwitchLook =
    if (on) CircleSwitchLook(track = tones.strong, knob = CircleStyleTokens.Surface)
    else CircleSwitchLook(track = CircleStyleTokens.Off, knob = CircleStyleTokens.ActionMuted)

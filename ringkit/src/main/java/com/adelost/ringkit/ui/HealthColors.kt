package com.adelost.ringkit.ui

import com.adelost.designkit.ui.*

import androidx.compose.ui.graphics.Color
import com.adelost.ringkit.data.Health

/** Watch-only health semantics layered on the shared product palette. */
internal fun Health.ringColor(): Color = when (this) {
    Health.FRESH -> RingTokens.Fresh
    Health.AGING -> RingTokens.Aging
    Health.BROKEN -> RingTokens.Broken
    Health.OFF -> RingTokens.Off
}

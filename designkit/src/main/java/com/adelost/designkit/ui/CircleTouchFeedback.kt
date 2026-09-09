package com.adelost.designkit.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.hapticfeedback.HapticFeedback
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback

/**
 * One product setting at the UI root gates the existing Compose feedback port.
 * This is touch acknowledgement, never the alarm/vibration channel. The
 * platform still decides whether its haptic request can be performed.
 */
@Composable
fun CircleTouchFeedback(enabled: Boolean, content: @Composable () -> Unit) {
    val currentEnabled = rememberUpdatedState(enabled)
    val upstream = LocalHapticFeedback.current
    val gated = remember(upstream) {
        object : HapticFeedback {
            override fun performHapticFeedback(hapticFeedbackType: HapticFeedbackType) {
                if (currentEnabled.value) upstream.performHapticFeedback(hapticFeedbackType)
            }
        }
    }
    CompositionLocalProvider(LocalHapticFeedback provides gated, content = content)
}

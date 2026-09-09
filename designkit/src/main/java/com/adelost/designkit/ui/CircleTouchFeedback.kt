package com.adelost.designkit.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.hapticfeedback.HapticFeedback
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback

// Dialog installs a fresh LocalHapticFeedback. Carry the already-gated port
// through our own local so opening a window cannot bypass the product choice.
private val LocalCircleTouchPort = staticCompositionLocalOf<HapticFeedback?> { null }

/** The same host-owned touch port in route content, popups and Dialogs. */
@Composable
fun circleTouchHapticFeedback(): HapticFeedback =
    LocalCircleTouchPort.current ?: LocalHapticFeedback.current

/**
 * One product setting at the UI root gates the existing Compose feedback port.
 * This is touch acknowledgement, never the alarm/vibration channel. The
 * platform still decides whether its haptic request can be performed.
 */
@Composable
fun CircleTouchFeedback(enabled: Boolean, content: @Composable () -> Unit) {
    val currentEnabled = rememberUpdatedState(enabled)
    val upstream = circleTouchHapticFeedback()
    val gated = remember(upstream) {
        object : HapticFeedback {
            override fun performHapticFeedback(hapticFeedbackType: HapticFeedbackType) {
                if (currentEnabled.value) upstream.performHapticFeedback(hapticFeedbackType)
            }
        }
    }
    CompositionLocalProvider(
        LocalCircleTouchPort provides gated,
        LocalHapticFeedback provides gated,
        content = content,
    )
}

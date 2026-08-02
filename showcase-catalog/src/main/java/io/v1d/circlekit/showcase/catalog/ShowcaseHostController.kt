package io.v1d.circlekit.showcase.catalog

import android.content.Context
import com.adelost.designkit.ui.CircleHostMode
import com.adelost.designkit.ui.CircleHostOrientation
import com.adelost.designkit.ui.CircleHostPreviewPreferences
import com.adelost.designkit.ui.CircleHostPreviewState
import com.adelost.designkit.ui.resolveCircleHostMode
import com.adelost.ringkit.ui.CircleHostPreviewPort
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Product-neutral owner for the shared DEV host state. It never owns app navigation. */
class ShowcaseHostController(
    context: Context,
    private val isWatchDevice: Boolean,
    private val onOrientationChanged: (CircleHostOrientation) -> Unit,
) {
    private val preferences = CircleHostPreviewPreferences(context, "showcase")
    private val mutableState = MutableStateFlow(
        preferences.load().let { stored ->
            stored.copy(mode = resolveCircleHostMode(isWatchDevice, null, stored.mode))
        },
    )
    val state: StateFlow<CircleHostPreviewState> = mutableState.asStateFlow()

    val port = CircleHostPreviewPort(
        isWatchDevice = isWatchDevice,
        state = state,
        systemOrientationAllowed = !isWatchDevice,
        onMode = { update(state.value.copy(mode = resolveCircleHostMode(isWatchDevice, null, it))) },
        onDiameter = { update(state.value.copy(watchDiameterDp = it)) },
        onOrientation = { update(state.value.copy(orientation = it)) },
    )

    fun restoreOrientation() {
        if (!isWatchDevice) onOrientationChanged(state.value.orientation)
    }

    fun handleProbe(command: ShowcaseProbeCommand): Boolean? = when (command.verb.lowercase()) {
        "host-mode" -> setEnum(command.value, CircleHostMode.entries) { port.onMode(it) }
        "watch-diameter" -> command.value?.toFloatOrNull()?.let { port.onDiameter(it); true } ?: false
        "orientation" -> setEnum(command.value, CircleHostOrientation.entries) { port.onOrientation(it) }
        else -> null
    }

    private fun update(next: CircleHostPreviewState) {
        val resolved = next.copy(mode = resolveCircleHostMode(isWatchDevice, null, next.mode))
        preferences.save(resolved)
        mutableState.value = resolved
        if (!isWatchDevice) onOrientationChanged(resolved.orientation)
    }

    private inline fun <reified T : Enum<T>> setEnum(
        raw: String?,
        values: List<T>,
        apply: (T) -> Unit,
    ): Boolean {
        val selected = values.singleOrNull { it.name == raw?.uppercase() } ?: return false
        apply(selected)
        return true
    }
}

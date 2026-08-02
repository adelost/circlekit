package io.v1d.circlekit.showcase.catalog

import com.adelost.designkit.ui.CircleChoiceRole
import com.adelost.designkit.ui.RingIcons
import com.adelost.releasekit.UpdateState
import com.adelost.ringkit.ui.CircleHostPreviewPort
import com.adelost.ringkit.ui.LaunchSpec
import com.adelost.ringkit.ui.RingScreen
import com.adelost.ringkit.ui.RowSpec
import com.adelost.ringkit.ui.circleHostPreviewScreen
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine

data class ShowcaseUpdatePort(
    val currentVersionName: String,
    val state: StateFlow<UpdateState>,
    val autoUpdate: StateFlow<Boolean>,
    val onAutoUpdate: (Boolean) -> Unit,
    val onCheck: () -> Unit,
    val onInstall: () -> Unit,
)

data class ShowcaseDevPort(
    val host: CircleHostPreviewPort,
    val update: ShowcaseUpdatePort,
)

internal object ShowcaseDevScreens {
    fun root(port: ShowcaseDevPort): RingScreen = RingScreen.Launcher(
        title = "DEV",
        gridRole = com.adelost.designkit.ui.MenuGridRole.SETTINGS,
        entries = listOf(
            LaunchSpec(RingIcons.Phone, "HOST", open = { circleHostPreviewScreen(port.host) }),
            LaunchSpec(RingIcons.Download, "UPDATE", open = { update(port.update) }),
        ),
    )

    private fun update(port: ShowcaseUpdatePort): RingScreen = RingScreen.Rows(
        title = "AUTO UPDATE",
        items = combine(port.state, port.autoUpdate) { state, automatic ->
            listOf(
                RowSpec(
                    key = "auto-update",
                    title = "AUTO-UPDATE",
                    sub = if (automatic) "ON" else "OFF",
                    icon = RingIcons.Download,
                    choices = listOf("OFF", "ON"),
                    choiceRole = CircleChoiceRole.TOGGLE,
                    onSelect = { selected -> port.onAutoUpdate(selected == "ON") },
                ),
                RowSpec(
                    key = "update-state",
                    title = "VERSION",
                    sub = updateLabel(state, port.currentVersionName),
                    icon = RingIcons.Download,
                    onTap = when (state) {
                        is UpdateState.Available,
                        is UpdateState.ReadyToInstall,
                        is UpdateState.InstallFailed -> port.onInstall
                        UpdateState.Checking,
                        is UpdateState.Downloading,
                        is UpdateState.Installing -> null
                        else -> port.onCheck
                    },
                ),
            )
        },
    )
}

internal fun updateLabel(state: UpdateState, currentVersionName: String): String = when (state) {
    is UpdateState.Available -> "v${state.versionName} AVAILABLE · TAP"
    is UpdateState.ReadyToInstall -> "v${state.versionName} READY · TAP"
    is UpdateState.Downloading -> "${(state.progress * 100f).toInt()}%"
    is UpdateState.Installing -> "INSTALLING v${state.versionName}"
    UpdateState.Checking -> "CHECKING…"
    is UpdateState.Failed -> "FAILED · TAP TO RETRY"
    is UpdateState.InstallFailed -> "INSTALL FAILED · TAP"
    UpdateState.UpToDate -> "v$currentVersionName · UP TO DATE · TAP"
    is UpdateState.Unavailable -> state.reason.uppercase()
    UpdateState.Idle -> "v$currentVersionName · TAP TO CHECK"
}

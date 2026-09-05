package com.adelost.releasekit.ui

import com.adelost.designkit.ui.CircleChoiceRole
import com.adelost.designkit.ui.RingIcons
import com.adelost.releasekit.UpdateState
import com.adelost.ringkit.ui.RingScreen
import com.adelost.ringkit.ui.RowSpec
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine

/** One real updater boundary; the controller, not the screen, owns download/install. */
data class ReleaseUpdatePort(
    val currentVersionName: String,
    val state: StateFlow<UpdateState>,
    val autoUpdate: StateFlow<Boolean>,
    val onAutoUpdate: (Boolean) -> Unit,
    val onCheck: () -> Unit,
    val onInstall: () -> Unit,
)

fun releaseUpdateScreen(port: ReleaseUpdatePort): RingScreen.Rows = RingScreen.Rows(
    title = "APP UPDATE",
    items = combine(port.state, port.autoUpdate) { state, automatic ->
        releaseUpdateRows(
            state = state,
            currentVersionName = port.currentVersionName,
            onCheck = port.onCheck,
            onInstall = port.onInstall,
            updateTitle = "VERSION",
        ) + listOf(
            RowSpec(
                key = "auto-update",
                title = "AUTO-UPDATE",
                sub = if (automatic) "ON" else "OFF",
                icon = RingIcons.Download,
                choices = listOf("OFF", "ON"),
                choiceRole = CircleChoiceRole.TOGGLE,
                onSelect = { port.onAutoUpdate(it == "ON") },
            ),
            RowSpec(
                key = "update-explanation",
                title = "HOW IT WORKS",
                sub = "When ON, checks on app start and downloads verified updates. When READY, tap VERSION, then confirm in Android. OFF keeps manual checks available.",
                icon = null,
            ),
        )
    },
)

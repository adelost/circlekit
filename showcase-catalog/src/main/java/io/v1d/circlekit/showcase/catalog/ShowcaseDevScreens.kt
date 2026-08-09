package io.v1d.circlekit.showcase.catalog

import com.adelost.designkit.ui.CircleChoiceRole
import com.adelost.designkit.ui.RingIcons
import com.adelost.releasekit.UpdateState
import com.adelost.releasekit.ui.releaseUpdateRows
import com.adelost.ringkit.ui.CircleHostPreviewPort
import com.adelost.ringkit.ui.LaunchSpec
import com.adelost.ringkit.ui.RingScreen
import com.adelost.ringkit.ui.RowSpec
import com.adelost.ringkit.ui.circleHostPreviewScreen
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flowOf

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
            LaunchSpec(RingIcons.Wrench, "GRAPH", open = ::productGraph),
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
            ) + releaseUpdateRows(
                state = state,
                currentVersionName = port.currentVersionName,
                updateKey = "update-state",
                updateTitle = "VERSION",
                onCheck = port.onCheck,
                onInstall = port.onInstall,
            )
        },
    )

    private fun productGraph(): RingScreen = RingScreen.Rows(
        title = "PRODUCT GRAPH",
        items = flowOf(
            ShowcaseProductInspectorRegistry.nodes.map { node ->
                val portCount = ShowcaseProductInspectorRegistry.ports.count { it.ownerId == node.id }
                RowSpec(
                    key = "node.${node.id}",
                    title = node.id.uppercase(),
                    sub = "${node.kind.uppercase()} · ${node.typeRef} · $portCount PORTS",
                    icon = if (node.kind == "service") RingIcons.Wrench else RingIcons.Grid,
                )
            } + ShowcaseProductInspectorRegistry.ports.map { port ->
                RowSpec(
                    key = "port.${port.ref}",
                    title = port.ref.uppercase(),
                    sub = "${port.direction.uppercase()} · ${port.contractRef}",
                    icon = if (port.ownerKind == "component") RingIcons.Grid else RingIcons.Wifi,
                )
            },
        ),
    )
}

package io.v1d.circlekit.showcase.catalog

import com.adelost.designkit.ui.RingIcons
import com.adelost.designkit.ui.MenuGridRole
import com.adelost.ringkit.ui.LaunchSpec
import com.adelost.ringkit.ui.RingScreen
import com.adelost.ringkit.ui.RowSpec
import kotlinx.coroutines.flow.flowOf

/** Read-only drill-down of declared connections, not a service-health monitor. */
internal object ShowcaseStructureScreens {
    private val registry get() = ShowcaseProductInspectorRegistry

    fun root(): RingScreen = RingScreen.Launcher(
        title = "APP STRUCTURE",
        gridRole = MenuGridRole.SETTINGS,
        entries = listOf(
            LaunchSpec(RingIcons.Book, "READ ME", open = {
                RingScreen.Rows("WHAT THIS SHOWS", flowOf(listOf(
                    RowSpec("scope", "CATALOG CONNECTIONS",
                        "Which demo reads which data and where its actions go. Select a component to follow its connections.", null),
                    RowSpec("limit", "DECLARED, NOT LIVE",
                        "This is the generated demo catalog, not a health graph. Android host tools and the app updater run outside this catalog.", null),
                )))
            }),
            LaunchSpec(RingIcons.Grid, "COMPONENTS", open = { owners("component") }),
            LaunchSpec(RingIcons.Wrench, "DATA PATH", open = { owners("node") }),
        ),
    )

    private fun owners(kind: String): RingScreen = RingScreen.Launcher(
        title = if (kind == "component") "COMPONENTS" else "DATA PATH",
        gridRole = MenuGridRole.SETTINGS,
        entries = registry.ports.filter { it.ownerKind == kind }.map { it.ownerId }.distinct().map { id ->
            val case = ShowcaseManifest.find(ShowcaseCaseId(id))
            LaunchSpec(
                icon = case?.let { ShowcaseNativeBindings.requireIcon(it.iconId) } ?: RingIcons.Grid,
                label = case?.title ?: id.substringAfterLast('.').replace('-', ' ').uppercase(),
                open = { detail(id) },
            )
        },
    )

    internal fun detail(owner: String): RingScreen.Rows {
        val ports = registry.ports.filter { it.ownerId == owner }
        require(ports.isNotEmpty()) { "Unknown catalog owner $owner" }
        return RingScreen.Rows(
            title = ShowcaseManifest.find(ShowcaseCaseId(owner))?.title ?: "CONNECTIONS",
            items = flowOf(listOf(RowSpec("owner", "CATALOG ID", owner, null)) + ports.flatMap { port ->
                val bindings = registry.bindings.filter { it.from == port.ref || it.to == port.ref }
                listOf(RowSpec(port.ref, "${port.direction.uppercase()} · ${port.portId.uppercase()}",
                    "Type: ${port.contractRef}", null)) + bindings.map { binding ->
                    val incoming = binding.to == port.ref
                    val peer = if (incoming) binding.from else binding.to
                    RowSpec("${port.ref}:$peer", if (incoming) "READS FROM" else "SENDS TO", peer, null)
                }
            }),
        )
    }
}

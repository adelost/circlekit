package io.v1d.circlekit.showcase.catalog

import com.adelost.designkit.ui.RingIcons
import com.adelost.releasekit.ui.ReleaseUpdatePort
import com.adelost.ringkit.ui.CircleHostPreviewPort
import com.adelost.ringkit.ui.LaunchSpec
import com.adelost.ringkit.ui.RingScreen
import com.adelost.ringkit.ui.circleHostPreviewScreen

data class ShowcaseDevPort(
    val host: CircleHostPreviewPort,
    val update: ReleaseUpdatePort,
)

internal object ShowcaseDevScreens {
    fun root(port: ShowcaseDevPort): RingScreen = RingScreen.Launcher(
        title = "DEV",
        gridRole = com.adelost.designkit.ui.MenuGridRole.SETTINGS,
        entries = listOf(
            LaunchSpec(RingIcons.Phone, "HOST", open = { circleHostPreviewScreen(port.host) }),
            LaunchSpec(RingIcons.Grid, "STRUCTURE", open = ShowcaseStructureScreens::root),
        ),
    )

}

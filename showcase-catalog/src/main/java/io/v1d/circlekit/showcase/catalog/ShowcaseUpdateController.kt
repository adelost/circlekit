package io.v1d.circlekit.showcase.catalog

import android.content.Context
import com.adelost.releasekit.UpdateController
import com.adelost.releasekit.ui.ReleaseUpdatePort
import kotlinx.coroutines.CoroutineScope

class ShowcaseUpdateController(
    context: Context,
    scope: CoroutineScope,
    host: ShowcaseReleaseHost,
    currentVersionName: String,
    currentVersionCode: Int,
) {
    private val controller = UpdateController(
        context = context,
        scope = scope,
        product = ShowcaseReleaseProducts.product(host),
        currentVersionName = currentVersionName,
        currentVersionCode = currentVersionCode,
    )

    val port = ReleaseUpdatePort(
        currentVersionName = currentVersionName,
        state = controller.state,
        autoUpdate = controller.autoUpdate,
        onAutoUpdate = controller::setAutoUpdate,
        onCheck = controller::checkNow,
        onInstall = controller::downloadAndInstall,
    )
}

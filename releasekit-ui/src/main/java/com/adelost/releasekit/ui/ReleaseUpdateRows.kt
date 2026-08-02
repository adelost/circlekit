package com.adelost.releasekit.ui

import com.adelost.designkit.ui.CircleLabelProgress
import com.adelost.designkit.ui.RingIcons
import com.adelost.designkit.ui.RingTokens
import com.adelost.releasekit.UpdateProgress
import com.adelost.releasekit.UpdateRowAction
import com.adelost.releasekit.UpdateState
import com.adelost.releasekit.releaseInfoPresentation
import com.adelost.releasekit.updateRowModel
import com.adelost.ringkit.ui.RowSpec
import java.time.ZoneId
import java.util.Locale

/**
 * The canonical ReleaseKit row projection for Phone and round Wear hosts.
 *
 * Products supply only their current version and typed workflow callbacks.
 * ReleaseKit owns action/progress state; this atom owns icons, row structure,
 * semantic failure colour and the locale/timezone presentation boundary.
 */
fun releaseUpdateRows(
    state: UpdateState,
    currentVersionName: String,
    onCheck: () -> Unit,
    onInstall: () -> Unit,
    updateKey: String = "update",
    updateTitle: String = "UPDATE",
    hint: String = "",
    zoneId: ZoneId = ZoneId.systemDefault(),
    locale: Locale = Locale.getDefault(),
): List<RowSpec> {
    val model = updateRowModel(state, currentVersionName)
    val updateRow = RowSpec(
        key = updateKey,
        title = updateTitle,
        sub = model.sub,
        icon = RingIcons.Download,
        hint = hint,
        semanticColor = RingTokens.Broken.takeIf {
            state is UpdateState.Failed || state is UpdateState.InstallFailed
        },
        onTap = when (model.action) {
            UpdateRowAction.NONE -> null
            UpdateRowAction.CHECK -> onCheck
            UpdateRowAction.INSTALL -> onInstall
        },
        labelProgress = model.progress.toLabelProgress(),
    )
    val publishedRow = model.releaseInfo
        ?.let { releaseInfoPresentation(it, zoneId, locale) }
        ?.let { presentation ->
            presentation.publishedAtLabel?.let { label ->
                RowSpec(
                    key = "$updateKey-published",
                    title = "PUBLISHED",
                    sub = "v${presentation.versionName} · $label",
                    icon = RingIcons.Calendar,
                )
            }
        }
    return listOfNotNull(updateRow, publishedRow)
}

private fun UpdateProgress?.toLabelProgress(): CircleLabelProgress? = when (this) {
    UpdateProgress.Indeterminate -> CircleLabelProgress.Indeterminate
    is UpdateProgress.Determinate -> CircleLabelProgress.Determinate(fraction)
    null -> null
}

package com.adelost.releasekit

/**
 * What an update row says and offers, for every product.
 *
 * Circle and Agentmux Link both render a single "UPDATE" row that has to name
 * eight states and decide which tap each one accepts. Written twice, the two
 * drift: one app says READY while the other says "Verified · tap Install", and
 * a state added to [UpdateState] gets a sentence in one place only.
 *
 * The projection is data, not Compose. Presentation policy belongs beside the
 * state it describes, but a UI kit must not have to depend on an update
 * engine to draw a list — so each product maps [UpdateRowModel] onto its own
 * row atom in a few lines, choosing its own icon and placement.
 */
data class UpdateRowModel(
    val sub: String,
    val action: UpdateRowAction,
    val progress: UpdateProgress?,
)

/** Which call a tap on the row should make, or none while work is in flight. */
enum class UpdateRowAction { NONE, CHECK, INSTALL }

sealed interface UpdateProgress {
    /** Work is running but its length is unknown — a check, or an install. */
    data object Indeterminate : UpdateProgress

    /** A download, as a 0..1 fraction. */
    data class Determinate(val fraction: Float) : UpdateProgress
}

/**
 * One state projection keeps title, verb and progress identity stable.
 *
 * A tap always means the most useful next step: retry what failed, install
 * what is ready, and otherwise check. Nothing is tappable while a download or
 * install is already running, so a second tap cannot re-enter a live flow.
 */
fun updateRowModel(state: UpdateState, currentVersionName: String): UpdateRowModel {
    val (sub, action) = when (state) {
        is UpdateState.Available -> "v${state.versionName} AVAILABLE · TAP" to UpdateRowAction.INSTALL
        is UpdateState.ReadyToInstall -> "v${state.versionName} READY · TAP" to UpdateRowAction.INSTALL
        is UpdateState.Downloading ->
            "DOWNLOADING… ${downloadPercent(state.progress)}%" to UpdateRowAction.NONE
        is UpdateState.Installing -> if (state.awaitingUserConfirmation) {
            "CONFIRM TO INSTALL" to UpdateRowAction.NONE
        } else {
            "INSTALLING…" to UpdateRowAction.NONE
        }
        is UpdateState.Checking -> "CHECKING…" to UpdateRowAction.NONE
        is UpdateState.Failed -> "FAILED · TAP TO RETRY" to UpdateRowAction.CHECK
        is UpdateState.InstallFailed -> "INSTALL FAILED · TAP" to UpdateRowAction.INSTALL
        is UpdateState.UpToDate -> "v$currentVersionName · UP TO DATE · TAP" to UpdateRowAction.CHECK
        else -> "v$currentVersionName · TAP TO CHECK" to UpdateRowAction.CHECK
    }
    return UpdateRowModel(sub, action, updateRowProgress(state))
}

/** Update state is data; each host owns how this feedback is drawn. */
fun updateRowProgress(state: UpdateState): UpdateProgress? = when (state) {
    UpdateState.Checking -> UpdateProgress.Indeterminate
    is UpdateState.Downloading ->
        UpdateProgress.Determinate(state.progress.coerceIn(0f, 1f))
    is UpdateState.Installing -> if (state.awaitingUserConfirmation) {
        null
    } else {
        UpdateProgress.Indeterminate
    }
    else -> null
}

private fun downloadPercent(progress: Float): Int = (progress.coerceIn(0f, 1f) * 100f).toInt()

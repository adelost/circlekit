package com.adelost.releasekit

/** Shared update workflow states. Product Compose shells only decide how to render them. */
sealed class UpdateState {
    data object Idle : UpdateState()
    data object Checking : UpdateState()
    data object UpToDate : UpdateState()
    data class Unavailable(val reason: String) : UpdateState()
    data class Available(
        val versionName: String,
        val sizeBytes: Long,
        val changelog: String = "",
    ) : UpdateState()
    data class Downloading(
        val versionName: String,
        val progress: Float,
        val sizeBytes: Long? = null,
        val changelog: String = "",
    ) : UpdateState()
    data class ReadyToInstall(
        val versionName: String,
        val apkPath: String,
        val sizeBytes: Long? = null,
        val changelog: String = "",
    ) : UpdateState()
    data class Installing(
        val versionName: String,
        val apkPath: String,
        val sizeBytes: Long? = null,
        val awaitingUserConfirmation: Boolean = false,
        val changelog: String = "",
    ) : UpdateState()
    data class InstallFailed(
        val versionName: String,
        val apkPath: String,
        val reason: String,
        val sizeBytes: Long? = null,
        val changelog: String = "",
    ) : UpdateState()
    data class Failed(val reason: String) : UpdateState()
}

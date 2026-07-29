package com.adelost.releasekit

fun canCheckForUpdates(state: UpdateState): Boolean =
    state !is UpdateState.Checking && state !is UpdateState.Downloading && state !is UpdateState.Installing

fun canStartUpdateInstall(state: UpdateState): Boolean =
    state is UpdateState.Available || state is UpdateState.ReadyToInstall || state is UpdateState.InstallFailed

/**
 * The state an install tap claims immediately, before any IO happens.
 *
 * Handing a downloaded apk to the installer first re-hashes the whole file,
 * which is seconds on a watch. Publishing INSTALLING only after that made the
 * row keep saying "READY · TAP" while nothing visibly happened, so the button
 * read as dead and invited a second tap. Null means this state has nothing
 * downloaded to install yet.
 */
fun installClaimState(state: UpdateState): UpdateState.Installing? = when (state) {
    is UpdateState.ReadyToInstall -> UpdateState.Installing(
        state.versionName,
        state.apkPath,
        state.sizeBytes,
        changelog = state.changelog,
    )
    is UpdateState.InstallFailed -> UpdateState.Installing(
        state.versionName,
        state.apkPath,
        state.sizeBytes,
        changelog = state.changelog,
    )
    else -> null
}

fun installActionLabel(state: UpdateState): String = when (state) {
    is UpdateState.Downloading -> "Downloading…"
    is UpdateState.Installing -> "Installing…"
    is UpdateState.InstallFailed -> "Retry install"
    else -> "Install"
}

data class UpdateVersionOverview(
    val installedLabel: String,
    val latestLabel: String,
    val gapLabel: String?,
)

fun updateVersionOverview(
    currentVersionName: String,
    currentVersionCode: Int,
    state: UpdateState,
): UpdateVersionOverview {
    val latest = updateTargetVersionName(state)
    val gapParts = listOfNotNull(
        latest?.let { updateGapLabel(currentVersionName, it) },
        updateSizeLabel(updateTargetSizeBytes(state)),
    )
    return UpdateVersionOverview(
        installedLabel = "v$currentVersionName · $currentVersionCode",
        latestLabel = when {
            latest != null -> "v$latest"
            state is UpdateState.UpToDate -> "v$currentVersionName"
            state is UpdateState.Checking -> "Checking…"
            state is UpdateState.Failed || state is UpdateState.Unavailable -> "Unknown"
            else -> "Check now"
        },
        gapLabel = gapParts.takeIf { it.isNotEmpty() }?.joinToString(" · "),
    )
}

private fun updateTargetVersionName(state: UpdateState): String? = when (state) {
    is UpdateState.Available -> state.versionName
    is UpdateState.Downloading -> state.versionName
    is UpdateState.ReadyToInstall -> state.versionName
    is UpdateState.Installing -> state.versionName
    is UpdateState.InstallFailed -> state.versionName
    else -> null
}

fun updateTargetSizeBytes(state: UpdateState): Long? = when (state) {
    is UpdateState.Available -> state.sizeBytes
    is UpdateState.Downloading -> state.sizeBytes
    is UpdateState.ReadyToInstall -> state.sizeBytes
    is UpdateState.Installing -> state.sizeBytes
    is UpdateState.InstallFailed -> state.sizeBytes
    else -> null
}

/** Verified release notes carried by every state that still represents that release. */
fun updateTargetChangelog(state: UpdateState): String = when (state) {
    is UpdateState.Available -> state.changelog
    is UpdateState.Downloading -> state.changelog
    is UpdateState.ReadyToInstall -> state.changelog
    is UpdateState.Installing -> state.changelog
    is UpdateState.InstallFailed -> state.changelog
    else -> ""
}

fun updateSizeLabel(sizeBytes: Long?): String? {
    val bytes = sizeBytes?.takeIf { it > 0L } ?: return null
    val mb = bytes.toDouble() / 1_000_000.0
    return if (mb < 10.0) "%.1f MB".format(java.util.Locale.US, mb) else "${mb.toInt()} MB"
}

private const val INSTALL_STORAGE_MIN_FREE_BYTES = 120L * 1024L * 1024L
private const val INSTALL_STORAGE_APK_MULTIPLIER = 3L

fun requiredFreeBytesForInstall(apkSizeBytes: Long): Long = maxOf(
    INSTALL_STORAGE_MIN_FREE_BYTES,
    apkSizeBytes.coerceAtLeast(0L) * INSTALL_STORAGE_APK_MULTIPLIER,
)

fun installStorageFailureLabel(apkSizeBytes: Long, freeBytes: Long?): String? {
    if (apkSizeBytes <= 0L || freeBytes == null || freeBytes <= 0L) return null
    if (freeBytes >= requiredFreeBytesForInstall(apkSizeBytes)) return null
    return "Not enough storage · free ${updateSizeLabel(freeBytes) ?: "low"}"
}

fun updateGapLabel(currentVersionName: String, latestVersionName: String): String? {
    val current = SemanticVersion.parse(currentVersionName) ?: return null
    val latest = SemanticVersion.parse(latestVersionName) ?: return null
    if (latest <= current) return null
    if (current.major == latest.major && current.minor == latest.minor) {
        val patches = latest.patch - current.patch
        if (patches > 0) return if (patches == 1) "1 patch behind" else "$patches patches behind"
    }
    return "Update available"
}

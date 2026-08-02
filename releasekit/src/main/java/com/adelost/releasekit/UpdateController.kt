package com.adelost.releasekit

import android.content.Context
import java.io.File
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** One shared Android workflow; app modules supply identity and render their own UI. */
class UpdateController(
    context: Context,
    private val scope: CoroutineScope,
    private val product: ReleaseProductContract,
    val currentVersionName: String,
    val currentVersionCode: Int,
    private val automaticCheckAllowed: StateFlow<Boolean> = MutableStateFlow(true),
    private val releaseSource: ReleaseSource = PublicReleaseSource,
    private val nowEpochMs: () -> Long = System::currentTimeMillis,
) {
    private val appContext = context.applicationContext
    private val prefs = UpdatePrefs(appContext, product.id)
    private var candidate: ReleaseCandidate? = null

    private val mutableState = MutableStateFlow<UpdateState>(UpdateState.Idle)
    val state: StateFlow<UpdateState> = mutableState.asStateFlow()
    private val mutableAutoUpdate = MutableStateFlow(true)
    val autoUpdate: StateFlow<Boolean> = mutableAutoUpdate.asStateFlow()

    init {
        observeInstallEvents()
        scope.launch {
            val auto = withContext(Dispatchers.IO) { prefs.autoUpdateEnabled }
            mutableAutoUpdate.value = auto
            withContext(Dispatchers.IO) { restoreReadyState() }?.let { mutableState.value = it }
            automaticCheckAllowed.filter { it }.first()
            if (mutableAutoUpdate.value) checkNow()
        }
    }

    fun setAutoUpdate(enabled: Boolean) {
        mutableAutoUpdate.value = enabled
        scope.launch(Dispatchers.IO) { prefs.autoUpdateEnabled = enabled }
        if (enabled && automaticCheckAllowed.value && mutableState.value is UpdateState.Idle) checkNow()
    }

    fun checkNow() {
        if (!canCheckForUpdates(mutableState.value)) return
        // Claim the check synchronously so init/manual taps cannot launch two
        // metadata requests before the coroutine reaches its first dispatch.
        mutableState.value = UpdateState.Checking
        scope.launch {
            val restored = withContext(Dispatchers.IO) { restoreReadyState() }
            if (restored != null) {
                mutableState.value = restored
                return@launch
            }
            val result = withContext(Dispatchers.IO) { releaseSource.fetchNewest(product) }
            withContext(Dispatchers.IO) { prefs.lastCheckMs = nowEpochMs() }
            when (result) {
                is ReleaseFetchResult.Failure -> mutableState.value = UpdateState.Failed(result.reason)
                is ReleaseFetchResult.Success -> applyFetchedCandidate(result.candidate)
            }
        }
    }

    fun downloadAndInstall() {
        val state = mutableState.value
        if (state is UpdateState.Available) return download(installAfterDownload = true)
        install(installClaimState(state) ?: return)
    }

    private fun applyFetchedCandidate(fetched: ReleaseCandidate?) {
        candidate = fetched
        val next = fetchedReleaseState(
            fetched,
            product,
            currentVersionName,
            currentVersionCode,
            nowEpochMs(),
        )
        mutableState.value = next
        if (mutableAutoUpdate.value && next is UpdateState.Available) download(installAfterDownload = false)
    }

    private fun download(installAfterDownload: Boolean) {
        val release = candidate ?: return
        val state = mutableState.value
        if (state !is UpdateState.Available) return
        mutableState.value = UpdateState.Downloading(
            release.versionName,
            0f,
            release.sizeBytes,
            release.changelog,
            release.publishedAtEpochMillis,
        )
        scope.launch {
            val result = withContext(Dispatchers.IO) {
                SecureApkDownloader.download(appContext, product, release) { progress ->
                    mutableState.value = UpdateState.Downloading(
                        release.versionName,
                        progress,
                        release.sizeBytes,
                        release.changelog,
                        release.publishedAtEpochMillis,
                    )
                }
            }
            when (result) {
                is ApkDownloadResult.Failure -> mutableState.value = UpdateState.Failed(result.reason)
                is ApkDownloadResult.Success -> acceptDownloaded(release, result.file, installAfterDownload)
            }
        }
    }

    private suspend fun acceptDownloaded(release: ReleaseCandidate, file: File, installAfterDownload: Boolean) {
        val verification = withContext(Dispatchers.IO) {
            AndroidApkVerifier.verify(
                appContext,
                product,
                file,
                release.versionName,
                release.sizeBytes,
                release.sha256,
            )
        }
        if (verification is DownloadedApkVerification.Invalid) {
            withContext(Dispatchers.IO) { file.delete() }
            mutableState.value = UpdateState.Failed(verification.reason)
            return
        }
        withContext(Dispatchers.IO) {
            prefs.ready = ReadyUpdateMetadata(
                release.versionName,
                release.versionCode,
                release.assetName,
                file.absolutePath,
                release.sizeBytes,
                release.sha256,
                release.validUntilEpochMs,
                release.changelog,
                release.publishedAtEpochMillis,
            )
        }
        // A download started for an install never surfaces READY in between:
        // one frame of a tappable "READY · TAP" invites a second tap into a
        // flow that is already running.
        if (installAfterDownload) {
            install(
                UpdateState.Installing(
                    release.versionName,
                    file.absolutePath,
                    release.sizeBytes,
                    changelog = release.changelog,
                    publishedAtEpochMillis = release.publishedAtEpochMillis,
                ),
            )
            return
        }
        mutableState.value = UpdateState.ReadyToInstall(
            release.versionName,
            file.absolutePath,
            release.sizeBytes,
            release.changelog,
            release.publishedAtEpochMillis,
        )
    }

    private fun install(claim: UpdateState.Installing) {
        // Claim INSTALLING synchronously, the same way checkNow claims
        // CHECKING: the verification below hashes the whole apk, and until it
        // returns the tap has no visible effect at all.
        mutableState.value = claim
        scope.launch {
            val ready = withContext(Dispatchers.IO) { verifiedReadyMetadata() }
            if (ready == null) {
                mutableState.value = UpdateState.Failed("downloaded update failed verification")
                return@launch
            }
            // Re-published from the verified metadata, not the claim: prefs is
            // what actually gets handed to the installer.
            mutableState.value = UpdateState.Installing(
                ready.versionName,
                ready.apkPath,
                ready.sizeBytes,
                changelog = ready.changelog,
                publishedAtEpochMillis = ready.publishedAtEpochMillis,
            )
            val storageFailure = withContext(Dispatchers.IO) {
                installStorageFailureLabel(ready.sizeBytes, ReleaseInstaller.availableInstallBytes(appContext))
            }
            if (storageFailure != null) {
                mutableState.value = UpdateState.InstallFailed(
                    ready.versionName, ready.apkPath, storageFailure, ready.sizeBytes,
                    ready.changelog,
                    ready.publishedAtEpochMillis,
                )
                return@launch
            }
            val result = withContext(Dispatchers.IO) { ReleaseInstaller.install(appContext, File(ready.apkPath)) }
            if (!result.started) {
                mutableState.value = UpdateState.InstallFailed(
                    ready.versionName,
                    ready.apkPath,
                    result.reason ?: "install handoff failed",
                    ready.sizeBytes,
                    ready.changelog,
                    ready.publishedAtEpochMillis,
                )
            }
        }
    }

    private fun restoreReadyState(): UpdateState.ReadyToInstall? {
        val ready = verifiedReadyMetadata() ?: return null
        return UpdateState.ReadyToInstall(
            ready.versionName,
            ready.apkPath,
            ready.sizeBytes,
            ready.changelog,
            ready.publishedAtEpochMillis,
        )
    }

    private fun verifiedReadyMetadata(): ReadyUpdateMetadata? {
        val ready = prefs.ready ?: return null
        val readyCandidate = ReleaseCandidate(
            versionName = ready.versionName,
            versionCode = ready.versionCode,
            assetName = ready.assetName,
            downloadUrl = "",
            sizeBytes = ready.sizeBytes,
            sha256 = ready.sha256,
            validUntilEpochMs = ready.validUntilEpochMs,
            publishedAtEpochMillis = ready.publishedAtEpochMillis,
        )
        if (readyCandidate.isExpiredAt(nowEpochMs()) ||
            !product.isNewer(readyCandidate, currentVersionName, currentVersionCode)
        ) {
            discardReady(ready)
            return null
        }
        val readyFile = managedReadyFile(ready.apkPath) ?: run {
            prefs.clearReady()
            return null
        }
        val verification = AndroidApkVerifier.verify(
            appContext,
            product,
            readyFile,
            ready.versionName,
            ready.sizeBytes,
            ready.sha256,
        )
        if (verification != DownloadedApkVerification.Valid) {
            discardReady(ready)
            return null
        }
        return ready
    }

    private fun discardReady(ready: ReadyUpdateMetadata) {
        managedReadyFile(ready.apkPath)?.delete()
        prefs.clearReady()
    }

    private fun managedReadyFile(path: String): File? {
        val file = File(path)
        val roots = listOfNotNull(appContext.cacheDir, appContext.externalCacheDir)
        return file.takeIf { candidate -> roots.any { root -> isFileInsideDirectory(candidate, root) } }
    }

    private fun observeInstallEvents() {
        scope.launch {
            ReleaseInstallEvents.events.collect { event ->
                val installing = mutableState.value as? UpdateState.Installing ?: return@collect
                when (event) {
                    ReleaseInstallEvent.AwaitingUserConfirmation -> {
                        mutableState.value = installing.copy(awaitingUserConfirmation = true)
                    }
                    ReleaseInstallEvent.Success -> {
                        withContext(Dispatchers.IO) { prefs.clearReady() }
                        mutableState.value = UpdateState.UpToDate(
                            installing.versionName,
                            installing.publishedAtEpochMillis,
                        )
                    }
                    is ReleaseInstallEvent.Failed -> {
                        mutableState.value = UpdateState.InstallFailed(
                            installing.versionName,
                            installing.apkPath,
                            event.reason,
                            installing.sizeBytes,
                            installing.changelog,
                            installing.publishedAtEpochMillis,
                        )
                    }
                }
            }
        }
    }
}

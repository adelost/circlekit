package io.v1d.circlekit.showcase.catalog

import com.adelost.releasekit.UpdateState
import com.adelost.designkit.ui.CircleColorTheme
import com.adelost.ringkit.data.FetchError
import com.adelost.ringkit.data.Progress
import com.adelost.ringkit.data.SourceState
import com.adelost.servicekit.ServiceAttemptSummary
import com.adelost.servicekit.ServiceCacheSummary
import com.adelost.servicekit.ServiceId
import com.adelost.servicekit.ServiceOutcome
import com.adelost.servicekit.ServiceSnapshot
import com.adelost.servicekit.ServiceTransferSummary
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Deterministic, side-effect-free fixtures for data/update/service flows. */
class ShowcaseFlowState {
    private val mutableSource = MutableStateFlow<SourceState<String>>(SourceState())
    private val mutableSourceEnabled = MutableStateFlow(true)
    private val mutableUpdate = MutableStateFlow<UpdateState>(UpdateState.Idle)
    private val mutableService = MutableStateFlow(ServiceSnapshot(SERVICE_ID))
    private val mutableTheme = MutableStateFlow(CircleColorTheme.SEA_GLASS)

    val source: StateFlow<SourceState<String>> = mutableSource.asStateFlow()
    val sourceEnabled: StateFlow<Boolean> = mutableSourceEnabled.asStateFlow()
    val update: StateFlow<UpdateState> = mutableUpdate.asStateFlow()
    val service: StateFlow<ServiceSnapshot> = mutableService.asStateFlow()
    val theme: StateFlow<CircleColorTheme> = mutableTheme.asStateFlow()

    fun prepare(caseId: ShowcaseCaseId, scenarioId: ShowcaseScenarioId) {
        when (caseId.value) {
            "flow.source" -> prepareSource(scenarioId.value)
            "flow.update" -> mutableUpdate.value = updateFixture(scenarioId.value)
            "flow.service" -> mutableService.value = serviceFixture(scenarioId.value)
        }
    }

    fun reset() {
        mutableSource.value = SourceState()
        mutableSourceEnabled.value = true
        mutableUpdate.value = UpdateState.Idle
        mutableService.value = ServiceSnapshot(SERVICE_ID)
        mutableTheme.value = CircleColorTheme.SEA_GLASS
    }

    fun refreshSource() {
        mutableSourceEnabled.value = true
        mutableSource.value = SourceState(
            value = "18°",
            fetchedAtMono = NOW_MONO_MS,
            fetchedAtWall = NOW_WALL_MS,
        )
    }

    fun advanceUpdate() {
        mutableUpdate.value = when (val current = mutableUpdate.value) {
            UpdateState.Idle,
            UpdateState.UpToDate,
            is UpdateState.Unavailable,
            is UpdateState.Failed,
            is UpdateState.InstallFailed,
            -> UpdateState.Checking
            UpdateState.Checking -> availableUpdateFixture()
            is UpdateState.Available -> UpdateState.Downloading(
                current.versionName,
                0.5f,
                current.sizeBytes,
                current.changelog,
                current.publishedAtEpochMillis,
            )
            is UpdateState.Downloading -> UpdateState.ReadyToInstall(
                current.versionName,
                FIXTURE_APK,
                current.sizeBytes,
                current.changelog,
                current.publishedAtEpochMillis,
            )
            is UpdateState.ReadyToInstall -> UpdateState.Installing(
                current.versionName,
                current.apkPath,
                current.sizeBytes,
                changelog = current.changelog,
                publishedAtEpochMillis = current.publishedAtEpochMillis,
            )
            is UpdateState.Installing -> UpdateState.UpToDate
        }
    }

    fun advanceService() {
        mutableService.value = when {
            mutableService.value.activeOperations > 0 -> serviceFixture("success")
            mutableService.value.lastAttempt?.outcome == ServiceOutcome.SUCCESS -> serviceFixture("cache")
            else -> serviceFixture("active")
        }
    }

    fun selectTheme(theme: CircleColorTheme) {
        mutableTheme.value = theme
    }

    private fun prepareSource(scenario: String) {
        mutableSourceEnabled.value = scenario != "off"
        mutableSource.value = when (scenario) {
            "off" -> SourceState()
            "loading" -> SourceState(inFlight = true, progress = Progress(2, 5))
            "fresh" -> SourceState(value = "18°", fetchedAtMono = NOW_MONO_MS, fetchedAtWall = NOW_WALL_MS)
            "aging" -> SourceState(value = "17°", fetchedAtMono = 1_000L, fetchedAtWall = NOW_WALL_MS - 3_600_000L)
            "partial" -> SourceState(
                value = "16°",
                fetchedAtMono = NOW_MONO_MS,
                fetchedAtWall = NOW_WALL_MS,
                progress = Progress(3, 5),
                coverage = 0.6f,
            )
            "broken" -> SourceState(lastError = FetchError.Timeout)
            else -> error("Unknown source fixture $scenario")
        }
    }

    private fun updateFixture(scenario: String): UpdateState = when (scenario) {
        "checking" -> UpdateState.Checking
        "available" -> availableUpdateFixture()
        "downloading" -> UpdateState.Downloading(
            "0.4.0",
            0.56f,
            4_200_000L,
            "Shared showcase fixture",
            FIXTURE_PUBLISHED_AT_MS,
        )
        "ready" -> UpdateState.ReadyToInstall(
            "0.4.0",
            FIXTURE_APK,
            4_200_000L,
            "Shared showcase fixture",
            FIXTURE_PUBLISHED_AT_MS,
        )
        "failed" -> UpdateState.Failed("NETWORK UNAVAILABLE")
        else -> error("Unknown update fixture $scenario")
    }

    private fun availableUpdateFixture() = UpdateState.Available(
        "0.4.0",
        4_200_000L,
        "Shared showcase fixture",
        FIXTURE_PUBLISHED_AT_MS,
    )

    private fun serviceFixture(scenario: String): ServiceSnapshot = when (scenario) {
        "idle" -> ServiceSnapshot(SERVICE_ID)
        "active" -> ServiceSnapshot(SERVICE_ID, activeOperations = 1, activeTransfers = 1)
        "success" -> ServiceSnapshot(
            serviceId = SERVICE_ID,
            lastAttempt = ServiceAttemptSummary(NOW_WALL_MS, 420L, ServiceOutcome.SUCCESS),
            lastSuccessAtMs = NOW_WALL_MS,
            lastTransfer = ServiceTransferSummary(
                atMs = NOW_WALL_MS,
                durationMs = 420L,
                downloadedBytes = 1_048_576L,
                uploadedBytes = 0L,
                httpCode = 200,
                outcome = ServiceOutcome.SUCCESS,
            ),
            attemptCount = 4,
            networkCallCount = 4,
            totalDownloadedBytes = 4_194_304L,
        )
        "failed" -> ServiceSnapshot(
            serviceId = SERVICE_ID,
            lastAttempt = ServiceAttemptSummary(
                NOW_WALL_MS,
                2_000L,
                ServiceOutcome.FAILED,
                "TIMEOUT",
            ),
            attemptCount = 4,
            networkCallCount = 4,
        )
        "cache" -> ServiceSnapshot(
            serviceId = SERVICE_ID,
            lastSuccessAtMs = NOW_WALL_MS,
            cache = ServiceCacheSummary(NOW_WALL_MS, 24L * 1_024L * 1_024L, 128),
            attemptCount = 4,
            networkCallCount = 4,
            totalDownloadedBytes = 4_194_304L,
        )
        else -> error("Unknown service fixture $scenario")
    }

    companion object {
        const val NOW_MONO_MS = 10_000L
        const val NOW_WALL_MS = 1_800_000_000_000L
        const val FIXTURE_PUBLISHED_AT_MS = 1_785_648_800_000L
        private const val FIXTURE_APK = "/showcase/fixture.apk"
        private val SERVICE_ID = ServiceId("showcase-data")
    }
}

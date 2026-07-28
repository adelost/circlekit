package com.adelost.servicekit

/** Stable, non-secret identity shared by fetch policy, transport and UI. */
@JvmInline
value class ServiceId(val value: String) {
    init {
        require(value.matches(Regex("[a-z0-9][a-z0-9.-]{0,63}"))) {
            "invalid service id: $value"
        }
    }
}

enum class ServiceEventKind { OPERATION, TRANSFER, PROBE }

enum class ServiceOutcome { SUCCESS, FAILED, CANCELLED }

data class ServiceEvent(
    val serviceId: ServiceId,
    val kind: ServiceEventKind,
    val outcome: ServiceOutcome,
    val startedAtMs: Long,
    val completedAtMs: Long,
    val durationMs: Long,
    val downloadedBytes: Long = 0L,
    val uploadedBytes: Long = 0L,
    val httpCode: Int? = null,
    /** Sanitised diagnostic word only; never URLs, coordinates, payloads or tokens. */
    val detail: String? = null,
)

data class ServiceAttemptSummary(
    val atMs: Long,
    val durationMs: Long,
    val outcome: ServiceOutcome,
    val detail: String? = null,
)

data class ServiceTransferSummary(
    val atMs: Long,
    val durationMs: Long,
    val downloadedBytes: Long,
    val uploadedBytes: Long,
    val httpCode: Int?,
    val outcome: ServiceOutcome,
    val detail: String? = null,
)

data class ServiceCacheSummary(
    val measuredAtMs: Long,
    val bytes: Long,
    val itemCount: Int? = null,
)

/** Durable latest-known facts. Recent event history remains process-local. */
data class ServiceSnapshot(
    val serviceId: ServiceId,
    val lastAttempt: ServiceAttemptSummary? = null,
    val lastSuccessAtMs: Long? = null,
    val lastTransfer: ServiceTransferSummary? = null,
    val cache: ServiceCacheSummary? = null,
    val attemptCount: Long = 0L,
    val networkCallCount: Long = 0L,
    val totalDownloadedBytes: Long = 0L,
    val totalUploadedBytes: Long = 0L,
    val activeOperations: Int = 0,
    val activeTransfers: Int = 0,
)

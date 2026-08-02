package com.adelost.releasekit

/** Maps one fetched release to the canonical state consumed by every host. */
internal fun fetchedReleaseState(
    fetched: ReleaseCandidate?,
    product: ReleaseProductContract,
    currentVersionName: String,
    currentVersionCode: Int,
    nowEpochMs: Long,
): UpdateState = when {
    fetched == null -> UpdateState.Unavailable("No compatible ${product.id} release")
    fetched.isExpiredAt(nowEpochMs) -> UpdateState.Unavailable("Release metadata expired")
    !product.isNewer(fetched, currentVersionName, currentVersionCode) -> UpdateState.UpToDate(
        fetched.versionName,
        fetched.publishedAtEpochMillis,
    )
    else -> UpdateState.Available(
        fetched.versionName,
        fetched.sizeBytes,
        fetched.changelog,
        fetched.publishedAtEpochMillis,
    )
}

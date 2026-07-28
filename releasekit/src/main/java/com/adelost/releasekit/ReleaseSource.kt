package com.adelost.releasekit

fun interface ReleaseSource {
    fun fetchNewest(product: ReleaseProductContract): ReleaseFetchResult
}

object PublicReleaseSource : ReleaseSource {
    override fun fetchNewest(product: ReleaseProductContract): ReleaseFetchResult =
        PublicReleaseClient.fetchNewest(product)
}

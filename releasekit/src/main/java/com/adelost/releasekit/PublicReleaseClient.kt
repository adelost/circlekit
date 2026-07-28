package com.adelost.releasekit

import com.adelost.servicekit.ServiceTelemetry
import java.net.HttpURLConnection
import java.net.URL

sealed interface ReleaseFetchResult {
    data class Success(val candidate: ReleaseCandidate?) : ReleaseFetchResult
    data class Failure(val reason: String) : ReleaseFetchResult
}

/** Token-free network adapter for the sanitized Skyvw release feed. */
object PublicReleaseClient {
    fun fetchNewest(product: ReleaseProductContract): ReleaseFetchResult {
        val feedUrl = product.releaseFeedUrl
            ?: return ReleaseFetchResult.Failure("release feed is not configured")
        val connection = (URL(feedUrl).openConnection() as HttpURLConnection).apply {
            connectTimeout = 10_000
            readTimeout = 15_000
            setRequestProperty("Accept", "application/json")
            setRequestProperty("User-Agent", product.userAgent)
        }
        val transfer = ServiceTelemetry.shared.beginTransfer(product.telemetryServiceId)
        return try {
            val code = connection.responseCode
            transfer.http(code)
            if (code != HttpURLConnection.HTTP_OK) {
                val bytes = connection.errorStream?.use { it.readBytes() } ?: byteArrayOf()
                transfer.downloaded(bytes.size.toLong())
                transfer.failed("HTTP_$code")
                ReleaseFetchResult.Failure("release metadata HTTP $code")
            } else {
                val bytes = connection.inputStream.use { it.readBytes() }
                transfer.downloaded(bytes.size.toLong())
                val body = bytes.toString(Charsets.UTF_8)
                ReleaseFetchResult.Success(
                    selectNewestCompatibleRelease(parseGitHubReleases(body), product),
                ).also { transfer.success("RELEASE_FEED") }
            }
        } catch (error: Exception) {
            transfer.failed(error.javaClass.simpleName)
            ReleaseFetchResult.Failure(error.message ?: "release metadata unavailable")
        } finally {
            connection.disconnect()
        }
    }
}

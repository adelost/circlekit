package com.adelost.releasekit

import android.content.Context
import com.adelost.servicekit.ServiceTelemetry
import com.adelost.servicekit.ServiceTransfer
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

sealed interface ApkDownloadResult {
    data class Success(val file: File) : ApkDownloadResult
    data class Failure(val reason: String) : ApkDownloadResult
}

internal fun downloadedPayloadFailure(
    file: File,
    expectedSizeBytes: Long,
    expectedSha256: String,
): String? = when {
    !file.isFile -> "downloaded APK missing"
    file.length() != expectedSizeBytes -> "update size mismatch"
    runCatching { sha256(file) }.getOrNull() != expectedSha256 -> "update checksum mismatch"
    else -> null
}

/** HTTPS-only, digest-pinned downloader with explicit redirect and credential policy. */
object SecureApkDownloader {
    private const val MAX_REDIRECTS = 5

    fun download(
        context: Context,
        product: ReleaseProductContract,
        candidate: ReleaseCandidate,
        onProgress: (Float) -> Unit,
    ): ApkDownloadResult {
        if (!product.assetUrlPolicy.allows(candidate.downloadUrl)) {
            return ApkDownloadResult.Failure("unsafe update URL")
        }
        val cacheDir = context.externalCacheDir ?: context.cacheDir
        val output = File(cacheDir, product.cacheFileName)
        val temporary = File(cacheDir, "${output.name}.tmp")
        temporary.delete()

        var transfer: ServiceTransfer? = null
        return try {
            val connection = openDownloadConnection(candidate.downloadUrl, product)
                ?: return ApkDownloadResult.Failure("unsafe update redirect")
            val meter = ServiceTelemetry.shared.beginTransfer(product.telemetryServiceId)
            transfer = meter
            try {
                val code = connection.responseCode
                meter.http(code)
                if (code !in 200..299) {
                    meter.failed("HTTP_$code")
                    return ApkDownloadResult.Failure("update download HTTP $code")
                }
                val digest = MessageDigest.getInstance("SHA-256")
                var bytesRead = 0L
                connection.inputStream.use { input ->
                    FileOutputStream(temporary).use { fileOutput ->
                        val buffer = ByteArray(64 * 1024)
                        while (true) {
                            val count = input.read(buffer)
                            if (count < 0) break
                            if (bytesRead + count > candidate.sizeBytes) {
                                throw java.io.IOException("update size mismatch")
                            }
                            fileOutput.write(buffer, 0, count)
                            digest.update(buffer, 0, count)
                            bytesRead += count
                            meter.downloaded(count.toLong())
                            onProgress((bytesRead.toFloat() / candidate.sizeBytes).coerceIn(0f, 1f))
                        }
                        fileOutput.fd.sync()
                    }
                }
                val actualDigest = digest.digest().toHex()
                when {
                    bytesRead != candidate.sizeBytes -> ApkDownloadResult.Failure("update size mismatch")
                    actualDigest != candidate.sha256 -> ApkDownloadResult.Failure("update checksum mismatch")
                    !replaceAtomically(temporary, output) -> ApkDownloadResult.Failure("could not store update")
                    else -> {
                        onProgress(1f)
                        ServiceTelemetry.shared.recordCache(
                            product.telemetryServiceId,
                            output.length(),
                            1,
                        )
                        ApkDownloadResult.Success(output)
                    }
                }.also { result ->
                    if (result is ApkDownloadResult.Success) meter.success("APK")
                    else meter.failed("PAYLOAD_REJECTED")
                }
            } finally {
                connection.disconnect()
            }
        } catch (error: Exception) {
            transfer?.failed(error.javaClass.simpleName)
            ApkDownloadResult.Failure(error.message ?: "update download failed")
        }.also { result ->
            if (result is ApkDownloadResult.Failure) temporary.delete()
        }
    }

    private fun openDownloadConnection(
        initialUrl: String,
        product: ReleaseProductContract,
    ): HttpURLConnection? {
        var current = initialUrl
        repeat(MAX_REDIRECTS + 1) { redirectCount ->
            val connection = (URL(current).openConnection() as HttpURLConnection).apply {
                connectTimeout = 15_000
                readTimeout = 60_000
                instanceFollowRedirects = false
                setRequestProperty("Accept", "application/octet-stream")
                setRequestProperty("User-Agent", product.userAgent)
            }
            val code = connection.responseCode
            if (code !in 300..399) return connection
            val location = connection.getHeaderField("Location")
            connection.disconnect()
            if (redirectCount == MAX_REDIRECTS) return null
            current = ReleaseUrlPolicy.resolvedRedirectTarget(
                currentUrl = current,
                location = location,
                policy = product.assetUrlPolicy,
            ) ?: return null
        }
        return null
    }

    private fun replaceAtomically(temporary: File, output: File): Boolean {
        val previous = File(output.parentFile, "${output.name}.previous")
        previous.delete()
        if (output.exists() && !output.renameTo(previous)) return false
        if (!temporary.renameTo(output)) {
            previous.renameTo(output)
            return false
        }
        previous.delete()
        return true
    }
}

internal fun ByteArray.toHex(): String = joinToString(separator = "") { "%02x".format(it) }

internal fun sha256(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().use { input ->
        val buffer = ByteArray(64 * 1024)
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            digest.update(buffer, 0, count)
        }
    }
    return digest.digest().toHex()
}

package com.adelost.releasekit

import android.content.Context
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import java.io.File
import java.security.MessageDigest

sealed interface DownloadedApkVerification {
    data object Valid : DownloadedApkVerification
    data class Invalid(val reason: String) : DownloadedApkVerification
}

object AndroidApkVerifier {
    fun verify(
        context: Context,
        product: ReleaseProductContract,
        apkFile: File,
        expectedVersionName: String,
        expectedSizeBytes: Long,
        expectedSha256: String,
    ): DownloadedApkVerification {
        downloadedPayloadFailure(apkFile, expectedSizeBytes, expectedSha256)?.let {
            return DownloadedApkVerification.Invalid(it)
        }
        if (context.packageName != product.packageName) {
            return DownloadedApkVerification.Invalid("installed package contract mismatch")
        }
        val installed = installedIdentity(context) ?: return DownloadedApkVerification.Invalid("installed identity unavailable")
        val archive = archiveIdentity(context, apkFile) ?: return DownloadedApkVerification.Invalid("invalid APK")
        return when (val compatibility = verifyApkCompatibility(installed, archive, expectedVersionName)) {
            ApkCompatibility.Compatible -> DownloadedApkVerification.Valid
            is ApkCompatibility.Rejected -> DownloadedApkVerification.Invalid(compatibility.reason)
        }
    }

    // API 26 verification still needs the legacy PackageManager overload.
    @Suppress("DEPRECATION")
    private fun installedIdentity(context: Context): ApkIdentity? = runCatching {
        val info = context.packageManager.getPackageInfo(
            context.packageName,
            PackageManager.GET_SIGNING_CERTIFICATES,
        )
        info.toIdentity()
    }.getOrNull()

    // API 26 archive inspection has no non-deprecated equivalent.
    @Suppress("DEPRECATION")
    private fun archiveIdentity(context: Context, apkFile: File): ApkIdentity? = runCatching {
        context.packageManager.getPackageArchiveInfo(
            apkFile.absolutePath,
            PackageManager.GET_SIGNING_CERTIFICATES,
        )?.toIdentity()
    }.getOrNull()

    private fun PackageInfo.toIdentity(): ApkIdentity = ApkIdentity(
        packageName = packageName,
        versionName = versionName.orEmpty(),
        versionCode = longVersionCode,
        signerSha256 = signingInfo?.apkContentsSigners.orEmpty().mapTo(linkedSetOf()) { signature ->
            MessageDigest.getInstance("SHA-256").digest(signature.toByteArray()).toHex().uppercase()
        },
    )
}

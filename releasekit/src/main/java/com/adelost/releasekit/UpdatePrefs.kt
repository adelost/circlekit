package com.adelost.releasekit

import android.content.Context
import android.content.SharedPreferences
import java.io.File

internal data class ReadyUpdateMetadata(
    val versionName: String,
    val versionCode: Int?,
    val assetName: String,
    val apkPath: String,
    val sizeBytes: Long,
    val sha256: String,
    val validUntilEpochMs: Long?,
    val changelog: String = "",
    val publishedAtEpochMillis: Long? = null,
)

internal class UpdatePrefs(context: Context, productId: String) {
    private val prefs: SharedPreferences by lazy {
        context.getSharedPreferences("releasekit_update_v1_$productId", Context.MODE_PRIVATE)
    }

    var autoUpdateEnabled: Boolean
        get() = prefs.getBoolean(KEY_AUTO_UPDATE, true)
        set(value) { prefs.edit().putBoolean(KEY_AUTO_UPDATE, value).apply() }

    var lastCheckMs: Long
        get() = prefs.getLong(KEY_LAST_CHECK, 0L)
        set(value) { prefs.edit().putLong(KEY_LAST_CHECK, value).apply() }

    var ready: ReadyUpdateMetadata?
        get() {
            val version = prefs.getString(KEY_READY_VERSION, null) ?: return null
            val asset = prefs.getString(KEY_READY_ASSET, null) ?: return null
            val path = prefs.getString(KEY_READY_PATH, null) ?: return null
            val size = prefs.getLong(KEY_READY_SIZE, 0L).takeIf { it > 0L } ?: return null
            val sha = normalizedSha256(prefs.getString(KEY_READY_SHA, null)) ?: return null
            val versionCode = prefs.getInt(KEY_READY_VERSION_CODE, -1).takeIf { it >= 0 }
            val validUntil = prefs.getLong(KEY_READY_VALID_UNTIL, -1L).takeIf { it > 0L }
            val changelog = prefs.getString(KEY_READY_CHANGELOG, "").orEmpty()
            val publishedAt = prefs.getLong(KEY_READY_PUBLISHED_AT, 0L)
                .takeIf { prefs.contains(KEY_READY_PUBLISHED_AT) }
            return ReadyUpdateMetadata(
                version, versionCode, asset, path, size, sha, validUntil, changelog, publishedAt,
            )
        }
        set(value) {
            if (value == null) {
                clearReady()
            } else {
                prefs.edit()
                    .putString(KEY_READY_VERSION, value.versionName)
                    .also { editor ->
                        value.versionCode?.let { editor.putInt(KEY_READY_VERSION_CODE, it) }
                            ?: editor.remove(KEY_READY_VERSION_CODE)
                        value.validUntilEpochMs?.let { editor.putLong(KEY_READY_VALID_UNTIL, it) }
                            ?: editor.remove(KEY_READY_VALID_UNTIL)
                        value.publishedAtEpochMillis?.let { editor.putLong(KEY_READY_PUBLISHED_AT, it) }
                            ?: editor.remove(KEY_READY_PUBLISHED_AT)
                    }
                    .putString(KEY_READY_ASSET, value.assetName)
                    .putString(KEY_READY_PATH, value.apkPath)
                    .putLong(KEY_READY_SIZE, value.sizeBytes)
                    .putString(KEY_READY_SHA, "sha256:${value.sha256}")
                    .putString(KEY_READY_CHANGELOG, value.changelog)
                    .apply()
            }
        }

    fun clearReady() {
        prefs.edit()
            .remove(KEY_READY_VERSION)
            .remove(KEY_READY_VERSION_CODE)
            .remove(KEY_READY_VALID_UNTIL)
            .remove(KEY_READY_PUBLISHED_AT)
            .remove(KEY_READY_ASSET)
            .remove(KEY_READY_PATH)
            .remove(KEY_READY_SIZE)
            .remove(KEY_READY_SHA)
            .remove(KEY_READY_CHANGELOG)
            .apply()
    }

    private companion object {
        const val KEY_AUTO_UPDATE = "auto_update_enabled"
        const val KEY_LAST_CHECK = "last_check_ms"
        const val KEY_READY_VERSION = "ready_version"
        const val KEY_READY_VERSION_CODE = "ready_version_code"
        const val KEY_READY_VALID_UNTIL = "ready_valid_until_ms"
        const val KEY_READY_PUBLISHED_AT = "ready_published_at_ms"
        const val KEY_READY_ASSET = "ready_asset"
        const val KEY_READY_PATH = "ready_path"
        const val KEY_READY_SIZE = "ready_size"
        const val KEY_READY_SHA = "ready_sha256"
        const val KEY_READY_CHANGELOG = "ready_changelog"
    }
}

internal fun isFileInsideDirectory(file: File, directory: File): Boolean = runCatching {
    val root = directory.canonicalFile.toPath()
    val candidate = file.canonicalFile.toPath()
    candidate != root && candidate.startsWith(root)
}.getOrDefault(false)

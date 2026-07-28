package com.adelost.servicekit

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

internal class PreferencesServiceSnapshotStore(context: Context) : ServiceSnapshotStore {
    private val preferences = context.getSharedPreferences(NAME, Context.MODE_PRIVATE)

    override fun load(): List<ServiceSnapshot> = runCatching {
        val raw = preferences.getString(KEY, null) ?: return emptyList()
        val array = JSONArray(raw)
        buildList(array.length()) {
            for (index in 0 until array.length()) {
                array.optJSONObject(index)?.decodeSnapshot()?.let(::add)
            }
        }
    }.getOrDefault(emptyList())

    override fun save(snapshots: List<ServiceSnapshot>) {
        val encoded = JSONArray().apply { snapshots.forEach { put(it.encode()) } }.toString()
        preferences.edit().putString(KEY, encoded).apply()
    }

    private fun ServiceSnapshot.encode() = JSONObject().apply {
        put("id", serviceId.value)
        put("attemptCount", attemptCount)
        put("networkCallCount", networkCallCount)
        put("downloadedTotal", totalDownloadedBytes)
        put("uploadedTotal", totalUploadedBytes)
        lastSuccessAtMs?.let { put("lastSuccessAt", it) }
        lastAttempt?.let { attempt ->
            put("attempt", JSONObject().apply {
                put("at", attempt.atMs)
                put("duration", attempt.durationMs)
                put("outcome", attempt.outcome.name)
                attempt.detail?.let { put("detail", it) }
            })
        }
        lastTransfer?.let { transfer ->
            put("transfer", JSONObject().apply {
                put("at", transfer.atMs)
                put("duration", transfer.durationMs)
                put("downloaded", transfer.downloadedBytes)
                put("uploaded", transfer.uploadedBytes)
                put("outcome", transfer.outcome.name)
                transfer.httpCode?.let { put("http", it) }
                transfer.detail?.let { put("detail", it) }
            })
        }
        cache?.let { cache ->
            put("cache", JSONObject().apply {
                put("at", cache.measuredAtMs)
                put("bytes", cache.bytes)
                cache.itemCount?.let { put("items", it) }
            })
        }
    }

    private fun JSONObject.decodeSnapshot(): ServiceSnapshot? = runCatching {
        ServiceSnapshot(
            serviceId = ServiceId(getString("id")),
            lastAttempt = optJSONObject("attempt")?.let { attempt ->
                ServiceAttemptSummary(
                    atMs = attempt.getLong("at"),
                    durationMs = attempt.getLong("duration"),
                    outcome = ServiceOutcome.valueOf(attempt.getString("outcome")),
                    detail = attempt.optString("detail").takeIf(String::isNotBlank),
                )
            },
            lastSuccessAtMs = optLong("lastSuccessAt").takeIf { has("lastSuccessAt") },
            lastTransfer = optJSONObject("transfer")?.let { transfer ->
                ServiceTransferSummary(
                    atMs = transfer.getLong("at"),
                    durationMs = transfer.getLong("duration"),
                    downloadedBytes = transfer.getLong("downloaded"),
                    uploadedBytes = transfer.getLong("uploaded"),
                    httpCode = transfer.optInt("http").takeIf { transfer.has("http") },
                    outcome = ServiceOutcome.valueOf(transfer.getString("outcome")),
                    detail = transfer.optString("detail").takeIf(String::isNotBlank),
                )
            },
            cache = optJSONObject("cache")?.let { cache ->
                ServiceCacheSummary(
                    measuredAtMs = cache.getLong("at"),
                    bytes = cache.getLong("bytes"),
                    itemCount = cache.optInt("items").takeIf { cache.has("items") },
                )
            },
            attemptCount = optLong("attemptCount"),
            networkCallCount = optLong("networkCallCount"),
            totalDownloadedBytes = optLong("downloadedTotal"),
            totalUploadedBytes = optLong("uploadedTotal"),
        )
    }.getOrNull()

    companion object {
        private const val NAME = "circlekit-service-diagnostics"
        private const val KEY = "snapshots-v1"
    }
}

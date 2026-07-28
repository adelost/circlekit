package com.adelost.releasekit

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import android.os.StatFs
import java.io.File
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow

sealed interface ReleaseInstallEvent {
    data object AwaitingUserConfirmation : ReleaseInstallEvent
    data object Success : ReleaseInstallEvent
    data class Failed(val reason: String) : ReleaseInstallEvent
}

object ReleaseInstallEvents {
    private val mutableEvents = MutableSharedFlow<ReleaseInstallEvent>(extraBufferCapacity = 8)
    val events = mutableEvents.asSharedFlow()
    fun emit(event: ReleaseInstallEvent) { mutableEvents.tryEmit(event) }
}

data class InstallHandoffResult(val started: Boolean, val reason: String? = null)

object ReleaseInstaller {
    fun install(context: Context, apkFile: File): InstallHandoffResult {
        if (!apkFile.isFile) return InstallHandoffResult(false, "Downloaded APK missing")
        return try {
            val installer = context.packageManager.packageInstaller
            val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
                setAppPackageName(context.packageName)
            }
            val sessionId = installer.createSession(params)
            installer.openSession(sessionId).use { session ->
                apkFile.inputStream().use { input ->
                    session.openWrite("update.apk", 0, apkFile.length()).use { output ->
                        input.copyTo(output)
                        session.fsync(output)
                    }
                }
                val intent = Intent(context, ReleaseInstallReceiver::class.java).apply {
                    action = "${context.packageName}.releasekit.ACTION_INSTALL_RESULT"
                }
                val pending = PendingIntent.getBroadcast(
                    context,
                    sessionId,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
                )
                session.commit(pending.intentSender)
            }
            InstallHandoffResult(true)
        } catch (error: Exception) {
            InstallHandoffResult(false, installHandoffFailureReason(error))
        }
    }

    fun availableInstallBytes(context: Context): Long? = runCatching {
        StatFs(context.cacheDir.absolutePath).availableBytes
    }.getOrNull()

    private fun installHandoffFailureReason(error: Exception): String = when {
        error.message?.contains("space", ignoreCase = true) == true ||
            error.message?.contains("ENOSPC", ignoreCase = true) == true -> "Not enough storage"
        else -> "install handoff failed"
    }
}

class ReleaseInstallReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, -1)
        when (status) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                val confirmation: Intent? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent.getParcelableExtra(Intent.EXTRA_INTENT)
                }
                if (confirmation == null) {
                    ReleaseInstallEvents.emit(ReleaseInstallEvent.Failed("Install confirmation unavailable"))
                } else {
                    confirmation.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(confirmation)
                    ReleaseInstallEvents.emit(ReleaseInstallEvent.AwaitingUserConfirmation)
                }
            }
            PackageInstaller.STATUS_SUCCESS -> ReleaseInstallEvents.emit(ReleaseInstallEvent.Success)
            else -> ReleaseInstallEvents.emit(
                ReleaseInstallEvent.Failed(installFailureReason(status, intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE))),
            )
        }
    }

    private fun installFailureReason(status: Int, message: String?): String = when (status) {
        PackageInstaller.STATUS_FAILURE_STORAGE -> "Not enough storage"
        PackageInstaller.STATUS_FAILURE_BLOCKED -> "Install blocked"
        PackageInstaller.STATUS_FAILURE_CONFLICT -> "Install conflict"
        PackageInstaller.STATUS_FAILURE_INCOMPATIBLE -> "Incompatible APK"
        PackageInstaller.STATUS_FAILURE_INVALID -> "Invalid APK"
        PackageInstaller.STATUS_FAILURE_ABORTED -> "Install cancelled"
        else -> message ?: "install status $status"
    }
}

package io.v1d.circlekit.showcase.wear

import android.app.Activity
import android.app.RemoteInput
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.compose.setContent
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.core.content.ContextCompat
import androidx.wear.input.RemoteInputIntentHelper
import com.adelost.designkit.ui.CircleHostSurface
import com.adelost.ringkit.ui.RingNavigator
import io.v1d.circlekit.showcase.catalog.CircleKitShowcase
import io.v1d.circlekit.showcase.catalog.SHOWCASE_PROBE_ACTION
import io.v1d.circlekit.showcase.catalog.SHOWCASE_PROBE_LOG_TAG
import io.v1d.circlekit.showcase.catalog.ShowcaseProbeCommand
import io.v1d.circlekit.showcase.catalog.ShowcaseArtifactProfile
import io.v1d.circlekit.showcase.catalog.ShowcaseDevPort
import io.v1d.circlekit.showcase.catalog.ShowcaseHostController
import io.v1d.circlekit.showcase.catalog.ShowcaseReleaseHost
import io.v1d.circlekit.showcase.catalog.ShowcaseSession
import io.v1d.circlekit.showcase.catalog.ShowcaseScreens
import io.v1d.circlekit.showcase.catalog.ShowcaseUpdateController
import com.adelost.ringkit.ui.RingTextEntryPort
import com.adelost.ringkit.ui.RingTextInputSpec
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.cancel

class WearShowcaseActivity : ComponentActivity() {
    private val session = ShowcaseSession(ShowcaseArtifactProfile.WEAR_FULL_UI)
    private val runtimeScope = MainScope()
    private val host by lazy { ShowcaseHostController(this, isWatchDevice = true) { } }
    private val update by lazy {
        ShowcaseUpdateController(
            context = this,
            scope = runtimeScope,
            host = ShowcaseReleaseHost.WEAR,
            currentVersionName = BuildConfig.VERSION_NAME,
            currentVersionCode = BuildConfig.VERSION_CODE,
        )
    }
    private var pendingTextEntry: PendingTextEntry? = null
    private val textEntryLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult(),
    ) { result ->
        val pending = pendingTextEntry.also { pendingTextEntry = null } ?: return@registerForActivityResult
        if (result.resultCode != Activity.RESULT_OK) return@registerForActivityResult
        val value = RemoteInput.getResultsFromIntent(result.data)
            ?.getCharSequence(TEXT_RESULT_KEY)
            ?.toString()
            ?: return@registerForActivityResult
        pending.onResult(value.take(pending.spec.maxLength))
    }
    private val textEntryPort = RingTextEntryPort { spec, onResult ->
        if (!spec.enabled) return@RingTextEntryPort
        pendingTextEntry = PendingTextEntry(spec, onResult)
        val remoteInput = RemoteInput.Builder(TEXT_RESULT_KEY)
            .setLabel(spec.label)
            .build()
        val intent = RemoteInputIntentHelper.createActionRemoteInputIntent()
        RemoteInputIntentHelper.putRemoteInputsExtra(intent, listOf(remoteInput))
        textEntryLauncher.launch(intent)
    }
    private var probeRegistered = false
    private val probeReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val command = ShowcaseProbeCommand(
                verb = intent?.getStringExtra("cmd").orEmpty(),
                caseId = intent?.getStringExtra("case"),
                scenarioId = intent?.getStringExtra("scenario"),
                actionId = intent?.getStringExtra("action"),
                value = intent?.getStringExtra("value"),
            )
            val handled = host.handleProbe(command)
            val result = if (handled == null) {
                session.handle(command)
            } else {
                session.handle(ShowcaseProbeCommand("dump")).copy(
                    ok = handled,
                    message = if (handled) "host updated" else "invalid host value",
                )
            }
            val json = result.toJson()
            Log.i(SHOWCASE_PROBE_LOG_TAG, json)
            if (isOrderedBroadcast) {
                resultCode = if (result.ok) Activity.RESULT_OK else Activity.RESULT_CANCELED
                resultData = json
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val preview by host.state.collectAsState()
            val devPort = remember { ShowcaseDevPort(host.port, update.port) }
            val rootNavigator = remember { RingNavigator(ShowcaseScreens.root(session, devPort)) }
            BackHandler {
                if (!session.back()) finish()
            }
            CircleHostSurface(
                isWatchDevice = true,
                state = preview,
                onStateChange = null,
            ) {
                CircleKitShowcase(
                    session = session,
                    onExit = ::finish,
                    devPort = devPort,
                    rootNavigator = rootNavigator,
                    textEntryPort = textEntryPort,
                )
            }
        }
    }

    override fun onStart() {
        super.onStart()
        if (BuildConfig.DEBUG && !probeRegistered) {
            ContextCompat.registerReceiver(
                this,
                probeReceiver,
                IntentFilter(SHOWCASE_PROBE_ACTION),
                ContextCompat.RECEIVER_EXPORTED,
            )
            probeRegistered = true
        }
    }

    override fun onStop() {
        if (probeRegistered) {
            unregisterReceiver(probeReceiver)
            probeRegistered = false
        }
        super.onStop()
    }

    override fun onDestroy() {
        runtimeScope.cancel()
        super.onDestroy()
    }

    private data class PendingTextEntry(
        val spec: RingTextInputSpec,
        val onResult: (String) -> Unit,
    )

    private companion object {
        const val TEXT_RESULT_KEY = "circlekit_showcase_text"
    }
}

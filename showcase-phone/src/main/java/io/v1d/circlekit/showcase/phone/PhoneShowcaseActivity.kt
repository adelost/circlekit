package io.v1d.circlekit.showcase.phone

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.core.content.ContextCompat
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import com.adelost.designkit.ui.CircleHostSurface
import com.adelost.designkit.ui.requestedOrientationFor
import com.adelost.ringkit.ui.RingNavigator
import io.v1d.circlekit.showcase.catalog.CircleKitShowcase
import io.v1d.circlekit.showcase.catalog.SHOWCASE_PROBE_ACTION
import io.v1d.circlekit.showcase.catalog.SHOWCASE_PROBE_LOG_TAG
import io.v1d.circlekit.showcase.catalog.ShowcaseProbeCommand
import io.v1d.circlekit.showcase.catalog.ShowcaseDevPort
import io.v1d.circlekit.showcase.catalog.ShowcaseHostController
import io.v1d.circlekit.showcase.catalog.ShowcaseReleaseHost
import io.v1d.circlekit.showcase.catalog.ShowcaseSession
import io.v1d.circlekit.showcase.catalog.ShowcaseScreens
import io.v1d.circlekit.showcase.catalog.ShowcaseUpdateController
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.cancel

class PhoneShowcaseActivity : ComponentActivity() {
    private val session = ShowcaseSession()
    private val runtimeScope = MainScope()
    private val host by lazy {
        ShowcaseHostController(this, isWatchDevice = false) { orientation ->
            requestedOrientation = requestedOrientationFor(orientation)
        }
    }
    private val update by lazy {
        ShowcaseUpdateController(
            context = this,
            scope = runtimeScope,
            host = ShowcaseReleaseHost.PHONE,
            currentVersionName = BuildConfig.VERSION_NAME,
            currentVersionCode = BuildConfig.VERSION_CODE,
        )
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
        host.restoreOrientation()
        setContent {
            val preview by host.state.collectAsState()
            val devPort = remember { ShowcaseDevPort(host.port, update.port) }
            val rootNavigator = remember { RingNavigator(ShowcaseScreens.root(session, devPort)) }
            BackHandler {
                if (!session.back()) finish()
            }
            CircleHostSurface(
                isWatchDevice = false,
                state = preview,
                onStateChange = { next ->
                    host.port.onMode(next.mode)
                    host.port.onDiameter(next.watchDiameterDp)
                },
            ) {
                CircleKitShowcase(
                    session = session,
                    onExit = ::finish,
                    devPort = devPort,
                    rootNavigator = rootNavigator,
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
}

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
import com.adelost.designkit.ui.CircleResponsiveSurface
import io.v1d.circlekit.showcase.catalog.CircleKitShowcase
import io.v1d.circlekit.showcase.catalog.SHOWCASE_PROBE_ACTION
import io.v1d.circlekit.showcase.catalog.SHOWCASE_PROBE_LOG_TAG
import io.v1d.circlekit.showcase.catalog.ShowcaseProbeCommand
import io.v1d.circlekit.showcase.catalog.ShowcaseSession

class PhoneShowcaseActivity : ComponentActivity() {
    private val session = ShowcaseSession()
    private var probeRegistered = false
    private val probeReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val result = session.handle(
                ShowcaseProbeCommand(
                    verb = intent?.getStringExtra("cmd").orEmpty(),
                    caseId = intent?.getStringExtra("case"),
                    scenarioId = intent?.getStringExtra("scenario"),
                    actionId = intent?.getStringExtra("action"),
                ),
            )
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
            BackHandler {
                if (!session.back()) finish()
            }
            CircleResponsiveSurface {
                CircleKitShowcase(
                    session = session,
                    onExit = ::finish,
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
}

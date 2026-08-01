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
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.core.content.ContextCompat
import androidx.wear.input.RemoteInputIntentHelper
import com.adelost.designkit.ui.CircleUiProfiles
import com.adelost.designkit.ui.LocalCircleSurfaceLayout
import com.adelost.designkit.ui.resolveCircleSurfaceLayout
import io.v1d.circlekit.showcase.catalog.CircleKitShowcase
import io.v1d.circlekit.showcase.catalog.SHOWCASE_PROBE_ACTION
import io.v1d.circlekit.showcase.catalog.SHOWCASE_PROBE_LOG_TAG
import io.v1d.circlekit.showcase.catalog.ShowcaseProbeCommand
import io.v1d.circlekit.showcase.catalog.ShowcaseSession
import com.adelost.ringkit.ui.RingTextEntryPort
import com.adelost.ringkit.ui.RingTextInputSpec

class WearShowcaseActivity : ComponentActivity() {
    private val session = ShowcaseSession()
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
            BoxWithConstraints(
                modifier = Modifier.fillMaxSize().background(Color.Black),
                contentAlignment = Alignment.Center,
            ) {
                val faceSide = minOf(maxWidth, maxHeight)
                val scale = faceSide.value / CircleUiProfiles.CANON_ROUND_CANVAS_DP
                val hostDensity = LocalDensity.current
                Box(Modifier.size(faceSide).clip(CircleShape)) {
                    CompositionLocalProvider(
                        LocalDensity provides Density(
                            density = hostDensity.density * scale,
                            fontScale = hostDensity.fontScale,
                        ),
                        LocalCircleSurfaceLayout provides resolveCircleSurfaceLayout(
                            shortSideDp = CircleUiProfiles.CANON_ROUND_CANVAS_DP,
                            round = true,
                        ),
                    ) {
                        CircleKitShowcase(
                            session = session,
                            onExit = ::finish,
                            textEntryPort = textEntryPort,
                        )
                    }
                }
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

    private data class PendingTextEntry(
        val spec: RingTextInputSpec,
        val onResult: (String) -> Unit,
    )

    private companion object {
        const val TEXT_RESULT_KEY = "circlekit_showcase_text"
    }
}

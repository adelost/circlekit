package com.adelost.studiodebug

import android.Manifest
import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ApplicationInfo
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.TextView

/** The only debug command door. The receiver never accepts a ticket or product data. */
class StudioDebugBridge(
    private val action: String,
    private val identity: StudioDebugIdentity,
    private val attachObservers: ((String) -> Unit, String) -> AutoCloseable,
) {
    private var receiver: BroadcastReceiver? = null
    @Volatile private var activity: Activity? = null
    private var indicator: TextView? = null
    @Volatile private var transport: StudioObservationTransport? = null
    @Volatile private var generation = 0L
    @Volatile private var label = "OFF"

    fun attach(activity: Activity) {
        require(activity.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) {
            "Studio bridge requires a debuggable app"
        }
        require(action == "${activity.packageName}.STUDIO_OBSERVE") {
            "Studio action must be owned by this application package"
        }
        if (receiver != null) return
        this.activity = activity
        receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                when (intent.getStringExtra("cmd")) {
                    "start" -> {
                        val port = intent.getIntExtra("port", -1)
                        if (port !in 1..65535 || transport != null) return
                        val turn = ++generation
                        val next = StudioObservationTransport(
                            activity.applicationContext, identity,
                            { value -> if (generation == turn) showStatus(value) }, attachObservers,
                        )
                        transport = next
                        showStatus("CONNECTING")
                        next.start(port)
                    }
                    "stop" -> transport?.stop()
                }
            }
        }
        // DUMP is held by adb shell/system, not by arbitrary apps that could choose their own receiver port.
        activity.registerReceiver(receiver, IntentFilter(action), Manifest.permission.DUMP, null,
            Context.RECEIVER_EXPORTED)
        draw(activity)
    }

    fun detach(activity: Activity) {
        receiver?.let { activity.unregisterReceiver(it) }
        receiver = null
        indicator?.let { (it.parent as? ViewGroup)?.removeView(it) }
        indicator = null
        this.activity = null
    }

    fun stop() {
        transport?.stop()
    }

    private fun showStatus(next: String) {
        label = next
        if (next !in setOf("CONNECTING", "STOPPING", "LIVE · STOP")) transport = null
        activity?.let { active -> active.runOnUiThread { draw(active) } }
    }

    private fun draw(activity: Activity) {
        if (label == "OFF") {
            indicator?.visibility = TextView.GONE
            return
        }
        val view = indicator ?: TextView(activity).also { created ->
            val density = activity.resources.displayMetrics.density
            created.textSize = 8f
            created.setTextColor(Color.WHITE)
            created.setPadding((6 * density).toInt(), (2 * density).toInt(),
                (6 * density).toInt(), (2 * density).toInt())
            created.background = GradientDrawable().apply {
                setColor(Color.rgb(82, 26, 30))
                cornerRadius = 8 * density
            }
            created.setOnClickListener { transport?.stop() }
            activity.addContentView(created, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.TOP or Gravity.CENTER_HORIZONTAL,
            ))
            indicator = created
        }
        view.text = if (label == "LIVE · STOP") "DEV LIVE · STOP" else "DEV $label"
        view.visibility = TextView.VISIBLE
    }
}

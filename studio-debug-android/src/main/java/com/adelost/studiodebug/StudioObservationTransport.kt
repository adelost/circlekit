package com.adelost.studiodebug

import android.content.Context
import android.content.pm.ApplicationInfo
import android.os.SystemClock
import android.system.Os
import android.util.Log
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/** The compiled artifact, not an app-specific transport, decides which observations exist. */
data class StudioDebugIdentity(
    val productId: String,
    val artifactSha256: String,
    val productSpecVersion: String,
    val buildId: String,
    val events: List<String>,
    val facets: List<String> = emptyList(),
    val appliedTransitions: Boolean = false,
) {
    init {
        require(productId.isNotBlank() && artifactSha256.matches(Regex("[0-9a-f]{64}")))
        require(productSpecVersion.isNotBlank() && buildId.isNotBlank())
        require(events.isNotEmpty() && events.size == events.distinct().size)
        require(events.all { it in setOf("decision", "transition", "port") })
    }
}

/** Outbound and read-only. Product calls only enqueue; the worker owns socket and disk I/O. */
internal class StudioObservationTransport(
    private val context: Context,
    private val identity: StudioDebugIdentity,
    private val status: (String) -> Unit,
    private val attachObservers: ((String) -> Unit, String) -> AutoCloseable,
) {
    private val worker = Executors.newSingleThreadExecutor { task ->
        Thread(task, "studio-observation").apply { isDaemon = true }
    }
    private val client = OkHttpClient.Builder().build()
    private val queue = StudioObservationQueue()
    private val pumpScheduled = AtomicBoolean(false)
    private val captureId = UUID.randomUUID().toString()
    private var observerHandle: AutoCloseable? = null
    private var socket: WebSocket? = null
    @Volatile private var accepted = false
    @Volatile private var stopping = false
    private var waitingThrough: Int? = null
    private var acknowledgedThrough = -1
    private var endSent = false

    fun start(port: Int) {
        require(context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0 && port in 1..65535) {
            "Studio observation requires a debuggable app and a valid local port"
        }
        worker.execute {
            try {
                val ticket = consumePrivateTicket(context.filesDir)
                status("CONNECTING")
                val request = Request.Builder()
                    .url("ws://127.0.0.1:$port/runtime/v1")
                    .header("Sec-WebSocket-Protocol", "v1d-runtime.v1")
                    .build()
                socket = client.newWebSocket(request, listener(ticket))
            } catch (failure: Exception) {
                fail(failure)
            }
        }
    }

    fun stop() {
        worker.execute {
            stopping = true
            detachObservers()
            status("STOPPING")
            if (accepted) schedulePump() else socket?.close(1000, "Stopped")
        }
    }

    private fun listener(ticket: String) = object : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            val hello = JSONObject().apply {
                put("type", "hello")
                put("protocol", 1)
                put("ticket", ticket)
                put("productId", identity.productId)
                put("identity", JSONObject().put("artifactSha256", identity.artifactSha256))
                put("productSpecVersion", identity.productSpecVersion)
                put("captureId", captureId)
                put("buildId", identity.buildId)
                put("scope", JSONObject().apply {
                    put("events", JSONArray(identity.events))
                    put("facets", JSONArray(identity.facets))
                    put("appliedTransitions", identity.appliedTransitions)
                })
            }
            webSocket.send(hello.toString())
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            worker.execute { try { receive(JSONObject(text)) } catch (failure: Exception) { fail(failure) } }
        }
        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
            worker.execute { disconnect() }
        }
        override fun onFailure(webSocket: WebSocket, failure: Throwable, response: Response?) {
            worker.execute { fail(failure) }
        }
    }

    private fun receive(message: JSONObject) {
        when (message.optString("type")) {
            "welcome" -> {
                if (accepted || message.optString("captureId") != captureId) return fail("Invalid welcome")
                accepted = true
                if (!stopping) {
                    observerHandle = attachObservers(::enqueue, captureId)
                    status("LIVE · STOP")
                }
                schedulePump()
            }
            "ack" -> {
                val through = message.optInt("through", -2)
                if (endSent && message.optBoolean("ended")) {
                    socket?.close(1000, "Capture complete")
                    disconnect()
                    return
                }
                if (through != waitingThrough) return fail("Invalid acknowledgement")
                acknowledgedThrough = through
                waitingThrough = null
                schedulePump()
            }
            "error" -> fail("Studio refused observation: ${message.optString("code")}")
            else -> fail("Unknown Studio response")
        }
    }

    private fun enqueue(raw: String) {
        if (stopping || !accepted) return
        queue.offer(raw, SystemClock.elapsedRealtime())
        schedulePump()
    }

    private fun schedulePump() {
        if (pumpScheduled.compareAndSet(false, true)) worker.execute {
            pumpScheduled.set(false)
            pump()
        }
    }

    private fun pump() {
        val active = socket ?: return
        if (!accepted || waitingThrough != null || endSent) return
        val entries = queue.take()
        if (entries.isEmpty()) {
            if (stopping) {
                endSent = true
                if (!active.send(JSONObject().put("type", "end").put("through", acknowledgedThrough).toString())) {
                    fail("Studio socket closed before end")
                }
            }
            return
        }
        val events = JSONArray()
        val losses = JSONArray()
        for (entry in entries) when (entry) {
            is StudioObservationQueue.Event -> {
                val parsed = try { JSONObject(entry.raw) } catch (_: Exception) { null }
                if (parsed == null || !safeGeneratedFields(parsed, identity.events.toSet())) {
                    losses.put(JSONObject().put("from", entry.from).put("to", entry.to).put("reason", "invalid-generated-event"))
                } else {
                    parsed.put("sequence", entry.from).put("atMs", entry.atMs)
                    events.put(parsed)
                }
            }
            is StudioObservationQueue.Loss -> losses.put(JSONObject()
                .put("from", entry.from).put("to", entry.to).put("reason", entry.reason))
        }
        val through = entries.last().to
        val batch = JSONObject().put("type", "batch").put("through", through)
            .put("events", events).put("dropped", losses)
        waitingThrough = through
        if (!active.send(batch.toString())) fail("Studio socket closed before batch")
    }

    private fun detachObservers() {
        observerHandle?.close()
        observerHandle = null
    }

    private fun disconnect() {
        detachObservers()
        accepted = false
        status(if (stopping) "OFF" else "DISCONNECTED")
    }

    private fun fail(failure: Throwable) = fail(failure.javaClass.simpleName)
    private fun fail(reason: String) {
        Log.w("StudioObservation", "Observation stopped: ${reason.take(80)}")
        detachObservers()
        accepted = false
        status(reason.take(80))
        socket?.close(1008, "Observation stopped")
    }

    companion object {
        /** run-as writes exactly this 0600 file. It is consumed once even on refusal. */
        private fun consumePrivateTicket(filesDir: File): String {
            val file = File(filesDir, "studio-observation/ticket")
            try {
                require(file.isFile && (Os.stat(file.absolutePath).st_mode and 0x1FF) == 384) {
                    "Pairing file must be private"
                }
                val ticket = file.readText().trim()
                require(ticket.matches(Regex("[A-Za-z0-9_-]{32,128}"))) { "Invalid pairing file" }
                return ticket
            } finally {
                if (file.exists() && !file.delete()) throw IllegalStateException("Cannot remove private pairing file")
            }
        }
    }
}

internal fun safeGeneratedFields(raw: JSONObject, allowedKinds: Set<String>): Boolean {
    val kind = raw.optString("kind")
    if (kind !in allowedKinds) return false
    val phase = raw.optString("phase")
    val allowed = when (kind) {
        "decision" -> if (phase == "evaluated") setOf("kind", "phase", "facetId", "cellId", "facts", "values") else return false
        "transition" -> if (phase in setOf("evaluated", "applied"))
            setOf("kind", "phase", "facetId", "cellId", "from", "to", "input", "guards", "instanceId") else return false
        "port" -> if (phase == "returned") setOf("kind", "phase", "portRef") else return false
        else -> return false
    }
    return raw.keys().asSequence().all { it in allowed }
}

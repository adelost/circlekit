package com.adelost.designkit.press

import com.adelost.designkit.ui.CIRCLE_CUE_BRUSH_MIN_MS

/** Same gate laws as the wash, in swept degrees, plus an explicit whole-ring requirement at commit. */
internal fun assertCircleRingGate(what: String, gateMs: Long, frames: List<CirclePressReading>) {
    val angles = frames.map { requireNotNull(it.sweptAngle) }
    val readings = frames.zip(angles).joinToString { "${it.first.elapsedMs}:${it.second}deg" }
    println("RING $what $readings")
    frames.zip(angles).forEach { (frame, angle) ->
        check(frame.elapsedMs >= CIRCLE_CUE_BRUSH_MIN_MS || angle == 0f) {
            "$what drew $angle degrees under the brush minimum: $readings"
        }
    }
    val visibleBy = maxOf(CIRCLE_CUE_BRUSH_MIN_MS, gateMs / 5)
    val first = frames.indexOfFirst { it.elapsedMs >= visibleBy }
    check(first >= 0 && angles[first] > 0f) { "$what was still silent at pointer-zero response: $readings" }
    for (i in 1 until angles.size) {
        check(angles[i] >= angles[i - 1]) { "$what swept angle retreated: $readings" }
    }
    check(angles.last() >= angles[first] * 2f) { "$what did not grow across its gate: $readings" }
    check(angles.last() == 360f) { "$what did not reach the whole ring at commit: $readings" }
}

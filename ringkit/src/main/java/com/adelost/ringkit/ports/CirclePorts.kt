package com.adelost.ringkit.ports

/** How a declared port is fed right now, as each product's port runtime reports it. */
enum class CirclePortQuality { LIVE, STALE, UNAVAILABLE, UNBOUND }

/** What a port is for: state someone reads, a command someone sends, or demand that keeps a source running. */
enum class CirclePortRole { DATA, COMMAND, DEMAND }

/**
 * The one status a person reads. A command that was never sent is IDLE, not a fault;
 * old data is STALE and muted; only a port with no binding is BROKEN.
 */
enum class CirclePortStatus { BROKEN, STALE, LIVE, IDLE }

/**
 * WHAT: A product-neutral snapshot of one declared product port.
 * WHY: Every CircleKit product shows its ports in the same opinionated view; a product only maps its
 * generated catalog into this record, it never draws its own inspector.
 */
data class CirclePortInspection(
    val id: String,
    /** The declared owner node or component, e.g. `conversation.service`. */
    val ownerId: String,
    val role: CirclePortRole,
    val contractRef: String,
    val direction: String,
    val boundary: String,
    val required: Boolean,
    val quality: CirclePortQuality,
    val value: String?,
    val ageMs: Long?,
    val demandOwners: Set<String> = emptySet(),
    val bindings: Set<String> = emptySet(),
)

fun CirclePortInspection.status(): CirclePortStatus = when (quality) {
    CirclePortQuality.UNBOUND -> CirclePortStatus.BROKEN
    CirclePortQuality.STALE -> CirclePortStatus.STALE
    CirclePortQuality.LIVE -> CirclePortStatus.LIVE
    CirclePortQuality.UNAVAILABLE -> CirclePortStatus.IDLE
}

/** A port a person should look at: a broken binding, or data a required consumer is waiting on. */
fun CirclePortInspection.needsAttention(): Boolean =
    status() == CirclePortStatus.BROKEN || (required && status() == CirclePortStatus.STALE && role == CirclePortRole.DATA)

/** The group is the declaration's first id segment: `conversation.service.status` belongs to Conversation. */
fun CirclePortInspection.groupKey(): String = ownerId.substringBefore('.')

/** The port's own short name inside its group: `conversation.service.status` is Status. */
fun CirclePortInspection.shortName(): String = circlePortWords(id.substringAfterLast('.'))

/** Declaration ids in plain words: `wake-phase` and `wakePhase` both read "Wake phase". */
fun circlePortWords(id: String): String = id
    .replace(Regex("([a-z])([A-Z])"), "$1 $2")
    .replace(Regex("[-_.]+"), " ")
    .trim()
    .lowercase()
    .replaceFirstChar { it.uppercase() }

data class CirclePortGroup(val key: String, val title: String, val ports: List<CirclePortInspection>) {
    val worst: CirclePortStatus = ports.minOfOrNull { it.status() } ?: CirclePortStatus.IDLE
}

/** Broken groups first, then alphabetical, so a fault is never below the fold. */
fun circlePortGroups(ports: List<CirclePortInspection>): List<CirclePortGroup> = ports
    .groupBy(CirclePortInspection::groupKey)
    .map { (key, members) -> CirclePortGroup(key, circlePortWords(key), members.sortedBy(CirclePortInspection::id)) }
    .sortedWith(compareBy<CirclePortGroup>({ it.worst != CirclePortStatus.BROKEN }, { it.title }))

/** `12 LIVE · 3 STALE · 5 IDLE · 1 BROKEN`, omitting statuses that have no ports. */
fun circlePortSummary(ports: List<CirclePortInspection>): String {
    val counts = ports.groupingBy { it.status() }.eachCount()
    return listOf(CirclePortStatus.LIVE, CirclePortStatus.STALE, CirclePortStatus.IDLE, CirclePortStatus.BROKEN)
        .mapNotNull { status -> counts[status]?.let { "$it ${status.name}" } }
        .joinToString(" · ")
        .ifEmpty { "NO PORTS" }
}

/** `3 live · 2 idle` for one group. */
fun circlePortGroupSummary(group: CirclePortGroup): String = circlePortSummary(group.ports).lowercase()

/** Age as a person reads it: NOW, 30 s, 3 min, 2 h. */
fun circlePortAge(ageMs: Long): String = when {
    ageMs < 1_000L -> "NOW"
    ageMs < 60_000L -> "${ageMs / 1_000L} s"
    ageMs < 3_600_000L -> "${ageMs / 60_000L} min"
    else -> "${ageMs / 3_600_000L} h"
}

/** One row's preview: the value's first field or the status, then the age. */
fun circlePortPreview(port: CirclePortInspection): String = buildList {
    add(
        when (port.status()) {
            CirclePortStatus.IDLE -> if (port.role == CirclePortRole.COMMAND) "not fired yet" else "no value yet"
            CirclePortStatus.BROKEN -> "unbound"
            else -> circlePortValueFields(port.value.orEmpty()).firstOrNull()?.second ?: port.status().name.lowercase()
        },
    )
    port.ageMs?.let { add(circlePortAge(it)) }
}.joinToString(" · ")

/**
 * Kotlin snapshots already carry field names. Split only top-level fields, preserving nested records,
 * so every product value reads field by field without CircleKit knowing the model.
 */
fun circlePortValueFields(value: String): List<Pair<String, String>> {
    if (value.isBlank()) return emptyList()
    val open = value.indexOf('(')
    if (open <= 0 || !value.endsWith(')')) return listOf("Value" to value)
    return topLevelParts(value.substring(open + 1, value.lastIndex)).mapIndexed { index, raw ->
        val separator = raw.indexOf('=')
        if (separator <= 0) "Item ${index + 1}" to raw.trim()
        else circlePortWords(raw.substring(0, separator).trim()) to raw.substring(separator + 1).trim()
    }
}

private fun topLevelParts(body: String): List<String> {
    val parts = mutableListOf<String>()
    var depth = 0
    var start = 0
    body.forEachIndexed { index, char ->
        when (char) {
            '(', '[', '{' -> depth += 1
            ')', ']', '}' -> depth -= 1
            ',' -> if (depth == 0) {
                parts += body.substring(start, index)
                start = index + 1
            }
        }
    }
    if (start < body.length) parts += body.substring(start)
    return parts.map(String::trim).filter(String::isNotEmpty)
}

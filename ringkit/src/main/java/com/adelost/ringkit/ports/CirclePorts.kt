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

/** The group a declaration names: its owner's first id segment, `conversation.service.status` is Conversation. */
fun CirclePortInspection.groupKey(): String = ownerId.substringBefore('.')

/** The port's own short name: `conversation.service.status` is Status. */
fun CirclePortInspection.shortName(): String = circlePortWords(id.substringAfterLast('.'))

/** One binding as every product writes it into [CirclePortInspection.bindings]: `KIND:from->to`. */
data class CirclePortBinding(val kind: String, val from: String, val to: String)

fun circlePortBinding(text: String): CirclePortBinding? {
    val kind = text.substringBefore(':', "")
    val route = text.substringAfter(':', "")
    val from = route.substringBefore("->", "")
    val to = route.substringAfter("->", "")
    return if (kind.isEmpty() || from.isEmpty() || to.isEmpty()) null else CirclePortBinding(kind, from, to)
}

/**
 * Group key by port id. A projection (an owner that feeds no other node and whose component bindings reach
 * exactly one other group) joins that group: `ui.projection.home-dial` feeding `instrument.altitude-dial` reads as
 * Instrument. Every other owner stays in the group its declaration names.
 */
fun circlePortGroupKeys(ports: List<CirclePortInspection>): Map<String, String> {
    val ownerOf = ports.associate { it.id to it.ownerId }
    val bindings = ports.flatMap { it.bindings }.toSet().mapNotNull(::circlePortBinding)
    val feedsNodes = bindings.filter { it.kind == "NODE_INPUT" }.mapNotNull { ownerOf[it.from] }.toSet()
    val componentGroups = buildMap<String, MutableSet<String>> {
        bindings.forEach { binding ->
            val (owner, other) = when (binding.kind) {
                "COMPONENT_INPUT" -> ownerOf[binding.from] to binding.to
                "COMPONENT_EVENT" -> ownerOf[binding.to] to binding.from
                else -> null to null
            }
            if (owner != null && other != null) getOrPut(owner) { mutableSetOf() } += other.substringBefore('.')
        }
    }
    return ports.associate { port ->
        val declared = port.groupKey()
        val others = componentGroups[port.ownerId].orEmpty() - declared
        port.id to if (port.ownerId !in feedsNodes && others.size == 1) others.single() else declared
    }
}

/**
 * Row names by port id. A name is the short name; when ports in one group share it, each gains the first owner
 * word no other of them has: `position.availability-state.presentation-adapter.presentation` is Availability state presentation.
 */
fun circlePortNames(ports: List<CirclePortInspection>): Map<String, String> {
    val groups = circlePortGroupKeys(ports)
    val names = ports.associate { it.id to it.shortName() }.toMutableMap()
    ports.groupBy { groups.getValue(it.id) to it.id.substringAfterLast('.') }.values.filter { it.size > 1 }.forEach { shared ->
        val segments = shared.associate { it.id to it.ownerId.split('.').drop(1) }
        val counts = segments.values.flatMap { it.distinct() }.groupingBy { it }.eachCount()
        shared.forEach { port ->
            val own = segments.getValue(port.id)
            val prefix = own.firstOrNull { counts[it] == 1 }?.let(::listOf) ?: own
            names[port.id] = circlePortWords((prefix + port.id.substringAfterLast('.')).joinToString("."))
        }
    }
    return names
}

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
fun circlePortGroups(ports: List<CirclePortInspection>): List<CirclePortGroup> {
    val keys = circlePortGroupKeys(ports)
    return ports
        .groupBy { keys.getValue(it.id) }
        .map { (key, members) -> CirclePortGroup(key, circlePortWords(key), members.sortedBy(CirclePortInspection::id)) }
        .sortedWith(compareBy<CirclePortGroup>({ it.worst != CirclePortStatus.BROKEN }, { it.title }))
}

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
            else -> circlePortPlainValue(port.value.orEmpty()) ?: port.status().name.lowercase()
        },
    )
    port.ageMs?.let { add(circlePortAge(it)) }
}.joinToString(" · ")

private val TIME_FIELD = Regex("(?i)(epoch|nanos|millis|timestamp)|(At|Ms)$")

private val FLAG_VALUE = setOf("true", "false", "null")

/**
 * The field a person can read at a glance: the first plain value that is not a timestamp (the age is shown)
 * or a flag, then the first nested record opened the same way, and only then a flag.
 */
private fun circlePortPlainValue(value: String): String? {
    val fields = circlePortValueFields(value)
    if (fields.size == 1 && fields.single().first == "Value") return fields.single().second.takeIf(String::isNotBlank)
    val named = topLevelNames(value)
    val plain = fields.map { it.second }.filterIndexed { index, field ->
        !isRecord(field) && named.getOrNull(index)?.let(TIME_FIELD::containsMatchIn) != true
    }
    return plain.firstOrNull { it !in FLAG_VALUE }
        ?: fields.firstOrNull { isRecord(it.second) }?.let { circlePortPlainValue(it.second) }
        ?: plain.firstOrNull()
}

private fun isRecord(value: String) = value.indexOf('(') > 0 && value.endsWith(')')

private fun topLevelNames(value: String): List<String> =
    topLevelParts(value.substring(value.indexOf('(') + 1, value.lastIndex)).map { it.substringBefore('=').trim() }

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

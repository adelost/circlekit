package com.adelost.ringkit.ports

import com.adelost.designkit.ui.CircleAccent
import com.adelost.designkit.ui.RingIcons
import com.adelost.ringkit.ui.RingScreen
import com.adelost.ringkit.ui.RowSpec
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * WHAT: The standard PORTS view every CircleKit product shows: a summary, what needs attention,
 * then one row per declared group; a group lists DATA, COMMANDS and DEMAND; a port lists its facts.
 * WHY: Mattias 2026-09-14 wanted one opinionated built-in view instead of per-app flat id lists.
 * A product passes only its inspection flow and, optionally, its own leading rows such as FETCH.
 */
fun circlePortScreen(
    ports: Flow<List<CirclePortInspection>>,
    push: (RingScreen) -> Unit,
    title: String = "PORTS",
    leadingRows: List<RowSpec> = emptyList(),
): RingScreen.Rows = RingScreen.Rows(
    title = title,
    items = ports.map { snapshot ->
        buildList {
            addAll(leadingRows)
            add(RowSpec("summary", "STATUS", circlePortSummary(snapshot), RingIcons.Gauge,
                onTap = { push(statusFilterScreen(ports, push)) }))
            val attention = snapshot.filter(CirclePortInspection::needsAttention)
            if (attention.isNotEmpty()) {
                add(RowSpec("attention", "NEEDS ATTENTION", "${attention.size} port${if (attention.size == 1) "" else "s"}",
                    RingIcons.Warning, accent = CircleAccent.CAUTION,
                    onTap = { push(portListScreen("NEEDS ATTENTION", ports.map { it.filter(CirclePortInspection::needsAttention) }, push)) }))
            }
            circlePortGroups(snapshot).forEach { group ->
                add(RowSpec(group.key, group.title.uppercase(), circlePortGroupSummary(group), statusIcon(group.worst),
                    accent = statusAccent(group.worst),
                    onTap = { push(groupScreen(ports, group.key, group.title, push)) }))
            }
        }
    },
)

private fun statusFilterScreen(ports: Flow<List<CirclePortInspection>>, push: (RingScreen) -> Unit) = RingScreen.Rows(
    title = "STATUS",
    items = ports.map { snapshot ->
        CirclePortStatus.entries.mapNotNull { status ->
            val count = snapshot.count { it.status() == status }
            if (count == 0) return@mapNotNull null
            RowSpec(status.name, status.name, "$count port${if (count == 1) "" else "s"}", statusIcon(status),
                accent = statusAccent(status),
                onTap = { push(portListScreen(status.name, ports.map { rows -> rows.filter { it.status() == status } }, push)) })
        }
    },
)

private fun groupScreen(ports: Flow<List<CirclePortInspection>>, key: String, title: String, push: (RingScreen) -> Unit) =
    RingScreen.Rows(
        title = title.uppercase(),
        items = ports.map { snapshot ->
            val members = snapshot.filter { it.groupKey() == key }
            CirclePortRole.entries.flatMap { role ->
                val inRole = members.filter { it.role == role }.sortedBy(CirclePortInspection::id)
                if (inRole.isEmpty()) emptyList()
                else listOf(RowSpec("section-$role", sectionTitle(role), "", null)) + inRole.map { portRow(it, ports, push) }
            }
        },
    )

private fun portListScreen(title: String, ports: Flow<List<CirclePortInspection>>, push: (RingScreen) -> Unit) = RingScreen.Rows(
    title = title,
    items = ports.map { snapshot -> snapshot.sortedBy(CirclePortInspection::id).map { portRow(it, ports, push, fullName = true) } },
)

private fun portRow(
    port: CirclePortInspection,
    ports: Flow<List<CirclePortInspection>>,
    push: (RingScreen) -> Unit,
    fullName: Boolean = false,
) = RowSpec(
    key = port.id,
    title = if (fullName) "${circlePortWords(port.groupKey())} · ${port.shortName()}" else port.shortName(),
    sub = circlePortPreview(port),
    icon = statusIcon(port.status()),
    accent = statusAccent(port.status()),
    onTap = { push(portScreen(ports, port.id)) },
)

private fun portScreen(ports: Flow<List<CirclePortInspection>>, id: String) = RingScreen.Rows(
    title = id.substringAfterLast('.').uppercase(),
    items = ports.map { snapshot -> snapshot.singleOrNull { it.id == id }?.let(::circlePortFactRows).orEmpty() },
)

/** Level 3: every fact of one port, including its full id, which only appears here. */
fun circlePortFactRows(port: CirclePortInspection): List<RowSpec> = buildList {
    add(RowSpec("id", "PORT", port.id, RingIcons.Layers, multiline = true))
    add(RowSpec("status", "STATUS", listOfNotNull(port.status().name, port.ageMs?.let(::circlePortAge)).joinToString(" · "),
        statusIcon(port.status()), accent = statusAccent(port.status())))
    add(RowSpec("contract", "CONTRACT", port.contractRef, RingIcons.Book))
    add(RowSpec("direction", "DIRECTION", "${port.direction} · ${port.boundary}${if (port.required) " · required" else ""}", RingIcons.Arrow))
    add(RowSpec("quality", "QUALITY", port.quality.name, RingIcons.Gauge))
    add(RowSpec("bindings", "BINDINGS", port.bindings.sorted().joinToString("\n").ifEmpty { "none" }, RingIcons.Link, multiline = true))
    if (port.role == CirclePortRole.DEMAND) {
        add(RowSpec("demand", "DEMANDED BY", port.demandOwners.sorted().joinToString().ifEmpty { "nobody" }, RingIcons.Link))
    }
    circlePortValueFields(port.value.orEmpty()).forEachIndexed { index, (name, value) ->
        add(RowSpec("value-$index", name.uppercase(), value, RingIcons.Book, multiline = true))
    }
}

private fun sectionTitle(role: CirclePortRole) = when (role) {
    CirclePortRole.DATA -> "DATA"
    CirclePortRole.COMMAND -> "COMMANDS"
    CirclePortRole.DEMAND -> "DEMAND"
}

private fun statusIcon(status: CirclePortStatus) = when (status) {
    CirclePortStatus.BROKEN -> RingIcons.Warning
    CirclePortStatus.STALE -> RingIcons.Refresh
    CirclePortStatus.LIVE -> RingIcons.Gauge
    CirclePortStatus.IDLE -> RingIcons.Arrow
}

private fun statusAccent(status: CirclePortStatus) = when (status) {
    CirclePortStatus.BROKEN -> CircleAccent.DANGER
    CirclePortStatus.STALE -> CircleAccent.CLOUD
    CirclePortStatus.LIVE -> CircleAccent.POSITIVE
    CirclePortStatus.IDLE -> CircleAccent.NEUTRAL
}

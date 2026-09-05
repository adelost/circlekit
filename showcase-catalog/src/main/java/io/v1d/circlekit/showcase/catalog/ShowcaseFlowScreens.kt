package io.v1d.circlekit.showcase.catalog

import com.adelost.designkit.ui.CircleLabelProgress
import com.adelost.designkit.ui.RingIcons
import com.adelost.designkit.ui.RingTokens
import com.adelost.releasekit.ui.releaseUpdateRows
import com.adelost.ringkit.data.Health
import com.adelost.ringkit.data.SourceId
import com.adelost.ringkit.data.SourcePolicy
import com.adelost.ringkit.data.SourceState
import com.adelost.ringkit.data.Trigger
import com.adelost.ringkit.data.healthOf
import com.adelost.ringkit.ui.RingScreen
import com.adelost.ringkit.ui.ActionSpec
import com.adelost.ringkit.ui.RowSpec
import com.adelost.servicekit.ServiceOutcome
import com.adelost.servicekit.ServiceSnapshot
import kotlin.time.Duration.Companion.minutes
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map

/** Real shared projections fed only deterministic local fixture data. */
object ShowcaseFlowScreens {
    fun source(state: ShowcaseFlowState): RingScreen.Detail {
        val health = combine(state.source, state.sourceEnabled) { source, enabled ->
            healthOf(
                source,
                SourcePolicy(
                    ttl = 5.minutes,
                    triggers = setOf(Trigger.VISIBLE),
                    enabled = { enabled },
                ),
                ShowcaseFlowState.NOW_MONO_MS,
            )
        }
        return RingScreen.Detail(
            title = "DATA AGE DEMO",
            icon = RingIcons.Cloud,
            sourceId = SourceId("showcase-flow"),
            hero = state.source.map { it.value ?: "—" },
            sub = state.source.map { "DEMO · ${sourceCopy(it)}" },
            freshness = combine(state.source, health) { source, sourceHealth ->
                sourceFreshness(source, sourceHealth)
            },
            health = health,
            progress = state.source.map { it.progress },
            onRefresh = state::refreshSource,
            refreshEnabled = state.source.map { !it.inFlight },
            actions = listOf(ActionSpec("NEXT EXAMPLE", RingIcons.ChevronRight, state::advanceSource)),
        )
    }

    fun update(state: ShowcaseFlowState): RingScreen.Rows = RingScreen.Rows(
        title = "UPDATE DEMO",
        items = state.update.map { updateState ->
            listOf(RowSpec("demo-note", "SIMULATION", "No download or installation", icon = null)) + releaseUpdateRows(
                state = updateState,
                currentVersionName = "0.3.9",
                updateKey = "update",
                updateTitle = "UPDATE",
                onCheck = state::advanceUpdate,
                onInstall = state::advanceUpdate,
                hint = "Advances only deterministic update data; no download or install is performed.",
            ) + demoStep(state::advanceUpdate)
        },
    )

    fun service(state: ShowcaseFlowState): RingScreen.Rows = RingScreen.Rows(
        title = "WORK DEMO",
        items = state.service.map { snapshot -> serviceRows(snapshot, state) + demoStep(state::advanceService) },
    )

    private fun demoStep(next: () -> Unit) = RowSpec(
        "demo-next", "NEXT DEMO STEP", "Local simulation; no network request", RingIcons.ChevronRight,
        onTap = next, multiline = true,
    )

    private fun serviceRows(snapshot: ServiceSnapshot, state: ShowcaseFlowState): List<RowSpec> {
        val lastAttempt = snapshot.lastAttempt
        val outcome = lastAttempt?.outcome
        val active = snapshot.activeOperations > 0 || snapshot.activeTransfers > 0
        return listOf(
            RowSpec(
                key = "status",
                title = "SERVICE",
                sub = when {
                    active -> "ACTIVE · ${snapshot.activeTransfers} TRANSFER"
                    outcome == ServiceOutcome.SUCCESS -> "SUCCESS · ${lastAttempt.durationMs} MS"
                    outcome == ServiceOutcome.FAILED -> "FAILED · ${lastAttempt.detail ?: "UNKNOWN"}"
                    else -> "IDLE"
                },
                icon = if (outcome == ServiceOutcome.FAILED) RingIcons.Warning else RingIcons.Wifi,
                onTap = state::advanceService.takeIf { !active },
                labelProgress = CircleLabelProgress.Indeterminate.takeIf { active },
                semanticColor = RingTokens.Broken.takeIf { outcome == ServiceOutcome.FAILED },
            ),
            RowSpec(
                key = "network",
                title = "NETWORK CALLS",
                sub = snapshot.networkCallCount.toString(),
                icon = RingIcons.Link,
            ),
            RowSpec(
                key = "cache",
                title = "CACHE",
                sub = snapshot.cache?.let { "${it.itemCount ?: 0} ITEMS · ${it.bytes / 1_048_576L} MB" } ?: "EMPTY",
                icon = RingIcons.Layers,
            ),
        )
    }

    internal fun sourceCopy(source: SourceState<*>): String {
        val error = source.lastError
        return when {
            error != null -> "${if (source.value == null) "NO VALUE" else "UPDATE FAILED"} · ${error.word}"
            source.coverage < 1f -> "PARTIAL · ${(source.coverage * 100).toInt()}% COVERAGE"
            else -> "EXAMPLE DATA"
        }
    }

    internal fun sourceFreshness(source: SourceState<*>, health: Health): String {
        val data = when {
            health == Health.OFF -> "DISABLED"
            source.value == null -> "NO VALUE"
            else -> {
                val age = source.fetchedAtWall?.let {
                    "${((ShowcaseFlowState.NOW_WALL_MS - it) / 60_000L).coerceAtLeast(0L)} MIN AGO"
                } ?: "AGE UNKNOWN"
                "${if (health == Health.FRESH) "FRESH" else "LAST VALUE"} · $age"
            }
        }
        val attempt = if (source.inFlight) {
            source.progress?.takeIf { it.total > 0 }?.let { "FETCHING ${it.done}/${it.total}" }
                ?: "FETCHING · RESPONSE PENDING"
        } else {
            source.lastError?.word
        }
        return listOfNotNull(data, attempt).joinToString(" · ")
    }
}

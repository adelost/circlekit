package io.v1d.circlekit.showcase.catalog

import com.adelost.designkit.ui.CircleLabelProgress
import com.adelost.designkit.ui.RingIcons
import com.adelost.designkit.ui.RingTokens
import com.adelost.ringkit.data.FetchError
import com.adelost.ringkit.data.Health
import com.adelost.ringkit.data.SourceId
import com.adelost.ringkit.data.SourcePolicy
import com.adelost.ringkit.data.Trigger
import com.adelost.ringkit.data.healthOf
import com.adelost.ringkit.ui.RingScreen
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
            title = "SOURCE HEALTH",
            icon = RingIcons.Cloud,
            sourceId = SourceId("showcase-flow"),
            hero = state.source.map { it.value ?: "—" },
            sub = state.source.map { source -> sourceCopy(source.lastError, source.coverage) },
            freshness = combine(state.source, health) { source, sourceHealth ->
                when {
                    source.inFlight -> "FETCHING ${source.progress?.done ?: 0}/${source.progress?.total ?: 0}"
                    sourceHealth == Health.OFF -> "DISABLED"
                    sourceHealth == Health.FRESH -> "FRESH · JUST NOW"
                    sourceHealth == Health.AGING && source.value != null -> "AGING · LAST GOOD KEPT"
                    sourceHealth == Health.BROKEN -> source.lastError?.word ?: "BROKEN"
                    else -> "WAITING FOR FIRST VALUE"
                }
            },
            health = health,
            progress = state.source.map { it.progress },
            onRefresh = state::refreshSource,
            refreshEnabled = state.source.map { !it.inFlight },
        )
    }

    fun update(state: ShowcaseFlowState): RingScreen.Rows = RingScreen.Rows(
        title = "UPDATE FLOW",
        items = state.update.map { updateState ->
            showcaseUpdateRows(
                state = updateState,
                currentVersionName = "0.3.9",
                updateKey = "update",
                updateTitle = "UPDATE",
                onCheck = state::advanceUpdate,
                onInstall = state::advanceUpdate,
                hint = "Advances only deterministic update data; no download or install is performed.",
            ).map { row ->
                row.copy(semanticColor = RingTokens.Broken.takeIf { row.sub.startsWith("FAILED") })
            }
        },
    )

    fun service(state: ShowcaseFlowState): RingScreen.Rows = RingScreen.Rows(
        title = "SERVICE STATUS",
        items = state.service.map { snapshot -> serviceRows(snapshot, state) },
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

    private fun sourceCopy(error: FetchError?, coverage: Float): String = when {
        error != null -> "NO USABLE VALUE · ${error.word}"
        coverage < 1f -> "PARTIAL · ${(coverage * 100).toInt()}% COVERAGE"
        else -> "DETERMINISTIC FIXTURE"
    }

}

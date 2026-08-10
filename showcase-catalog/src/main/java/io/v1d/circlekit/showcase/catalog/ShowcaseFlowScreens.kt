package io.v1d.circlekit.showcase.catalog

import com.adelost.designkit.ui.CircleLabelProgress
import com.adelost.designkit.ui.RingIcons
import com.adelost.designkit.ui.RingTokens
import com.adelost.releasekit.ui.releaseUpdateRows
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
import kotlinx.coroutines.flow.flowOf

/** Real shared projections fed only deterministic local fixture data. */
object ShowcaseFlowScreens {
    fun source(model: ShowcaseSourceSnapshot, emitter: ShowcaseTypedRendererEmitter): RingScreen.Detail {
        val health = healthOf(
                model.source,
                SourcePolicy(
                    ttl = 5.minutes,
                    triggers = setOf(Trigger.VISIBLE),
                    enabled = { model.enabled },
                ),
                ShowcaseFlowState.NOW_MONO_MS,
            )
        return RingScreen.Detail(
            title = "SOURCE HEALTH",
            icon = RingIcons.Cloud,
            sourceId = SourceId("showcase-flow"),
            hero = flowOf(model.source.value ?: "—"),
            sub = flowOf(sourceCopy(model.source.lastError, model.source.coverage)),
            freshness = flowOf(when {
                    model.source.inFlight -> "FETCHING ${model.source.progress?.done ?: 0}/${model.source.progress?.total ?: 0}"
                    health == Health.OFF -> "DISABLED"
                    health == Health.FRESH -> "FRESH · JUST NOW"
                    health == Health.AGING && model.source.value != null -> "AGING · LAST GOOD KEPT"
                    health == Health.BROKEN -> model.source.lastError?.word ?: "BROKEN"
                    else -> "WAITING FOR FIRST VALUE"
                }),
            health = flowOf(health),
            progress = flowOf(model.source.progress),
            onRefresh = { emitter.emit(ShowcaseRendererEventPayload("source.refresh")) },
            refreshEnabled = flowOf(!model.source.inFlight),
        )
    }

    fun update(model: ShowcaseUpdateSnapshot, emitter: ShowcaseTypedRendererEmitter): RingScreen.Rows = RingScreen.Rows(
        title = "UPDATE FLOW",
        items = flowOf(
            releaseUpdateRows(
                state = model.state,
                currentVersionName = "0.3.9",
                updateKey = "update",
                updateTitle = "UPDATE",
                onCheck = { emitter.emit(ShowcaseRendererEventPayload("update.advance")) },
                onInstall = { emitter.emit(ShowcaseRendererEventPayload("update.advance")) },
                hint = "Advances only deterministic update data; no download or install is performed.",
            )),
    )

    fun service(model: ShowcaseServiceSnapshot, emitter: ShowcaseTypedRendererEmitter): RingScreen.Rows = RingScreen.Rows(
        title = "SERVICE STATUS",
        items = flowOf(serviceRows(model.state, emitter)),
    )

    private fun serviceRows(snapshot: ServiceSnapshot, emitter: ShowcaseTypedRendererEmitter): List<RowSpec> {
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
                onTap = { emitter.emit(ShowcaseRendererEventPayload("service.advance")) }.takeIf { !active },
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

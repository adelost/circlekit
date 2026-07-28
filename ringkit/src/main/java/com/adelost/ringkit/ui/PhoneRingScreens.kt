package com.adelost.ringkit.ui

import com.adelost.designkit.ui.*

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Icon
import androidx.wear.compose.material.Text
import com.adelost.ringkit.data.Health
import com.adelost.ringkit.data.Progress

/**
 * Rectangular translation of the same [RingScreen] data used by Watch.
 * The data graph and atoms stay shared; only capacity, list physics and
 * placement change. Round rendering remains isolated in [RenderRingScreen].
 */
@Composable
internal fun PhoneRingScreen(
    nav: RingNavigator,
    onExit: () -> Unit,
) {
    val back: () -> Unit = { if (!nav.back()) onExit() }
    Box(
        modifier = Modifier.fillMaxSize().skyvwMenuCanvas(),
        contentAlignment = Alignment.TopCenter,
    ) {
        when (val screen = nav.current) {
            is RingScreen.Hub -> PhoneHubScreen(screen, nav, back)
            is RingScreen.Detail -> PhoneDetailScreen(screen, back)
            is RingScreen.Menu -> PhoneMenuScreen(screen, nav, back)
            is RingScreen.Adjustment -> PhoneAdjustmentScreen(screen, back)
            is RingScreen.ColorPicker -> PhoneColorPickerScreen(screen, nav, back)
            is RingScreen.DialPreview -> PhoneDialPreviewScreen(screen, back)
        }
    }
}

@Composable
private fun PhoneMenuScreen(
    screen: RingScreen.Menu,
    nav: RingNavigator,
    back: () -> Unit,
) {
    when (screen) {
        is RingScreen.Launcher -> PhoneLauncherScreen(screen, nav, back, screen.gridRole)
        is RingScreen.Rows -> PhoneRowsScreen(screen, nav, back.takeIf { screen.showBack })
    }
}

@Composable
fun PhoneScreenHeader(
    title: String,
    onBack: (() -> Unit)?,
    icon: ImageVector? = null,
    actions: List<PhoneHeaderAction> = emptyList(),
    modifier: Modifier = Modifier,
) {
    require(actions.size <= MAX_PHONE_HEADER_ACTIONS) {
        "A phone header supports at most $MAX_PHONE_HEADER_ACTIONS actions"
    }
    val design = phoneSurfaceDesign()
    Row(
        modifier = modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        onBack?.let { BackRing(onBack = it, diameter = design.actionDiameter) }
        icon?.let {
            Icon(
                it,
                contentDescription = null,
                tint = RingTokens.Dim,
                modifier = Modifier.size(design.actionIconSize),
            )
        }
        Text(
            text = title,
            color = RingTokens.Ink,
            fontSize = design.headerTitleSize,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 1.2.sp,
            modifier = Modifier.weight(1f),
        )
        actions.forEach { action ->
            SkyvwIconDisc(
                icon = action.icon,
                contentDescription = action.contentDescription,
                actionLabel = action.label,
                onTap = action.onTap,
                diameter = design.rowIconDiameter,
                iconSize = design.rowIconSize,
                active = action.active,
                enabled = action.enabled,
                accent = action.accent,
                timing = action.timing,
            )
        }
    }
}

/** Product-neutral trailing action rendered by the canonical phone header. */
data class PhoneHeaderAction(
    val icon: ImageVector,
    val label: String,
    val contentDescription: String = label,
    val active: Boolean = false,
    val enabled: Boolean = true,
    val accent: SkyvwAccent = ringIconAccent(icon),
    val timing: SkyvwActionTiming = SkyvwActionTiming.DELIBERATE,
    val onTap: () -> Unit,
)

private const val MAX_PHONE_HEADER_ACTIONS = 2

@Composable
private fun PhoneHubScreen(
    screen: RingScreen.Hub,
    nav: RingNavigator,
    back: () -> Unit,
) {
    val design = phoneSurfaceDesign()
    val grid = design.hubGrid
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        PhoneScreenHeader(screen.title, back)
        Spacer(Modifier.height(design.hubTopGap))
        RingMenuGrid(items = screen.rows, spec = grid) { row ->
            val value = row.value.collectAsState(initial = "–").value
            val health = row.health.collectAsState(initial = Health.OFF).value
            val iconRotation = row.iconRotation.collectAsState(initial = 0f).value
            StatRing(
                icon = row.icon,
                iconRotationDeg = iconRotation,
                value = value,
                health = health,
                label = row.label,
                diameter = grid.diameter,
                onTap = { nav.push(row.detail()) },
            )
        }
        screen.corner?.let { corner ->
            IconRing(
                icon = corner.icon,
                label = corner.label,
                diameter = design.actionDiameter,
                onTap = { corner.open()?.let(nav::push) ?: corner.run?.invoke() },
            )
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun PhoneDetailScreen(
    screen: RingScreen.Detail,
    back: () -> Unit,
) {
    val hero = screen.hero.collectAsState(initial = "–").value
    val sub = screen.sub.collectAsState(initial = "").value
    val freshness = screen.freshness.collectAsState(initial = "").value
    val health = screen.health.collectAsState(initial = Health.OFF).value
    val progress = screen.progress.collectAsState(initial = null).value
    val refreshEnabled = screen.refreshEnabled?.collectAsState(initial = true)?.value ?: true
    Column(
        modifier = Modifier
            .fillMaxSize()
            .widthIn(max = 560.dp)
            .verticalScroll(rememberScrollState()),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        PhoneScreenHeader(screen.title, back, screen.icon)
        Spacer(Modifier.height(24.dp))
        Text(hero, color = RingTokens.Ink, fontSize = 38.sp, fontWeight = FontWeight.Black)
        if (sub.isNotEmpty()) {
            Text(sub, color = RingTokens.Dim, fontSize = 12.sp)
        }
        Text(
            freshness,
            color = health.ringColor(),
            fontSize = 10.5.sp,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp),
        )
        screen.actions.forEach { action ->
            Spacer(Modifier.height(10.dp))
            if (action.holdToConfirm) {
                HoldPill(action.label, action.onRun, destructive = action.destructive)
            } else {
                TextAction(action.label, action.onRun)
            }
        }
        screen.onRefresh?.let { refresh ->
            TextAction(
                text = "REFRESH",
                onTap = refresh,
                enabled = refreshEnabled,
                labelProgress = measuredWorkLabelProgress(progress, inFlight = !refreshEnabled),
                modifier = Modifier.padding(top = 18.dp),
            )
        }
        Spacer(Modifier.height(32.dp))
    }
}

@Composable
private fun PhoneLauncherScreen(
    screen: RingScreen.Launcher,
    nav: RingNavigator,
    back: () -> Unit,
    gridRole: MenuGridRole,
) {
    val grid = menuGridSpec(
        LocalSkyvwSurfaceLayout.current.surfaceClass,
        LocalSkyvwMenuDensity.current,
        gridRole,
    )
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        PhoneScreenHeader(screen.title, back)
        Spacer(Modifier.height(22.dp))
        RingMenuGrid(items = screen.entries, spec = grid) { entry ->
            val active = entry.active.collectAsState(initial = null).value
            val label = entry.liveLabel?.collectAsState(initial = entry.label)?.value ?: entry.label
            IconRing(
                icon = entry.icon,
                label = label,
                active = active,
                diameter = grid.diameter,
                onTap = { entry.open()?.let(nav::push) ?: entry.run?.invoke() },
            )
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun PhoneRowsScreen(
    screen: RingScreen.Rows,
    nav: RingNavigator,
    back: (() -> Unit)?,
) {
    val rows: State<List<RowSpec>> = screen.items.collectAsState(initial = emptyList())
    val listState = remember(screen) { androidx.compose.foundation.lazy.LazyListState() }
    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize().widthIn(max = 640.dp),
        contentPadding = PaddingValues(bottom = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        item("header") { PhoneScreenHeader(screen.title, back) }
        items(rows.value, key = RowSpec::key) { row ->
            val rowModifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)
            when (rowKind(row)) {
                RowKind.ADJUSTMENT -> {
                    val link = adjustmentLinkRow(row) {
                        nav.push(screen.adjustmentScreen(row))
                    }
                    RingRow(
                        title = link.title,
                        sub = link.sub,
                        icon = link.icon,
                        accent = link.accent,
                        onTap = link.onTap,
                        hint = row.hint,
                        modifier = rowModifier,
                    )
                }
                RowKind.TOGGLE, RowKind.CHOICE_OF_N -> {
                    val interaction = choiceRowInteraction(row)
                    RingChoiceRow(
                        title = row.title,
                        selected = row.sub,
                        icon = row.icon,
                        accent = row.accent,
                        options = row.choices,
                        role = row.choiceRole,
                        onSelect = requireNotNull(row.onSelect),
                        holdMs = interaction.holdMs,
                        actionTiming = interaction.timing,
                        hint = row.hint,
                        modifier = rowModifier,
                    )
                }
                RowKind.INFORMATION, RowKind.ACTION -> RingRow(
                    title = row.title,
                    sub = row.sub,
                    icon = row.icon,
                    accent = row.accent,
                    onTap = row.onTap,
                    labelProgress = row.labelProgress,
                    holdToConfirm = row.holdToConfirm,
                    holdMs = row.holdMs,
                    centerValue = row.centerValue,
                    actionTiming = row.actionTiming,
                    hint = row.hint,
                    modifier = rowModifier,
                )
            }
        }
    }
}

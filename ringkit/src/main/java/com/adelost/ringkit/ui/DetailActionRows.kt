package com.adelost.ringkit.ui

import com.adelost.designkit.ui.*

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import com.adelost.ringkit.data.Progress

/** One pressable row under a [RingScreen.Detail]'s hero: a declared action, or REFRESH. */
internal data class DetailActionRow(
    val title: String,
    val icon: ImageVector,
    val accent: CircleAccent,
    val holdToConfirm: Boolean,
    /** Null while the row cannot run: REFRESH during a fetch, or an action with a reason it cannot run now. */
    val onTap: (() -> Unit)?,
    val isRefresh: Boolean,
    /** The reason an action cannot run now, drawn as the row's line; empty when it can. */
    val sub: String = "",
)

/**
 * A Detail's actions are rows, the same atom the rest of the menu system uses, on every host.
 * The phone drew them as bare pale words with no icon while the watch drew icon rows (Skyvw row 163),
 * so both renderers now draw this one list.
 */
internal fun detailActionRows(
    actions: List<ActionSpec>,
    onRefresh: (() -> Unit)?,
    refreshEnabled: Boolean,
    unavailableReasons: List<String?> = actions.map { null },
): List<DetailActionRow> = actions.zip(unavailableReasons) { action, reason ->
    DetailActionRow(
        title = action.label,
        icon = action.icon,
        accent = if (action.destructive) CircleAccent.DANGER else ringIconAccent(action.icon),
        // A hold that cannot run is not a hold: there is nothing for the press to confirm.
        holdToConfirm = action.holdToConfirm && reason == null,
        onTap = action.onRun.takeIf { reason == null },
        isRefresh = false,
        sub = reason.orEmpty(),
    )
} + listOfNotNull(
    onRefresh?.let { refresh ->
        DetailActionRow(
            title = "REFRESH",
            icon = RingIcons.Refresh,
            accent = ringIconAccent(RingIcons.Refresh),
            holdToConfirm = false,
            onTap = refresh.takeIf { refreshEnabled },
            isRefresh = true,
        )
    },
)

@Composable
internal fun DetailActionRows(
    screen: RingScreen.Detail,
    refreshEnabled: Boolean,
    progress: Progress?,
    rowModifier: Modifier,
) {
    val reasons = screen.actions.map { action -> action.unavailableReason.collectAsState(initial = null).value }
    detailActionRows(screen.actions, screen.onRefresh, refreshEnabled, reasons).forEach { row ->
        RingRow(
            title = row.title,
            sub = row.sub,
            icon = row.icon,
            accent = row.accent,
            onTap = row.onTap,
            holdToConfirm = row.holdToConfirm,
            // One verb, one feedback channel: measured fetch state lives in
            // REFRESH's label instead of a second progress ring beside it.
            labelProgress = if (row.isRefresh) measuredWorkLabelProgress(progress, inFlight = !refreshEnabled) else null,
            modifier = rowModifier,
        )
    }
}

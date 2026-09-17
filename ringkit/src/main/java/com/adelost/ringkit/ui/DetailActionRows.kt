package com.adelost.ringkit.ui

import com.adelost.designkit.ui.*

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import com.adelost.ringkit.data.Progress

/** One pressable row under a [RingScreen.Detail]'s hero: a declared action, or REFRESH. */
internal data class DetailActionRow(
    val title: String,
    val icon: ImageVector,
    val accent: CircleAccent,
    val holdToConfirm: Boolean,
    /** Null while the row cannot run (REFRESH during a fetch). */
    val onTap: (() -> Unit)?,
    val isRefresh: Boolean,
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
): List<DetailActionRow> = actions.map { action ->
    DetailActionRow(
        title = action.label,
        icon = action.icon,
        accent = if (action.destructive) CircleAccent.DANGER else ringIconAccent(action.icon),
        holdToConfirm = action.holdToConfirm,
        onTap = action.onRun,
        isRefresh = false,
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
    detailActionRows(screen.actions, screen.onRefresh, refreshEnabled).forEach { row ->
        RingRow(
            title = row.title,
            sub = "",
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

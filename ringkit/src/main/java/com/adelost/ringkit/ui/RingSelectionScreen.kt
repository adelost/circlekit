package com.adelost.ringkit.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.vector.ImageVector
import com.adelost.designkit.ui.CircleActionTiming
import com.adelost.designkit.ui.RingIcons
import kotlinx.coroutines.flow.MutableStateFlow

/** Unordered named choices use an explicit list, not a cycling setting. */
data class RingSelectionOption(
    val id: String,
    val title: String,
    val detail: String = "",
    val enabled: Boolean = true,
)

/** Selection is by stable identity; identical names never select the wrong item. */
fun ringSelectionRows(
    options: List<RingSelectionOption>,
    selectedId: String?,
    icon: ImageVector,
    onSelect: (String) -> Unit,
): List<RowSpec> {
    require(options.map { it.id }.distinct().size == options.size)
    require(options.all { it.id.isNotBlank() && it.title.isNotBlank() })
    return options.map { option ->
        RowSpec(
            key = option.id,
            title = option.title,
            sub = listOfNotNull(
                "Selected".takeIf { option.id == selectedId },
                option.detail.takeIf(String::isNotBlank),
            ).joinToString(" · "),
            icon = if (option.id == selectedId) RingIcons.Check else icon,
            onTap = if (option.enabled) ({ onSelect(option.id) }) else null,
            actionTiming = CircleActionTiming.IMMEDIATE,
            multiline = true,
        )
    }
}

/** Same row/chrome/scroll host as every other menu, on Phone and Wear. */
@Composable
fun RingSelectionScreen(
    title: String,
    options: List<RingSelectionOption>,
    selectedId: String?,
    icon: ImageVector,
    onSelect: (String) -> Unit,
    onBack: () -> Unit,
    emptyLabel: String,
) {
    val items = remember { MutableStateFlow(emptyList<RowSpec>()) }
    val navigator = remember(title) {
        RingNavigator(RingScreen.Rows(title, items, showBack = true))
    }
    LaunchedEffect(options, selectedId, onSelect) {
        items.value = ringSelectionRows(options, selectedId, icon, onSelect)
            .ifEmpty { listOf(RowSpec("empty", emptyLabel, "", icon)) }
    }
    RenderRingScreen(nav = navigator, backLabel = "Back", onExit = onBack)
}

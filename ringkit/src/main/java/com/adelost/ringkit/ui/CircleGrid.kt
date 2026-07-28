package com.adelost.ringkit.ui

import com.adelost.designkit.ui.*

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** GUI-only circle description. Product presentation maps semantic icon/action
 * tokens to this boundary; RingKit owns only layout and pixels. */
data class CircleUiModel(
    val key: String,
    val label: String,
    val icon: ImageVector,
    val accent: SkyvwAccent = ringIconAccent(icon),
    val active: Boolean? = null,
    /** State line under the label; null renders nothing. */
    val sub: String? = null,
    val onTap: () -> Unit,
)

/** Keep renderers policy-free: surface/role selection already happened in
 * [MenuGridSpec], so neither a nullable width cap nor host type is re-derived
 * here. */
internal fun resolvedCircleGridWidthFraction(spec: MenuGridSpec): Float =
    spec.contentWidthFraction

/** The single row/column renderer for ring-based menus on every host.
 *
 * Every host gets equal-width cells, a declarative content cap and the same
 * centred width policy. Renderers provide only the ring content; they never
 * re-derive geometry from host type. */
@Composable
internal fun <T> RingMenuGrid(
    items: List<T>,
    spec: MenuGridSpec,
    itemContent: @Composable (T) -> Unit,
) {
    Box(
        modifier = Modifier.fillMaxWidth(),
        contentAlignment = Alignment.TopCenter,
    ) {
        Box(
            modifier = Modifier
                .then(spec.contentMaxWidth?.let { Modifier.widthIn(max = it) } ?: Modifier)
                .fillMaxWidth(),
            contentAlignment = Alignment.TopCenter,
        ) {
            Column(
                modifier = Modifier.fillMaxWidth(resolvedCircleGridWidthFraction(spec)),
            ) {
                items.chunked(spec.columns).forEach { chunk ->
                    // A short last row is CENTRED, not left-aligned. The
                    // padding used to go entirely on the right, so the tenth
                    // settings circle (DEV) sat alone under the left column
                    // looking like it had been dropped there.
                    val emptyCells = spec.columns - chunk.size
                    // Deliberately NOT roundSafeContentInset here, though the
                    // outer columns' labels do get clipped by the arc while
                    // scrolling. Tried it: the cells are weight(1f), so
                    // insetting the row narrows every cell, and SYSTEM/ABOUT
                    // went from occasionally clipped to permanently ellipsised
                    // ("SYST…", "AB…"). A grid trades width for columns; the
                    // row atom can afford the inset because it has one column.
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(spec.horizontalGap),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        if (emptyCells > 0) Spacer(Modifier.weight(emptyCells / 2f))
                        chunk.forEach { item ->
                            Box(Modifier.weight(1f), contentAlignment = Alignment.TopCenter) {
                                itemContent(item)
                            }
                        }
                        if (emptyCells > 0) Spacer(Modifier.weight(emptyCells / 2f))
                    }
                    Spacer(Modifier.height(spec.verticalGap))
                }
            }
        }
    }
}

/** [CircleGrid] maps the GUI model onto the shared [RingMenuGrid]. */
@Composable
fun CircleGrid(items: List<CircleUiModel>, spec: MenuGridSpec) {
    RingMenuGrid(items = items, spec = spec) { item ->
        IconRing(
            icon = item.icon,
            label = item.label,
            active = item.active,
            accent = item.accent,
            diameter = spec.diameter,
            sub = item.sub,
            labelSize = spec.labelSize,
            onTap = item.onTap,
        )
    }
}

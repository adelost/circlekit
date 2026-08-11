package com.adelost.renderkit.list

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp

/**
 * Rectangular host translation of [SkyvwListSpec]. The items remain the exact
 * same shared composables as Watch; only list physics and capacity differ.
 */
@Composable
fun SkyvwLinearListHost(
    spec: SkyvwListSpec,
    modifier: Modifier = Modifier,
    contentMaxWidthDp: Float? = null,
) {
    val listState = rememberLazyListState()
    if (spec.policy.anchor == SkyvwListAnchor.ITEM_CENTER) {
        val anchorOffsetPx =
            with(LocalDensity.current) { spec.policy.initialAnchorOffsetDp.dp.roundToPx() }
        LaunchedEffect(spec.policy.initialIndex, anchorOffsetPx) {
            listState.scrollToItem(spec.policy.initialIndex)
            val item = listState.layoutInfo.visibleItemsInfo
                .firstOrNull { it.index == spec.policy.initialIndex } ?: return@LaunchedEffect
            val viewportHeight =
                listState.layoutInfo.viewportEndOffset - listState.layoutInfo.viewportStartOffset
            listState.scrollToItem(
                spec.policy.initialIndex,
                scrollOffset = item.size / 2 + anchorOffsetPx - viewportHeight / 2,
            )
        }
    }
    Box(
        modifier = modifier.fillMaxSize().background(spec.policy.background.color()),
        contentAlignment = Alignment.TopCenter,
    ) {
        LazyColumn(
            state = listState,
            modifier = Modifier
                .then(
                    contentMaxWidthDp?.let {
                        Modifier.widthIn(max = it.dp).fillMaxWidth().fillMaxHeight()
                    } ?: Modifier.fillMaxSize(),
                ),
            contentPadding = PaddingValues(
                start = spec.policy.paddingHorizontalDp.dp,
                end = spec.policy.paddingHorizontalDp.dp,
                top = spec.policy.paddingTopDp.dp,
                bottom = spec.policy.paddingBottomDp.dp,
            ),
            verticalArrangement = Arrangement.spacedBy(spec.policy.itemSpacingDp.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // One column is the sequence itself, item by item, exactly as
            // before. Kept as its own path deliberately: CENTER_FOCUS scales by
            // LAZY ITEM index, so folding a group into a single item would
            // change the fisheye and the recycling granularity on every screen
            // that never asked for columns.
            if (spec.policy.columns == 1) {
                spec.items.forEachIndexed { index, specItem ->
                    item(key = specItem.key, contentType = specItem.contentType) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .then(
                                    if (spec.policy.scrollEffect == SkyvwListScrollEffect.CENTER_FOCUS) {
                                        Modifier.skyvwCenterFocusScale(listState, index)
                                    } else {
                                        Modifier
                                    },
                                ),
                            contentAlignment = Alignment.Center,
                        ) {
                            specItem.content()
                        }
                    }
                }
                return@LazyColumn
            }
            // Wider hosts render the SAME sequence, split into lines by the one
            // pure function the tests guard. A line is one lazy item because a
            // line is what scrolls past as a unit.
            skyvwListLines(spec.items, spec.policy.columns).forEach { line ->
                item(key = line.first().key, contentType = line.first().contentType()) {
                    if (line.singleOrNull()?.fullLine == true) {
                        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                            line.first().items.forEach { it.content() }
                        }
                        return@item
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(spec.policy.columnGapDp.dp),
                    ) {
                        line.forEach { cell ->
                            // Centred like every other translation of this
                            // contract: the one-column path wraps each item in
                            // a centred Box, and the grid this replaces centred
                            // its cell content too.
                            Column(
                                modifier = Modifier.weight(1f),
                                horizontalAlignment = Alignment.CenterHorizontally,
                            ) {
                                cell.items.forEach { it.content() }
                            }
                        }
                        // A short last line keeps its cells the width every
                        // other line gives them, instead of stretching them.
                        repeat(spec.policy.columns - line.size) {
                            Spacer(Modifier.weight(1f))
                        }
                    }
                }
            }
        }
    }
}

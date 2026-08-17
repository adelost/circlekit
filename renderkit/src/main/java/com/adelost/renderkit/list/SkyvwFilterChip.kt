package com.adelost.renderkit.list

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.adelost.designkit.ui.GraphiteTokens
import com.adelost.designkit.ui.RingIcons
import com.adelost.designkit.ui.CircleActionTiming
import com.adelost.designkit.ui.CircleSurfaceClass
import com.adelost.designkit.ui.phoneSurfaceDesignFor
import com.adelost.designkit.ui.CircleText
import com.adelost.designkit.ui.circleSafeTap
import com.adelost.designkit.ui.rememberCircleActionFeedbackState
import com.adelost.designkit.ui.rememberCircleActionCueController

/**
 * THE Skyvw filter chip. One pill language for every "which slice am I
 * looking at" control — the jump log's tag filter and the records screen's
 * period window are the same question asked of different data, so they are
 * the same control (Mattias 2026-07-21: "hitta inte på olika designspråk").
 */
@Immutable
data class SkyvwFilterChipDesign(
    val minHeight: Dp,
    val paddingHorizontal: Dp,
    val paddingVertical: Dp,
    val gap: Dp,
    val iconSize: Dp,
    val activeIconSize: Dp,
    val textSizeSp: Float,
    val lineHeightSp: Float,
    /** Filters are reversible view state, so they belong to the immediate
     * action class and never draw a delayed rectangular label sweep. */
    val actionTiming: CircleActionTiming,
)

/**
 * THE filter-chip metric table, keyed by surface class. Deliberately without
 * default values above and without a second construction site below: a chip
 * row asks this catalog what size it is, so no screen can pick its own
 * numbers (this file exists because the records screen did exactly that).
 * [filterChipDesign] is an exhaustive `when`, so a new surface class refuses
 * to compile until its row is written.
 */
fun filterChipDesign(surface: CircleSurfaceClass): SkyvwFilterChipDesign {
    val phone = phoneSurfaceDesignFor(surface) ?: return WatchFilterChip
    return SkyvwFilterChipDesign(
        minHeight = 48.dp,
        paddingHorizontal = 14.dp,
        paddingVertical = 0.dp,
        gap = phone.controlGap,
        iconSize = 16.dp,
        activeIconSize = 16.dp,
        textSizeSp = phone.rowSubtitleSize.value,
        lineHeightSp = phone.rowSubtitleSize.value + 4f,
        actionTiming = CircleActionTiming.IMMEDIATE,
    )
}

private val WatchFilterChip = SkyvwFilterChipDesign(
    minHeight = 32.dp,
    paddingHorizontal = 10.dp,
    paddingVertical = 3.dp,
    gap = 5.dp,
    iconSize = 10.dp,
    activeIconSize = 11.dp,
    textSizeSp = 8f,
    lineHeightSp = WATCH_TEXT_LINE_HEIGHT_SP,
    actionTiming = CircleActionTiming.IMMEDIATE,
)

/**
 * What an unselected chip shows. The jump log collapses to its icon because
 * there the icons ARE the vocabulary; a row whose choices are words has to
 * keep the words or it becomes a row of blank circles.
 */
enum class SkyvwFilterChipCollapse { KEEP_LABEL, ICON_ONLY }

@Immutable
data class SkyvwFilterChipUi(
    val key: String,
    val label: String,
    val selected: Boolean,
    val onSelect: () -> Unit,
    val icon: (@Composable () -> Unit)? = null,
    /**
     * The centre-feedback glyph is data even when the chip renders a
     * custom/tinted icon, so every filter uses the same action-cue atom.
     */
    val cueIcon: ImageVector = RingIcons.Sliders,
)

@Composable
fun SkyvwFilterChipRow(
    chips: List<SkyvwFilterChipUi>,
    modifier: Modifier = Modifier,
    design: SkyvwFilterChipDesign,
    collapse: SkyvwFilterChipCollapse = SkyvwFilterChipCollapse.KEEP_LABEL,
    horizontalArrangement: Arrangement.Horizontal = Arrangement.spacedBy(design.gap),
    scrollable: Boolean = true,
) {
    val scrollState = rememberScrollState()
    Row(
        modifier = if (scrollable) modifier.horizontalScroll(scrollState) else modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = horizontalArrangement,
    ) {
        chips.forEach { chip ->
            SkyvwFilterChip(chip = chip, design = design, collapse = collapse)
        }
    }
}

@Composable
fun SkyvwFilterChip(
    chip: SkyvwFilterChipUi,
    design: SkyvwFilterChipDesign,
    collapse: SkyvwFilterChipCollapse = SkyvwFilterChipCollapse.KEEP_LABEL,
) {
    val feedback = rememberCircleActionFeedbackState()
    val cue = rememberCircleActionCueController(
        icon = chip.cueIcon,
        label = chip.label,
        timing = design.actionTiming,
        pressed = feedback.pressed,
    )
    val showLabel = chip.selected || collapse == SkyvwFilterChipCollapse.KEEP_LABEL
    val shape = RoundedCornerShape(50)
    val sizing = if (showLabel) {
        Modifier
            .heightIn(min = design.minHeight)
            .padding(horizontal = design.paddingHorizontal, vertical = design.paddingVertical)
    } else {
        Modifier.size(design.minHeight)
    }
    Row(
        modifier = Modifier
            .clip(shape)
            .background(
                if (chip.selected) {
                    GraphiteTokens.Ink.copy(alpha = 0.12f)
                } else {
                    GraphiteTokens.Faint.copy(alpha = 0.06f)
                },
            )
            .border(
                width = 1.dp,
                color = if (chip.selected) {
                    GraphiteTokens.Ink.copy(alpha = 0.55f)
                } else {
                    GraphiteTokens.Faint.copy(alpha = 0.28f)
                },
                shape = shape,
            )
            .semantics {
                this.selected = chip.selected
            }
            .circleSafeTap(
                feedback = feedback,
                holdMs = design.actionTiming.holdMs,
                label = chip.label,
                onTap = {
                    cue.confirm()
                    chip.onSelect()
                },
            )
            .then(sizing),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = if (showLabel) Arrangement.spacedBy(design.gap) else Arrangement.Center,
    ) {
        chip.icon?.invoke()
        if (showLabel) {
            CircleText(
                text = chip.label,
                color = if (chip.selected) GraphiteTokens.Ink else GraphiteTokens.Muted,
                fontSizeSp = design.textSizeSp,
                fontWeight = FontWeight.Bold,
                letterSpacingSp = 0.7f,
                lineHeightSp = design.lineHeightSp,
                tabularNumerals = true,
                modifier = Modifier.clearAndSetSemantics { },
            )
        }
    }
}

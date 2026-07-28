package com.adelost.ringkit.ui

import com.adelost.designkit.ui.*

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/** Shared renderer for a named compact option group. */
@Composable
fun CircleMenuOptionSection(
    section: EdgeMenuSection,
    modifier: Modifier = Modifier,
    layout: EdgeMenuLayout = EdgeMenuDesign.optionLayout(
        LocalCircleSurfaceLayout.current.surfaceClass,
        LocalCircleMenuDensity.current,
    ),
    onOptionTap: (EdgeMenuOption) -> Unit = { it.onTap() },
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        CircleText(
            text = section.label,
            color = GraphiteTokens.Muted,
            fontSizeSp = layout.sectionLabelSizeSp,
            fontWeight = FontWeight.Bold,
            letterSpacingSp = 0.8f,
            lineHeightSp = layout.sectionLabelSizeSp + 3f,
            modifier = Modifier.padding(top = layout.verticalGap / 2),
        )
        CircleMenuOptionRows(
            options = section.options,
            layout = layout,
            onOptionTap = onOptionTap,
        )
    }
}

@Composable
internal fun CircleMenuOptionRows(
    options: List<EdgeMenuOption>,
    layout: EdgeMenuLayout,
    onOptionTap: (EdgeMenuOption) -> Unit,
) {
    options.chunked(layout.columns).forEach { row ->
        Row(
            horizontalArrangement = Arrangement.spacedBy(layout.horizontalGap),
            modifier = Modifier.padding(vertical = layout.verticalGap / 2),
        ) {
            row.forEach { option ->
                CircleIconRing(
                    icon = option.icon,
                    label = option.label,
                    onTap = { onOptionTap(option) },
                    active = option.active,
                    choiceState = option.choiceState,
                    diameter = layout.ringDiameter,
                    labelSize = layout.labelSizeSp.sp,
                    timing = option.timing,
                )
            }
        }
    }
}

package com.adelost.ringkit.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material.Text
import com.adelost.designkit.ui.CircleStyleTokens
import com.adelost.designkit.ui.GraphiteTokens
import com.adelost.designkit.ui.RingIcons
import com.adelost.designkit.ui.RingTokens
import com.adelost.designkit.ui.phoneSurfaceDesign

/** Product-neutral state and intent for the shared phone composer atom. */
data class RingTextInputSpec(
    val value: String,
    val label: String,
    val enabled: Boolean = true,
    val maxLength: Int,
    val onValueChange: (String) -> Unit,
    val onSubmit: () -> Unit,
) {
    init {
        require(maxLength > 0)
        require(value.length <= maxLength)
    }
}

/**
 * Small host boundary for text entry on surfaces that use a platform editor.
 *
 * Phone surfaces render [RingTextComposer] inline. A round Wear host opens its
 * system IME and returns only the collected text through [onResult]; state and
 * submission remain owned by the semantic [spec].
 */
fun interface RingTextEntryPort {
    fun openPlatformTextEntry(
        spec: RingTextInputSpec,
        onResult: (String) -> Unit,
    )
}

/**
 * The one CircleKit text-entry molecule: Graphite field plus the normal
 * icon-ring action. Products own text and submission; they never redraw it.
 */
@Composable
fun RingTextComposer(
    spec: RingTextInputSpec,
    modifier: Modifier = Modifier,
) {
    val design = phoneSurfaceDesign()
    val canSubmit = spec.enabled && spec.value.isNotBlank()
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(design.controlGap),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        BasicTextField(
            value = spec.value,
            onValueChange = { next ->
                if (next.length <= spec.maxLength) spec.onValueChange(next)
            },
            enabled = spec.enabled,
            cursorBrush = SolidColor(CircleStyleTokens.Action),
            textStyle = TextStyle(
                color = RingTokens.Ink,
                fontSize = design.rowTitleSize,
                fontWeight = FontWeight.Medium,
            ),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
            keyboardActions = KeyboardActions(
                onSend = { if (canSubmit) spec.onSubmit() },
            ),
            modifier = Modifier
                .weight(1f)
                .heightIn(min = 56.dp)
                .border(1.dp, RingTokens.Outline, RoundedCornerShape(14.dp))
                .background(GraphiteTokens.Surface.copy(alpha = 0.45f), RoundedCornerShape(14.dp)),
            decorationBox = { field ->
                Box(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
                    contentAlignment = Alignment.CenterStart,
                ) {
                    if (spec.value.isEmpty()) {
                        Text(
                            text = spec.label,
                            color = RingTokens.Dim,
                            fontSize = design.rowSubtitleSize,
                        )
                    }
                    field()
                }
            },
        )
        IconRing(
            icon = RingIcons.Arrow,
            label = "SEND",
            onTap = spec.onSubmit,
            diameter = design.actionDiameter,
            active = canSubmit,
            enabled = canSubmit,
            iconRotationDegrees = 90f,
        )
    }
}

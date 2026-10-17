package com.adelost.designkit.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.max

@Immutable
data class CircleDiscSecondaryLabel(
    val text: String,
    val color: Color,
)

/** Pure visual data shared by passive instruments and interactive value discs. */
@Immutable
data class CircleDiscArtworkSpec(
    val primaryValue: String,
    val unit: String? = null,
    val primaryColor: Color,
    val unitColor: Color = primaryColor,
    val background: Color = Color.Transparent,
    val contour: Color,
    /** A secondary value owns the complete rim or none of it; this is not progress. */
    val secondaryRimColor: Color? = null,
    val secondaryLabel: CircleDiscSecondaryLabel? = null,
    val primaryRole: CircleTextRole = CircleTextRole.NUMBER,
)

internal const val CIRCLE_DISC_TEXT_WIDTH_FRACTION = 0.76f

/**
 * Shared, gesture-free disc artwork. Callers may place it in an app-owned dial;
 * only the artwork and measured fitting stay authoritative here.
 */
@Composable
fun CircleDiscArtwork(
    spec: CircleDiscArtworkSpec,
    modifier: Modifier = Modifier,
) {
    BoxWithConstraints(
        contentAlignment = Alignment.Center,
        modifier = modifier.clip(CircleShape).background(spec.background)
            .circleRingContour(spec.secondaryRimColor ?: spec.contour),
    ) {
        if (constraints.maxWidth <= 0 || constraints.maxHeight <= 0) return@BoxWithConstraints
        val textWidth = Modifier.width(maxWidth * CIRCLE_DISC_TEXT_WIDTH_FRACTION)
        if (spec.primaryRole == CircleTextRole.NUMBER) {
            CircleReading(spec.primaryValue, spec.unit, spec.primaryColor,
                modifier = textWidth, unitColor = spec.unitColor, textAlign = TextAlign.Center)
        } else {
            require(spec.unit == null) { "A unit belongs to a NUMBER reading" }
            CircleText(spec.primaryValue, spec.primaryRole, spec.primaryColor,
                modifier = textWidth, textAlign = TextAlign.Center)
        }
        spec.secondaryLabel?.let { secondary ->
            CircleText(text = secondary.text, role = CircleTextRole.NOTE, color = secondary.color,
                textAlign = TextAlign.Center,
                modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth(0.72f).padding(bottom = 4.dp))
        }
    }
}

/** Passive wrapper for a value instrument; contains no tap or progress channel. */
@Composable
fun CircleInstrumentDisc(
    spec: CircleDiscArtworkSpec,
    contentDescription: String,
    modifier: Modifier = Modifier,
    diameter: Dp = MenuDesign.backDiameter,
) {
    CircleDiscArtwork(
        spec = spec,
        modifier = modifier
            .size(diameter)
            .semantics { this.contentDescription = contentDescription },
    )
}

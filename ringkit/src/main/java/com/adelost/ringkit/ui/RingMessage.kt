package com.adelost.ringkit.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Text
import com.adelost.designkit.ui.CircleAccent
import com.adelost.designkit.ui.CircleAccentStrength
import com.adelost.designkit.ui.CircleSurfaceClass
import com.adelost.designkit.ui.circleAccentColor
import com.adelost.designkit.ui.LocalCircleSurfaceLayout
import com.adelost.designkit.ui.RingTokens

/** Which side of the thread a message belongs to; the reader's own words sit inset from the start. */
enum class RingMessageSide { START, END }

/**
 * Readable prose: no uppercase transform, shrink-to-fit or silent truncation.
 * An [accent] names the sender in its author label and a thin start edge, never as a fill behind text,
 * so OLED black stays black and senders stay apart in greyscale through [side] and the edge.
 */
data class RingMessageSpec(
    val author: String,
    val body: String,
    val status: String = "",
    val accent: CircleAccent? = null,
    val side: RingMessageSide = RingMessageSide.START,
)

/** Resolved pigments and inset for one message; pure so both hosts share the exact rule. */
data class RingMessageLayout(val authorColor: Color, val edgeColor: Color?, val startInsetDp: Int)

fun ringMessageLayout(spec: RingMessageSpec, round: Boolean): RingMessageLayout = RingMessageLayout(
    authorColor = spec.accent?.let { circleAccentColor(it, CircleAccentStrength.ACTIVE) } ?: RingTokens.Dim,
    edgeColor = spec.accent?.let { circleAccentColor(it, CircleAccentStrength.SUPPORTING) },
    startInsetDp = if (spec.side == RingMessageSide.END) (if (round) 16 else 48) else 0,
)

@Composable
fun RingMessage(spec: RingMessageSpec, modifier: Modifier = Modifier) {
    val round = LocalCircleSurfaceLayout.current.surfaceClass == CircleSurfaceClass.ROUND
    val layout = ringMessageLayout(spec, round)
    Column(modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth().padding(start = layout.startInsetDp.dp).height(IntrinsicSize.Min)) {
            layout.edgeColor?.let { edge ->
                Box(Modifier.padding(vertical = 12.dp).width(2.dp).fillMaxHeight().background(edge))
            }
            Column(
                modifier = Modifier.fillMaxWidth()
                    .padding(start = if (layout.edgeColor != null) 10.dp else 0.dp)
                    .padding(vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                if (spec.author.isNotBlank()) Text(
                    text = spec.author,
                    color = layout.authorColor,
                    fontSize = if (round) 10.sp else 12.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                SelectionContainer {
                    Text(
                        text = spec.body,
                        color = RingTokens.Ink,
                        fontSize = if (round) 13.sp else 16.sp,
                        lineHeight = if (round) 18.sp else 24.sp,
                    )
                }
                if (spec.status.isNotBlank()) {
                    Text(text = spec.status, color = RingTokens.Dim, fontSize = if (round) 10.sp else 12.sp)
                }
            }
        }
        Box(Modifier.padding(top = 8.dp).fillMaxWidth().height(0.5.dp).background(RingTokens.Outline))
    }
}

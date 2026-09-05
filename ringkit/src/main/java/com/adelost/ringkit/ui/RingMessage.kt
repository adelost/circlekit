package com.adelost.ringkit.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Text
import com.adelost.designkit.ui.CircleSurfaceClass
import com.adelost.designkit.ui.LocalCircleSurfaceLayout
import com.adelost.designkit.ui.RingTokens

/** Readable prose: no uppercase transform, shrink-to-fit or silent truncation. */
data class RingMessageSpec(val author: String, val body: String, val status: String = "")

@Composable
fun RingMessage(spec: RingMessageSpec, modifier: Modifier = Modifier) {
    val round = LocalCircleSurfaceLayout.current.surfaceClass == CircleSurfaceClass.ROUND
    Column(
        modifier = modifier.fillMaxWidth().padding(vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (spec.author.isNotBlank()) Text(
            text = spec.author,
            color = RingTokens.Dim,
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
        Box(Modifier.padding(top = 8.dp).fillMaxWidth().height(0.5.dp).background(RingTokens.Outline))
    }
}

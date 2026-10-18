package com.adelost.designkit.ui

import android.graphics.Paint
import android.graphics.Typeface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalFontFamilyResolver

/** Native Canvas consumes the same resolved face and role metrics as Compose text. */
@Composable
fun rememberCircleRolePaint(role: CircleTextRole, color: Color, content: CircleTextContent = CircleWords("")): Paint {
    val style = circleRoleTextStyle(role, color, content = content)
    val density = LocalDensity.current
    val resolvedFace = LocalFontFamilyResolver.current.resolve(
        requireNotNull(style.fontFamily), requireNotNull(style.fontWeight)).value as Typeface
    // A variable font's resolved native family can still carry Regular weight.
    val face = Typeface.create(resolvedFace, requireNotNull(style.fontWeight).weight, false)
    return remember(style, density, face) {
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color.toArgb()
            typeface = face
            textSize = with(density) { style.fontSize.toPx() }
            letterSpacing = with(density) { style.letterSpacing.toPx() } / textSize
        }
    }
}

package com.adelost.designkit.ui

import androidx.compose.runtime.compositionLocalOf

/**
 * Whether chrome on this surface is drawn over imagery the app does not
 * control — satellite tiles, relief, a lit 3D ground.
 *
 * Chrome rests transparent on purpose: over the black face that keeps the
 * scene visible through the button. Over a bright tile the same transparency
 * leaves a light ring and a light glyph on a light background, and the control
 * disappears (Mattias 2026-07-27: +/- and home nearly invisible on the phone
 * map). Legibility is a property of the SURFACE, not of each call site, so the
 * layer that draws imagery declares it once and every chrome atom reads it.
 *
 * False by default: a surface that paints its own dark face reserves nothing.
 */
val LocalChromeOverImagery = compositionLocalOf { false }

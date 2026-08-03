package com.adelost.designkit.ui

import androidx.compose.foundation.background
import androidx.compose.ui.Modifier

/**
 * THE canvas. Every Circle surface — instrument, menu, detail — is drawn on
 * true black.
 *
 * There used to be a CARBON menu theme on the graphite canvas, and it was the
 * default, so menus rendered grey while the instrument stayed black (Mattias
 * 2026-07-21: "du kan ta bort graphite tema.. vi kör oled"). The theme enum,
 * its setting and its composition local are gone rather than defaulted to
 * OLED: a second canvas colour can no longer be selected, persisted or
 * accidentally provided.
 *
 * The two modifier names below stay because they say WHICH surface a caller
 * is painting; they are aliases of one decision and cannot diverge.
 */
private val CIRCLE_CANVAS = CircleStyleTokens.Surface

fun Modifier.circleMenuCanvas(): Modifier = background(CIRCLE_CANVAS)

fun Modifier.circleInstrumentCanvas(): Modifier = background(CIRCLE_CANVAS)

/** Callers that need the pigment itself rather than a background modifier. */
fun circleCanvasColor() = CIRCLE_CANVAS

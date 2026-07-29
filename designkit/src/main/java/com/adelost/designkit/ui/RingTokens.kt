package com.adelost.designkit.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Shared surface-family colours. Round instruments own health semantics;
 * rectangular companions reuse the neutral graphite/ink/accent primitives
 * without pretending every surface is a status ring.
 */
object RingTokens {
    // Health remains an explicit instrument semantic, and its pigments come
    // from the same Cinematic Graphite ladder as the neutral surfaces.
    val Fresh = GraphiteTokens.Green
    val Aging = GraphiteTokens.Orange
    val Broken = GraphiteTokens.Red
    val Off = GraphiteTokens.Faint.copy(alpha = 0.45f)

    // Neutral menu surfaces intentionally alias Graphite rather than carrying
    // a second near-black/cyan palette. Form factor changes; brand does not.
    val NeutralRing = GraphiteTokens.Faint.copy(alpha = 0.42f)
    // Outline language (Mattias 2026-07-15): controls are CONTOURS on the
    // black disc — no filled slabs. Resting chrome is a faint ink line;
    // the selected/active contour steps up to full ink.
    val Outline = GraphiteTokens.Ink.copy(alpha = 0.30f)
    val OutlineStrong = GraphiteTokens.Ink.copy(alpha = 0.85f)
    // Fills stay transparent in the outline language; tokens kept for the
    // hold-sweep feedback and any surface that genuinely needs a slab.
    val TileFill = GraphiteTokens.Surface
    val ButtonFill = GraphiteTokens.SurfaceStrong
    val Ink = GraphiteTokens.Ink
    val Dim = GraphiteTokens.Muted
    val Accent = GraphiteTokens.Primary

    // Data-driven progress is still part of the outline language. A black
    // translucent disc separates the ring from map imagery while remaining
    // optically black on the OLED face. The resting track must stay dimmer
    // than the full-ink arc; equal-strength whites turn progress into a
    // visually static circle.
    val ProgressSurface = Color.Black.copy(alpha = 0.72f)
    val ProgressTrack = Outline
    val ProgressArc = Ink
}

/** Shared geometry for the Graphite icon-ring language across app surfaces. */
object RingMetrics {
    val StrokeWidth = 2.5.dp

    /** Icon share of its ring, pinned to the approved start-screen proportion
     * (PhoneSurfaceDesign action: 24dp icon in a 56dp ring). Menu launchers
     * must read as the SAME atom as the home buttons (Mattias 2026-07-21). */
    const val IconFraction = 0.43f

    /** Stat rings share the circle with a value line, so the icon yields. */
    const val StatIconFraction = 0.34f
}

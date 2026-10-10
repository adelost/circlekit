package com.adelost.designkit.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

/**
 * The one window a Circle product opens over its surface: a dialog, drawn at the surface's own scale.
 *
 * A new window is a new Compose owner, and an owner gives its content the platform's density. A host's face scale
 * lives in the density it gives the product (WatchExact: density x face / 192; Mattias 2026-07-18: "större klocka =
 * större knappar, samma relativa storlekar"), so a plain Dialog over a 320 dp face drew a menu at 60 % of the page
 * under it (Skyvw, Mattias 2026-10-09: "Varför ändras storleken enormt mycket när man går in i settings versus när
 * man är i kartläget?"). The density where the window is opened is not the answer either: a component that scales
 * its own subtree, such as the phone's dial in a [CircleComponentViewport], is not the surface a window covers, and
 * a window opened from inside that dial covered the phone at twice its scale.
 *
 * So every host records its surface's density through [ProvideCircleSurfaceDensity], and this window gives its
 * content that one. It covers the whole window edge to edge, and back dismisses it.
 */
@Composable
fun CircleWindow(onDismissRequest: () -> Unit, content: @Composable () -> Unit) {
    val surfaceDensity = LocalCircleSurfaceDensity.current
    Dialog(
        onDismissRequest = onDismissRequest,
        properties = DialogProperties(
            dismissOnBackPress = true,
            dismissOnClickOutside = false,
            usePlatformDefaultWidth = false,
            decorFitsSystemWindows = false,
        ),
    ) {
        // Outside a host nothing is scaled, so the window's own density is the surface's.
        if (surfaceDensity == null) content() else ProvideCircleSurfaceDensity(surfaceDensity, content)
    }
}

/**
 * Gives a host's product tree [density] and records it as the surface's, so a [CircleWindow] over the tree draws at
 * the same scale. Every host and the window provide the density through this one call, which keeps the two equal.
 */
@Composable
internal fun ProvideCircleSurfaceDensity(density: Density, content: @Composable () -> Unit) {
    CompositionLocalProvider(
        LocalDensity provides density,
        LocalCircleSurfaceDensity provides density,
        content = content,
    )
}

/** The density a host gave its product tree, null outside a host. Only [CircleWindow] reads it. */
private val LocalCircleSurfaceDensity = staticCompositionLocalOf<Density?> { null }

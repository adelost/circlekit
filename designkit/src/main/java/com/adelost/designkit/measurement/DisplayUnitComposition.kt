package com.adelost.designkit.measurement

import androidx.compose.runtime.staticCompositionLocalOf

/**
 * One declarative unit policy for the complete route tree. Metric is the
 * legacy fallback for previews/tests that deliberately mount a component in
 * isolation without an app settings provider.
 */
val LocalDisplayUnits = staticCompositionLocalOf { DisplayUnitPreferences() }

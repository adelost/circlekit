package com.adelost.designkit.ui

import android.content.Context
import android.content.pm.ActivityInfo
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.movableContentOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp

/** The only two host presentations a rectangular device may select. */
enum class CircleHostMode(val optionLabel: String) {
    RESPONSIVE("RESPONSIVE"),
    WATCH_EXACT("WATCH EXACT"),
}

/** System rotation is available to ordinary Phone hosts; fixed angles are the shared DEV seam. */
enum class CircleHostOrientation(val optionLabel: String) {
    SYSTEM("SYSTEM"),
    DEG_0("0°"),
    DEG_90("90°"),
    DEG_180("180°"),
    DEG_270("270°"),
}

data class CircleHostPreviewState(
    val mode: CircleHostMode = CircleHostMode.RESPONSIVE,
    val watchDiameterDp: Float = CIRCLE_WATCH_PREVIEW_BASELINE_DP,
    val orientation: CircleHostOrientation = CircleHostOrientation.SYSTEM,
) {
    init {
        require(watchDiameterDp in CIRCLE_WATCH_PREVIEW_DIAMETERS_DP) {
            "Watch preview diameter must be one of $CIRCLE_WATCH_PREVIEW_DIAMETERS_DP"
        }
    }
}

const val CIRCLE_WATCH_PREVIEW_BASELINE_DP = 192f

val CIRCLE_WATCH_PREVIEW_DIAMETERS_DP: List<Float> =
    listOf(192f, 216f, 240f, 280f, 320f, 360f, 400f)

/** The round renderer's canonical container, never the rectangular host device. */
val LocalCircleFaceShortSideDp = staticCompositionLocalOf { CIRCLE_WATCH_PREVIEW_BASELINE_DP }

fun supportedCircleWatchDiameter(requestedDp: Float): Float =
    CIRCLE_WATCH_PREVIEW_DIAMETERS_DP.firstOrNull { it == requestedDp }
        ?: CIRCLE_WATCH_PREVIEW_BASELINE_DP

fun circleWatchDiameterInBounds(requestedDp: Float, availableDp: Float): Float {
    require(requestedDp > 0f && requestedDp.isFinite())
    require(availableDp > 0f && availableDp.isFinite())
    return requestedDp.coerceAtMost(availableDp)
}

/** Hardware wins over prefs and QA: real Wear can never mount Phone chrome. */
fun resolveCircleHostMode(
    isWatchDevice: Boolean,
    requested: String?,
    persisted: CircleHostMode = CircleHostMode.RESPONSIVE,
): CircleHostMode {
    if (isWatchDevice) return CircleHostMode.WATCH_EXACT
    return when (requested?.trim()?.uppercase()) {
        "WATCH", "WATCH_EXACT" -> CircleHostMode.WATCH_EXACT
        "PHONE", "PHONE_RESPONSIVE", "RESPONSIVE" -> CircleHostMode.RESPONSIVE
        else -> persisted
    }
}

fun requestedOrientationFor(orientation: CircleHostOrientation): Int = when (orientation) {
    CircleHostOrientation.SYSTEM -> ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
    CircleHostOrientation.DEG_0 -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
    CircleHostOrientation.DEG_90 -> ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
    CircleHostOrientation.DEG_180 -> ActivityInfo.SCREEN_ORIENTATION_REVERSE_PORTRAIT
    CircleHostOrientation.DEG_270 -> ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE
}

/**
 * One host seam for every Circle product. The content lambda is mounted once
 * from product state; this function changes only constraints, profile and
 * round clipping. WatchExact on Phone therefore is the real Wear surface, not
 * a preview-only renderer.
 */
@Composable
fun CircleHostSurface(
    isWatchDevice: Boolean,
    state: CircleHostPreviewState,
    onStateChange: ((CircleHostPreviewState) -> Unit)?,
    modifier: Modifier = Modifier,
    content: @Composable (CircleUiProfile) -> Unit,
) {
    // Responsive and WatchExact have different parents, but the product tree
    // is one movable composition. A plain call in each when-branch remounts
    // every remember below it and resets navigation when DEV changes host.
    val currentContent by rememberUpdatedState(content)
    val movableContent = remember {
        movableContentOf<CircleUiProfile> { profile -> currentContent(profile) }
    }
    when (resolveCircleHostMode(isWatchDevice, requested = null, persisted = state.mode)) {
        CircleHostMode.RESPONSIVE -> CircleResponsiveSurface(modifier, movableContent)
        CircleHostMode.WATCH_EXACT -> CircleWatchExactSurface(
            emulatedDiameterDp = state.watchDiameterDp.takeUnless { isWatchDevice },
            onSelectDiameter = onStateChange?.takeUnless { isWatchDevice }?.let { update ->
                { diameter -> update(state.copy(watchDiameterDp = supportedCircleWatchDiameter(diameter))) }
            },
            onSelectResponsive = onStateChange?.takeUnless { isWatchDevice }?.let { update ->
                { update(state.copy(mode = CircleHostMode.RESPONSIVE)) }
            },
            modifier = modifier,
            content = movableContent,
        )
    }
}

@Composable
private fun CircleWatchExactSurface(
    emulatedDiameterDp: Float?,
    onSelectDiameter: ((Float) -> Unit)?,
    onSelectResponsive: (() -> Unit)?,
    modifier: Modifier,
    content: @Composable (CircleUiProfile) -> Unit,
) {
    BoxWithConstraints(
        modifier = modifier.fillMaxSize().background(Color.Black),
        contentAlignment = Alignment.Center,
    ) {
        val availableSide = minOf(maxWidth, maxHeight)
        val faceSide = emulatedDiameterDp?.let {
            circleWatchDiameterInBounds(it, availableSide.value).dp
        } ?: availableSide
        val canonScale = faceSide.value / CircleUiProfiles.CANON_ROUND_CANVAS_DP
        val hostDensity = LocalDensity.current
        Box(Modifier.size(faceSide).clip(CircleShape)) {
            CompositionLocalProvider(
                LocalDensity provides Density(
                    density = hostDensity.density * canonScale,
                    fontScale = hostDensity.fontScale,
                ),
                LocalCircleSurfaceLayout provides resolveCircleSurfaceLayout(
                    shortSideDp = CircleUiProfiles.CANON_ROUND_CANVAS_DP,
                    round = true,
                ),
                LocalCircleFaceShortSideDp provides CircleUiProfiles.CANON_ROUND_CANVAS_DP,
            ) {
                content(CircleUiProfiles.WatchCanonical)
            }
        }
        if (
            emulatedDiameterDp != null &&
            onSelectDiameter != null &&
            onSelectResponsive != null
        ) {
            CircleWatchPreviewSelector(
                selectedDp = emulatedDiameterDp,
                onSelect = onSelectDiameter,
                onSelectResponsive = onSelectResponsive,
                modifier = Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(bottom = 8.dp),
            )
        }
    }
}

/** Phone-only QA chrome; it is outside the scaled watch canvas. */
@Composable
private fun CircleWatchPreviewSelector(
    selectedDp: Float,
    onSelect: (Float) -> Unit,
    onSelectResponsive: () -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyRow(
        modifier = modifier.fillMaxWidth(),
        contentPadding = PaddingValues(horizontal = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
    ) {
        item(key = "responsive") {
            CircleValueDisc(
                value = "AUTO",
                contentDescription = "Return to responsive phone layout",
                actionLabel = "AUTO SIZE",
                onTap = onSelectResponsive,
                timing = CircleActionTiming.IMMEDIATE,
            )
        }
        items(CIRCLE_WATCH_PREVIEW_DIAMETERS_DP, key = { it }) { diameterDp ->
            CircleValueDisc(
                value = diameterDp.toInt().toString(),
                contentDescription = "Preview ${diameterDp.toInt()} dp watch viewport",
                actionLabel = "${diameterDp.toInt()} DP FACE",
                onTap = { onSelect(diameterDp) },
                active = diameterDp == selectedDp,
                timing = CircleActionTiming.IMMEDIATE,
            )
        }
    }
}

/** Small shared persistence adapter for DEV host presentation only. */
class CircleHostPreviewPreferences(
    context: Context,
    productId: String,
    private val defaultOrientation: CircleHostOrientation = CircleHostOrientation.SYSTEM,
) {
    private val prefs = context.applicationContext.getSharedPreferences(
        "circlekit_host_preview_v1_$productId",
        Context.MODE_PRIVATE,
    )

    fun load(): CircleHostPreviewState = CircleHostPreviewState(
        mode = prefs.getString(KEY_MODE, null)
            ?.let { stored -> CircleHostMode.entries.firstOrNull { it.name == stored } }
            ?: CircleHostMode.RESPONSIVE,
        watchDiameterDp = supportedCircleWatchDiameter(
            prefs.getFloat(KEY_DIAMETER, CIRCLE_WATCH_PREVIEW_BASELINE_DP),
        ),
        orientation = prefs.getString(KEY_ORIENTATION, null)
            ?.let { stored -> CircleHostOrientation.entries.firstOrNull { it.name == stored } }
            ?: defaultOrientation,
    )

    fun save(state: CircleHostPreviewState) {
        prefs.edit()
            .putString(KEY_MODE, state.mode.name)
            .putFloat(KEY_DIAMETER, state.watchDiameterDp)
            .putString(KEY_ORIENTATION, state.orientation.name)
            .apply()
    }

    private companion object {
        const val KEY_MODE = "mode"
        const val KEY_DIAMETER = "watch_diameter_dp"
        const val KEY_ORIENTATION = "orientation"
    }
}

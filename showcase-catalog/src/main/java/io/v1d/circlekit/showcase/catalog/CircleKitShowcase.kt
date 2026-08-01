package io.v1d.circlekit.showcase.catalog

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.adelost.designkit.ui.CircleActionTiming
import com.adelost.designkit.ui.CircleChromeSlot
import com.adelost.designkit.ui.CircleColorSchemeProvider
import com.adelost.designkit.ui.CircleColorTheme
import com.adelost.designkit.ui.CircleIconDisc
import com.adelost.designkit.ui.CircleSurfaceClass
import com.adelost.designkit.ui.LocalCircleSurfaceLayout
import com.adelost.designkit.ui.LocalRoundChromeReservation
import com.adelost.designkit.ui.MenuDesign
import com.adelost.designkit.ui.RadialChromeDesign
import com.adelost.designkit.ui.RingIcons
import com.adelost.ringkit.ui.RenderRingScreen
import com.adelost.ringkit.ui.RingNavigator
import kotlin.math.cos
import kotlin.math.sin

@Composable
fun CircleKitShowcase(
    session: ShowcaseSession,
    onExit: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val destination by session.destination.collectAsState()
    val surface = LocalCircleSurfaceLayout.current.surfaceClass
    val reservedChrome = remember(destination) { ShowcaseScreens.reservedChrome(destination) }
    val selectedTheme = destination.colorTheme()

    SideEffect { session.setSurface(surface.name) }

    CircleColorSchemeProvider(selectedTheme) {
        CompositionLocalProvider(LocalRoundChromeReservation provides reservedChrome) {
            Box(modifier.fillMaxSize()) {
                val rootNavigator = remember(session) { RingNavigator(ShowcaseScreens.root(session)) }
                val selectedNavigator = if (destination.isRoot) {
                    null
                } else {
                    remember(destination) {
                        RingNavigator(ShowcaseScreens.selected(destination, session))
                    }
                }
                val navigator = selectedNavigator ?: rootNavigator
                val navigateBack = remember(navigator, destination, onExit) {
                    {
                        when {
                            navigator.back() -> true
                            !destination.isRoot -> {
                                session.closeSelection()
                                true
                            }
                            else -> false
                        }
                    }
                }

                DisposableEffect(session, navigateBack) {
                    session.attachNavigationBack(navigateBack)
                    onDispose { session.attachNavigationBack(null) }
                }

                RenderRingScreen(
                    nav = navigator,
                    onExit = { if (!navigateBack()) onExit() },
                )

                if (surface == CircleSurfaceClass.ROUND) {
                    RoundShowcaseChrome(
                        slots = reservedChrome,
                        onBack = { if (!navigateBack()) onExit() },
                    )
                }
            }
        }
    }
}

@Composable
private fun RoundShowcaseChrome(
    slots: List<CircleChromeSlot>,
    onBack: () -> Unit,
) {
    BoxWithConstraints(Modifier.fillMaxSize()) {
        slots.forEach { slot ->
            val diameter = MenuDesign.watchActionRingDiameter
            val radius = minOf(maxWidth.value, maxHeight.value) / 2f * RadialChromeDesign.slotRadiusFraction
            val angle = Math.toRadians(slot.angleFromTopDeg.toDouble())
            val x = maxWidth.value / 2f + radius * sin(angle).toFloat() - diameter.value / 2f
            val y = maxHeight.value / 2f - radius * cos(angle).toFloat() - diameter.value / 2f
            val isBack = slot == CircleChromeSlot.HOUR_9
            CircleIconDisc(
                icon = if (isBack) RingIcons.Cross else RingIcons.Gear,
                contentDescription = if (isBack) "Back" else "Chrome reservation",
                actionLabel = if (isBack) "BACK" else "GEAR",
                onTap = if (isBack) onBack else ({ }),
                diameter = diameter,
                timing = CircleActionTiming.DELIBERATE,
                modifier = Modifier.offset(x.dp, y.dp),
            )
        }
    }
}

private fun ShowcaseDestination.colorTheme(): CircleColorTheme = when (scenarioId?.value) {
    "flat-cyan" -> CircleColorTheme.CYAN
    "muted" -> CircleColorTheme.STEEL
    "high-contrast" -> CircleColorTheme.VIOLET
    else -> CircleColorTheme.SEA_GLASS
}

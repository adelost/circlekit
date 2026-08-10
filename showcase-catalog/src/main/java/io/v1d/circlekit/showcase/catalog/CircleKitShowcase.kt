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
import com.adelost.ringkit.ui.RingActionCueHost
import com.adelost.ringkit.ui.RingNavigator
import com.adelost.ringkit.ui.RingTextEntryPort
import kotlin.math.cos
import kotlin.math.sin

@Composable
fun CircleKitShowcase(
    session: ShowcaseSession,
    onExit: () -> Unit,
    devPort: ShowcaseDevPort? = null,
    rootNavigator: RingNavigator = remember(session, devPort) {
        RingNavigator(ShowcaseScreens.root(session, devPort))
    },
    textEntryPort: RingTextEntryPort? = null,
    modifier: Modifier = Modifier,
) {
    val destination by session.destination.collectAsState()
    // CircleKitShowcase is the registered page host: this is the actual
    // navigation.activePage -> page.host.activePage consumption.
    val activePage by session.activePage.collectAsState()
    val surface = LocalCircleSurfaceLayout.current.surfaceClass
    val reservedChrome = remember(destination) { ShowcaseScreens.reservedChrome(destination) }
    val selectedTheme = destination.colorTheme()

    SideEffect {
        session.setSurface(surface.name)
        require(ShowcaseNativeBindings.navigationArtifacts.single {
            it.artifactRef == session.artifactProfile.id
        }.pages.any { it.pageRef == activePage })
    }

    CircleColorSchemeProvider(selectedTheme) {
        CompositionLocalProvider(LocalRoundChromeReservation provides reservedChrome) {
            RingActionCueHost(modifier = modifier) {
                Box(Modifier.fillMaxSize()) {
                    val presentation = if (destination.isRoot) {
                        null
                    } else {
                        remember(destination, surface, textEntryPort) {
                            ShowcasePresentations.selected(destination, session, surface, textEntryPort)
                        }
                    }
                    val selectedNavigator = (presentation as? ShowcasePresentation.Screen)?.let { selected ->
                        remember(destination, selected.value) { RingNavigator(selected.value) }
                    }
                    val navigateBack = remember(rootNavigator, selectedNavigator, destination, onExit) {
                        {
                            when {
                                selectedNavigator?.back() == true -> true
                                !destination.isRoot -> {
                                    session.closeSelection()
                                    true
                                }
                                session.backPage(rootNavigator::back) -> true
                                else -> false
                            }
                        }
                    }

                    DisposableEffect(session, navigateBack) {
                        session.attachNavigationBack(navigateBack)
                        onDispose { session.attachNavigationBack(null) }
                    }

                    when (presentation) {
                        null -> RenderRingScreen(
                            nav = rootNavigator,
                            onExit = { if (!navigateBack()) onExit() },
                        )
                        is ShowcasePresentation.Screen -> RenderRingScreen(
                            nav = requireNotNull(selectedNavigator),
                            onExit = { if (!navigateBack()) onExit() },
                        )
                        is ShowcasePresentation.Component -> ShowcasePresentations.ComponentPreview(
                            destination = destination,
                            kind = presentation.kind,
                            state = session.media,
                            surface = surface,
                            onBack = { if (!navigateBack()) onExit() },
                        )
                    }

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

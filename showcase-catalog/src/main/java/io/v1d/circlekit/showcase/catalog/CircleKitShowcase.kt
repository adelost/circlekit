package io.v1d.circlekit.showcase.catalog

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import com.adelost.designkit.ui.CircleChromeSlot
import com.adelost.designkit.ui.CircleColorSchemeProvider
import com.adelost.designkit.ui.CircleColorTheme
import com.adelost.designkit.ui.CircleSurfaceClass
import com.adelost.designkit.ui.LocalCircleSurfaceLayout
import com.adelost.designkit.ui.LocalRoundChromeReservation
import com.adelost.designkit.ui.RingIcons
import com.adelost.ringkit.ui.RenderRingScreen
import com.adelost.ringkit.ui.RingActionCueHost
import com.adelost.ringkit.ui.RingNavigator
import com.adelost.ringkit.ui.RingTextEntryPort
import com.adelost.ringkit.ui.RingRoundChrome
import com.adelost.ringkit.ui.RingChromeAction

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
                            backLabel = "Back",
                        )
                        is ShowcasePresentation.Screen -> RenderRingScreen(
                            nav = requireNotNull(selectedNavigator),
                            onExit = { if (!navigateBack()) onExit() },
                            backLabel = "Back",
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
    RingRoundChrome(slots.map { slot ->
        val isBack = slot == CircleChromeSlot.HOUR_9
        RingChromeAction(slot, if (isBack) RingIcons.Cross else RingIcons.Gear,
            if (isBack) "Back" else "Chrome reservation", if (isBack) onBack else ({ }))
    })
}

private fun ShowcaseDestination.colorTheme(): CircleColorTheme = when (scenarioId?.value) {
    "flat-cyan" -> CircleColorTheme.CYAN
    "muted" -> CircleColorTheme.STEEL
    "high-contrast" -> CircleColorTheme.VIOLET
    else -> CircleColorTheme.SEA_GLASS
}

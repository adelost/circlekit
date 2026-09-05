package io.v1d.circlekit.showcase.catalog

import com.adelost.designkit.ui.CircleAccent
import com.adelost.designkit.ui.CircleActionTiming
import com.adelost.designkit.ui.CircleChromeSlot
import com.adelost.designkit.ui.CircleColorSchemes
import com.adelost.designkit.ui.CircleColorTheme
import com.adelost.designkit.ui.CircleSurfaceClass
import com.adelost.designkit.ui.CircleUiProfiles
import com.adelost.designkit.ui.MenuGridRole
import com.adelost.designkit.ui.RingIcons
import com.adelost.designkit.ui.roundSafeInsetDp
import com.adelost.designkit.ui.resolveCircleSurfaceLayout
import androidx.compose.ui.graphics.toArgb
import com.adelost.ringkit.ui.LaunchSpec
import com.adelost.ringkit.ui.RingScreen
import com.adelost.ringkit.ui.RowSpec
import com.adelost.releasekit.ui.releaseUpdateScreen
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map

object ShowcaseScreens {
    fun root(session: ShowcaseSession, dev: ShowcaseDevPort? = null): RingScreen = RingScreen.Launcher(
        title = "CIRCLEKIT",
        gridRole = MenuGridRole.COMPONENT_GALLERY,
        entries = ShowcaseNativeBindings.navigationArtifacts.single {
            it.artifactRef == session.artifactProfile.id
        }.pages.mapNotNull { page ->
            val screen = page.pageRef
            val family = ShowcaseFamily.entries.singleOrNull { screen == "section.${it.id}" } ?: return@mapNotNull null
            LaunchSpec(
                icon = ShowcaseNativeBindings.requireIcon(family.iconId),
                label = family.menuLabel,
                semanticColor = androidx.compose.ui.graphics.Color(family.categoryArgb),
                open = {
                    check(session.route(screen))
                    familyScreen(screen, family, session)
                },
            )
        } + listOfNotNull(
            dev?.let { port ->
                LaunchSpec(RingIcons.Download, "APP UPDATE", open = { releaseUpdateScreen(port.update) })
            },
            dev?.let { port ->
                LaunchSpec(RingIcons.Wrench, "DEV", open = { ShowcaseDevScreens.root(port) })
            },
        ),
    )

    fun selectedScreen(
        destination: ShowcaseDestination,
        session: ShowcaseSession,
    ): RingScreen {
        val pair = ShowcaseManifest.find(
            requireNotNull(destination.caseId),
            requireNotNull(destination.scenarioId),
        ) ?: error("Showcase destination was validated before selection")
        return when (ShowcaseNativeBindings.requireComponent(pair.first.id.value).renderer) {
            ShowcaseNativeRenderer.COLORS -> colors(pair.second)
            ShowcaseNativeRenderer.GEOMETRY -> geometry(pair.second)
            ShowcaseNativeRenderer.ICON_ACTIONS -> iconActions(pair.second, session)
            ShowcaseNativeRenderer.ACTION_ROWS -> ShowcaseInteractionScreens.actionRows(pair.second, session.interaction)
            ShowcaseNativeRenderer.CHOICE_ROWS -> ShowcaseInteractionScreens.choiceRows(pair.second, session.interaction)
            ShowcaseNativeRenderer.ADJUSTMENT -> ShowcaseInteractionScreens.adjustmentRows(pair.second, session.interaction)
            ShowcaseNativeRenderer.PROGRESS -> ShowcaseInteractionScreens.progressRows(pair.second, session.interaction)
            ShowcaseNativeRenderer.SCREEN_TEMPLATES -> ShowcaseTemplateFixtures.screen(pair.second, session)
            ShowcaseNativeRenderer.SOURCE -> ShowcaseFlowScreens.source(session.flows)
            ShowcaseNativeRenderer.UPDATE -> ShowcaseFlowScreens.update(session.flows)
            ShowcaseNativeRenderer.SERVICE -> ShowcaseFlowScreens.service(session.flows)
            ShowcaseNativeRenderer.PRESS,
            ShowcaseNativeRenderer.TEXT,
            ShowcaseNativeRenderer.CAPTURE,
            ShowcaseNativeRenderer.PLAYBACK,
            ShowcaseNativeRenderer.PAGE_HOST,
            ShowcaseNativeRenderer.PAGE_MENU,
            -> error("Component renderer ${pair.first.id.value} is not a RingScreen")
        }
    }

    internal fun familyScreen(
        screen: String,
        family: ShowcaseFamily,
        session: ShowcaseSession,
    ): RingScreen {
        val cases = ShowcaseCatalogRuntime.componentIds(session.artifactProfile.id, screen).map { componentId ->
            requireNotNull(ShowcaseCatalogRuntime.find(ShowcaseCaseId(componentId)))
        }
        if (cases.size == 1) return scenarios(cases.single(), session)
        return RingScreen.Launcher(
        title = family.title,
        gridRole = MenuGridRole.COMPONENT_GALLERY,
        entries = cases.map { case ->
            LaunchSpec(
                icon = ShowcaseNativeBindings.requireIcon(case.iconId),
                label = case.title,
                semanticColor = androidx.compose.ui.graphics.Color(case.family.categoryArgb),
                open = { scenarios(case, session) },
            )
        },
    )
    }

    fun reservedChrome(destination: ShowcaseDestination): List<CircleChromeSlot> = buildList {
        add(CircleChromeSlot.HOUR_9)
        if (
            destination.caseId?.value == "foundation.geometry" &&
            destination.scenarioId?.value == "chrome-x-gear"
        ) {
            add(CircleChromeSlot.HOUR_8)
        }
    }

    internal fun scenarios(case: ShowcaseCase, session: ShowcaseSession): RingScreen = RingScreen.Rows(
        title = case.title,
        items = flowOf(
            listOf(RowSpec("demo-purpose", "TRY THIS", case.purpose, icon = null)) + case.scenarios.map { scenario ->
                RowSpec(
                    key = "${case.id.value}/${scenario.id.value}",
                    title = scenario.label,
                    sub = scenario.description,
                    icon = ShowcaseNativeBindings.requireIcon(case.iconId),
                    semanticColor = androidx.compose.ui.graphics.Color(case.family.categoryArgb),
                    onTap = { session.open(case.id, scenario.id) },
                    multiline = true,
                )
            },
        ),
    )

    private fun colors(scenario: ShowcaseScenario): RingScreen {
        val theme = when (scenario.id.value) {
            "sea-glass" -> CircleColorTheme.SEA_GLASS
            "flat-cyan" -> CircleColorTheme.CYAN
            "muted" -> CircleColorTheme.STEEL
            "high-contrast" -> CircleColorTheme.VIOLET
            else -> error("Unknown color scenario ${scenario.id.value}")
        }
        val scheme = CircleColorSchemes.resolve(theme)
        return RingScreen.Rows(
            title = theme.optionLabel,
            items = flowOf(
                listOf(
                    colorRow("surface", "OLED BACKGROUND", com.adelost.designkit.ui.CircleStyleTokens.Surface),
                    colorRow("action", "ACTIONS + TEXT", com.adelost.designkit.ui.CircleStyleTokens.Action),
                    colorRow("muted-text", "SUPPORTING TEXT", com.adelost.designkit.ui.CircleStyleTokens.ActionMuted),
                    colorRow("highlight", "HIGHLIGHT", scheme.highlight),
                    colorRow("active", "ACTIVE", scheme.active),
                    colorRow("supporting", "SUPPORT", scheme.supporting),
                    colorRow("container", "CONTAINER", scheme.container),
                    colorRow("subdued", "SUBDUED", scheme.subdued),
                ),
            ),
        )
    }

    private fun colorRow(key: String, title: String, color: androidx.compose.ui.graphics.Color) = RowSpec(
        key = key,
        title = title,
        sub = color.toHexArgb(),
        icon = RingIcons.Palette,
        semanticColor = color,
    )

    private fun geometry(scenario: ShowcaseScenario): RingScreen {
        val rows = when (scenario.id.value) {
            "round-192" -> surfaceRows(
                resolveCircleSurfaceLayout(CircleUiProfiles.CANON_ROUND_CANVAS_DP, round = true),
                "192 DP ROUND",
            )
            "phone-compact" -> surfaceRows(resolveCircleSurfaceLayout(390f, 844f, round = false), "390 × 844")
            "phone-wide" -> surfaceRows(resolveCircleSurfaceLayout(1280f, 800f, round = false), "1280 × 800")
            "chrome-x" -> chromeRows(listOf(CircleChromeSlot.HOUR_9))
            "chrome-x-gear" -> chromeRows(listOf(CircleChromeSlot.HOUR_9, CircleChromeSlot.HOUR_8))
            else -> error("Unknown geometry scenario ${scenario.id.value}")
        }
        return RingScreen.Rows(title = scenario.label, items = flowOf(rows))
    }

    private fun surfaceRows(
        surface: com.adelost.designkit.ui.CircleSurfaceLayout,
        viewport: String,
    ): List<RowSpec> = listOf(
        infoRow("viewport", "VIEWPORT", viewport, RingIcons.Phone),
        infoRow("class", "SURFACE", surface.surfaceClass.name, surface.surfaceClass.icon()),
        infoRow("width", "CONTENT MAX", "${surface.contentMaxWidthDp.toInt()} DP", RingIcons.Ruler),
        infoRow(
            "dial",
            "DIAL SIDE",
            "${surface.altitudeDialViewport.sideDp.toInt()} DP",
            RingIcons.Gauge,
        ),
    )

    private fun chromeRows(slots: List<CircleChromeSlot>): List<RowSpec> {
        val centreInset = roundSafeInsetDp(
            viewportWidthDp = CircleUiProfiles.CANON_ROUND_CANVAS_DP,
            viewportHeightDp = CircleUiProfiles.CANON_ROUND_CANVAS_DP,
            contentCenterYDp = CircleUiProfiles.CANON_ROUND_CANVAS_DP / 2f,
            reservedSlots = slots,
        )
        return listOf(
            infoRow("slots", "RESERVED", slots.joinToString(" + ") { it.name.removePrefix("HOUR_") }, RingIcons.Grid),
            infoRow("inset", "SAFE INSET", "${"%.1f".format(centreInset)} DP", RingIcons.Ruler),
            infoRow("rule", "CONTENT", "CENTERED", RingIcons.Target),
        )
    }

    private fun infoRow(key: String, title: String, sub: String, icon: androidx.compose.ui.graphics.vector.ImageVector) =
        RowSpec(key = key, title = title, sub = sub, icon = icon)

    private fun iconActions(scenario: ShowcaseScenario, session: ShowcaseSession): RingScreen {
        val active: Flow<Boolean?> = when (scenario.id.value) {
            "idle" -> flowOf(false)
            "active" -> flowOf(true)
            "immediate", "deliberate" -> session.iconActionActive.map<Boolean, Boolean?> { it }
            "disabled" -> flowOf(false)
            else -> error("Unknown icon scenario ${scenario.id.value}")
        }
        val timing = if (scenario.id.value == "immediate") {
            CircleActionTiming.IMMEDIATE
        } else {
            CircleActionTiming.DELIBERATE
        }
        return RingScreen.Launcher(
            title = scenario.label,
            gridRole = MenuGridRole.COMPONENT_GALLERY,
            entries = listOf(
                RingIcons.Sun to "SUN",
                RingIcons.Cloud to "CLOUD",
                RingIcons.Rain to "RAIN",
                RingIcons.Clown to "CLOWN",
            ).map { (icon, label) ->
                LaunchSpec(
                    icon = icon,
                    label = label,
                    open = { null },
                    run = if (scenario.id.value in setOf("immediate", "deliberate")) {
                        {
                            session.invoke(ShowcaseActionId(ShowcaseSession.ACTION_TOGGLE_ICON))
                            session.invoke(ShowcaseActionId(ShowcaseSession.ACTION_RUN))
                        }
                    } else null,
                    active = active,
                    enabled = flowOf(scenario.id.value != "disabled"),
                    actionTiming = timing,
                )
            },
        )
    }
}

private fun CircleSurfaceClass.icon() = when (this) {
    CircleSurfaceClass.ROUND -> RingIcons.Watch
    CircleSurfaceClass.PHONE_COMPACT, CircleSurfaceClass.PHONE_WIDE -> RingIcons.Phone
}

private fun androidx.compose.ui.graphics.Color.toHexArgb(): String =
    "#%08X".format(toArgb())

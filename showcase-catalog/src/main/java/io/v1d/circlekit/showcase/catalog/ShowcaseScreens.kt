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
import kotlinx.coroutines.flow.flowOf

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
                open = {
                    check(session.route(screen))
                    familyScreen(screen, family, session)
                },
            )
        } + listOfNotNull(
            dev?.let { port ->
                LaunchSpec(RingIcons.Wrench, "DEV", open = { ShowcaseDevScreens.root(port) })
            },
        ),
    )

    fun selectedScreen(
        mounted: ShowcaseMountedRenderer,
    ): RingScreen {
        val catalog = mounted.inputs.require<ShowcaseCatalogRendererInput>("${mounted.renderer.componentId()}.catalog")
        val snapshot = if (mounted.renderer.interactive) {
            mounted.inputs.require<ShowcaseRendererSnapshot>("${mounted.renderer.componentId()}.renderer")
        } else {
            null
        }
        val emitter = mounted.eventEmitter as? ShowcaseTypedRendererEmitter
        return when (mounted.renderer) {
            ShowcaseNativeRenderer.COLORS -> colors(catalog.scenario)
            ShowcaseNativeRenderer.GEOMETRY -> geometry(catalog.scenario)
            ShowcaseNativeRenderer.ICON_ACTIONS -> iconActions(catalog.scenario, snapshot as ShowcaseIconActionSnapshot, emitter!!)
            ShowcaseNativeRenderer.ACTION_ROWS -> ShowcaseInteractionScreens.actionRows(catalog.scenario, snapshot as ShowcaseActionRowSnapshot, emitter!!)
            ShowcaseNativeRenderer.CHOICE_ROWS -> ShowcaseInteractionScreens.choiceRows(catalog.scenario, snapshot as ShowcaseChoiceSnapshot, emitter!!)
            ShowcaseNativeRenderer.ADJUSTMENT -> ShowcaseInteractionScreens.adjustmentRows(catalog.scenario, snapshot as ShowcaseAdjustmentSnapshot, emitter!!)
            ShowcaseNativeRenderer.PROGRESS -> ShowcaseInteractionScreens.progressRows(catalog.scenario, snapshot as ShowcaseProgressSnapshot, emitter!!)
            ShowcaseNativeRenderer.SCREEN_TEMPLATES -> ShowcaseTemplateFixtures.screen(catalog.scenario, snapshot as ShowcaseTemplateSnapshot, emitter!!)
            ShowcaseNativeRenderer.SOURCE -> ShowcaseFlowScreens.source(snapshot as ShowcaseSourceSnapshot, emitter!!)
            ShowcaseNativeRenderer.UPDATE -> ShowcaseFlowScreens.update(snapshot as ShowcaseUpdateSnapshot, emitter!!)
            ShowcaseNativeRenderer.SERVICE -> ShowcaseFlowScreens.service(snapshot as ShowcaseServiceSnapshot, emitter!!)
            ShowcaseNativeRenderer.PRESS,
            ShowcaseNativeRenderer.TEXT,
            ShowcaseNativeRenderer.CAPTURE,
            ShowcaseNativeRenderer.PLAYBACK,
            ShowcaseNativeRenderer.PAGE_HOST,
            ShowcaseNativeRenderer.PAGE_MENU,
            -> error("Component renderer ${catalog.case.id.value} is not a RingScreen")
        }
    }

    private fun familyScreen(
        screen: String,
        family: ShowcaseFamily,
        session: ShowcaseSession,
    ): RingScreen = RingScreen.Launcher(
        title = family.title,
        gridRole = MenuGridRole.COMPONENT_GALLERY,
        entries = ShowcaseCatalogRuntime.componentIds(session.artifactProfile.id, screen).map { componentId ->
            val case = requireNotNull(ShowcaseCatalogRuntime.find(ShowcaseCaseId(componentId)))
            LaunchSpec(
                icon = ShowcaseNativeBindings.requireIcon(case.iconId),
                label = case.title,
                open = { scenarios(case, session) },
            )
        },
    )

    fun reservedChrome(destination: ShowcaseDestination): List<CircleChromeSlot> = buildList {
        add(CircleChromeSlot.HOUR_9)
        if (
            destination.caseId?.value == "foundation.geometry" &&
            destination.scenarioId?.value == "chrome-x-gear"
        ) {
            add(CircleChromeSlot.HOUR_8)
        }
    }

    private fun scenarios(case: ShowcaseCase, session: ShowcaseSession): RingScreen = RingScreen.Rows(
        title = case.title,
        items = flowOf(
            case.scenarios.map { scenario ->
                RowSpec(
                    key = "${case.id.value}/${scenario.id.value}",
                    title = scenario.label,
                    sub = scenario.id.value.uppercase(),
                    icon = ShowcaseNativeBindings.requireIcon(case.iconId),
                    onTap = { session.open(case.id, scenario.id) },
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

    private fun iconActions(
        scenario: ShowcaseScenario,
        model: ShowcaseIconActionSnapshot,
        emitter: ShowcaseTypedRendererEmitter,
    ): RingScreen {
        val active = when (scenario.id.value) {
            "idle" -> flowOf(false)
            "active" -> flowOf(true)
            "immediate", "deliberate" -> flowOf<Boolean?>(model.active)
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
            ).mapIndexed { index, (icon, label) ->
                LaunchSpec(
                    icon = icon,
                    label = label,
                    open = { null },
                    run = {
                        if (scenario.id.value in setOf("immediate", "deliberate") && index == 0) {
                            emitter.emit(ShowcaseRendererEventPayload("icon.toggle"))
                            emitter.emit(ShowcaseRendererEventPayload("action.run"))
                        }
                    },
                    active = if (index == 0) active else flowOf(false),
                    enabled = flowOf(scenario.id.value != "disabled" || index != 0),
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

package io.v1d.circlekit.showcase.catalog

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.adelost.designkit.ui.CircleColorSchemes
import com.adelost.designkit.ui.CircleColorTheme
import com.adelost.designkit.ui.MenuGridRole
import com.adelost.designkit.ui.RingIcons
import com.adelost.ringkit.data.Health
import com.adelost.ringkit.data.SourceId
import com.adelost.ringkit.ui.ActionSpec
import com.adelost.ringkit.ui.AdjustmentValuePresentation
import com.adelost.ringkit.ui.ColorDialPreviewSpec
import com.adelost.ringkit.ui.LaunchSpec
import com.adelost.ringkit.ui.RingScreen
import com.adelost.ringkit.ui.RowSpec
import com.adelost.ringkit.ui.StatRowSpec
import com.adelost.ringkit.ui.IconRing
import com.adelost.ringkit.ui.RingSelectionOption
import com.adelost.ringkit.ui.ringSelectionRows
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.combine

enum class ShowcaseScreenCase(val scenarioId: String) {
    HUB("hub"),
    DETAIL("detail"),
    LAUNCHER("launcher"),
    ROWS("rows"),
    ADJUSTMENT("adjustment"),
    COLOR_PICKER("color-picker"),
    DIAL_PREVIEW("dial-preview"),
}

/** Deterministic specs for every public RingScreen case. */
object ShowcaseTemplateFixtures {
    fun screen(scenario: ShowcaseScenario, session: ShowcaseSession): RingScreen = when (scenario.id.value) {
        ShowcaseScreenCase.HUB.scenarioId -> hub(session)
        ShowcaseScreenCase.DETAIL.scenarioId -> detail(session)
        ShowcaseScreenCase.LAUNCHER.scenarioId -> launcher(session)
        ShowcaseScreenCase.ROWS.scenarioId -> rows(session)
        ShowcaseScreenCase.ADJUSTMENT.scenarioId -> adjustment(session)
        ShowcaseScreenCase.COLOR_PICKER.scenarioId -> colorPicker(session)
        ShowcaseScreenCase.DIAL_PREVIEW.scenarioId -> dialPreview(CircleColorTheme.SEA_GLASS)
        "empty" -> RingScreen.Rows("EMPTY", flowOf(emptyList()))
        "max-capacity" -> maxCapacityRows()
        "long-content" -> longContentRows()
        "named-selection" -> RingScreen.Rows(
            "CHOOSE DEVICE",
            session.interaction.choiceIndex.map { index ->
                ringSelectionRows(
                    options = listOf(
                        RingSelectionOption("watch", "Watch", "A long device description stays readable beside its selection mark"),
                        RingSelectionOption("phone", "Phone", "The same list and stable identity on every screen size"),
                        RingSelectionOption("offline", "Other device", "Not connected", enabled = false),
                    ),
                    selectedId = if (index == 0) "watch" else "phone",
                    icon = RingIcons.Phone,
                    onSelect = { session.interaction.selectChoice(if (it == "watch") 0 else 1, 2) },
                )
            },
        )
        else -> error("Unknown screen fixture ${scenario.id.value}")
    }

    /** Exhaustive by construction: a new RingScreen case breaks compilation here. */
    fun kindOf(screen: RingScreen): ShowcaseScreenCase = when (screen) {
        is RingScreen.Hub -> ShowcaseScreenCase.HUB
        is RingScreen.Detail -> ShowcaseScreenCase.DETAIL
        is RingScreen.Launcher -> ShowcaseScreenCase.LAUNCHER
        is RingScreen.Rows -> ShowcaseScreenCase.ROWS
        is RingScreen.Adjustment -> ShowcaseScreenCase.ADJUSTMENT
        is RingScreen.ColorPicker -> ShowcaseScreenCase.COLOR_PICKER
        is RingScreen.DialPreview -> ShowcaseScreenCase.DIAL_PREVIEW
    }

    fun representatives(session: ShowcaseSession): List<RingScreen> = listOf(
        hub(session),
        detail(session),
        launcher(session),
        rows(session),
        adjustment(session),
        colorPicker(session),
        dialPreview(CircleColorTheme.SEA_GLASS),
    )

    private fun hub(session: ShowcaseSession): RingScreen.Hub = RingScreen.Hub(
        title = "DATA DEMO",
        rows = listOf(
            stat(session, "weather", "WEATHER", "18°", Health.FRESH, RingIcons.Cloud),
            stat(session, "wind", "WIND", "6 M/S", Health.AGING, RingIcons.Wind),
            stat(session, "position", "POSITION", "±12 M", Health.FRESH, RingIcons.Gps),
            stat(session, "terrain", "TERRAIN", "82%", Health.AGING, RingIcons.Mountain),
            stat(session, "sync", "SYNC", "OFF", Health.OFF, RingIcons.Link),
            stat(session, "forecast", "FORECAST", "ERROR", Health.BROKEN, RingIcons.Warning),
        ),
        corner = LaunchSpec(
            icon = RingIcons.Gear,
            label = "SETTINGS",
            open = { rows(session) },
        ),
    )

    private fun stat(
        session: ShowcaseSession,
        id: String,
        label: String,
        value: String,
        health: Health,
        icon: androidx.compose.ui.graphics.vector.ImageVector,
    ) = StatRowSpec(
        id = SourceId(id),
        icon = icon,
        label = label,
        value = flowOf(value),
        health = flowOf(health),
        detail = { detail(session, label, value, icon, health) },
    )

    private fun detail(
        session: ShowcaseSession,
        label: String = "WEATHER",
        value: String = "18°",
        icon: androidx.compose.ui.graphics.vector.ImageVector = RingIcons.Cloud,
        health: Health = Health.FRESH,
    ): RingScreen.Detail {
        val displayed = MutableStateFlow(value)
        return RingScreen.Detail(
        title = "$label DEMO",
        icon = icon,
        sourceId = SourceId("showcase-source"),
        hero = displayed,
        sub = session.interaction.actionCount.map { "LOCAL EXAMPLE · USED $it" },
        freshness = flowOf(when (health) {
            Health.FRESH -> "RECENT EXAMPLE VALUE"
            Health.AGING -> "OLD EXAMPLE VALUE"
            Health.OFF -> "SOURCE DISABLED"
            Health.BROKEN -> "REQUEST FAILED"
            else -> "EXAMPLE DATA"
        }),
        health = flowOf(health),
        progress = flowOf(null),
        actions = listOf(
            ActionSpec("USE VALUE", RingIcons.Check, { session.interaction.runAction() }),
            ActionSpec("CLEAR", RingIcons.Trash, { displayed.value = "—" }, holdToConfirm = true, destructive = true),
        ),
        onRefresh = { displayed.value = value },
    )
    }

    private fun launcher(session: ShowcaseSession): RingScreen.Launcher = RingScreen.Launcher(
        title = "MENU DEMO",
        gridRole = MenuGridRole.COMPONENT_GALLERY,
        entries = listOf(
            LaunchSpec(RingIcons.Cloud, "DETAIL", open = { detail(session) }),
            LaunchSpec(RingIcons.Book, "ROWS", open = { rows(session) }),
            LaunchSpec(RingIcons.Sliders, "ADJUST", open = { adjustment(session) }),
        ),
    )

    private fun rows(session: ShowcaseSession): RingScreen.Rows = RingScreen.Rows(
        title = "SETTINGS DEMO",
        items = combine(session.interaction.actionCount, session.interaction.choiceIndex) { count, selected ->
            listOf(
                RowSpec("info", "LOCAL EXAMPLE", "No product settings are changed", icon = null),
                RowSpec("action", "RUN ACTION", "RAN $count TIMES", RingIcons.Play,
                    onTap = { session.interaction.runAction() }),
                RowSpec(
                    "toggle",
                    "TOGGLE",
                    if (selected == 0) "OFF" else "ON",
                    RingIcons.Eye,
                    choices = listOf("OFF", "ON"),
                    onSelect = { session.interaction.selectChoice(if (it == "ON") 1 else 0, 2) },
                    choiceRole = com.adelost.designkit.ui.CircleChoiceRole.TOGGLE,
                ),
            )
        },
    )

    private fun adjustment(session: ShowcaseSession): RingScreen.Adjustment {
        fun row(value: Int) = RowSpec(
            key = "template-adjustment",
            title = "ALTITUDE",
            sub = "$value M",
            icon = RingIcons.Ruler,
            onDec = { session.interaction.adjust(-100) },
            onInc = { session.interaction.adjust(100) },
            adjustmentValue = AdjustmentValuePresentation("$value M", "0–1000 M · 100 M STEP"),
        )
        return RingScreen.Adjustment(
            title = "ADJUSTMENT",
            initial = row(session.interaction.adjustmentValue.value),
            row = session.interaction.adjustmentValue.map(::row),
        )
    }

    private fun colorPicker(session: ShowcaseSession): RingScreen.ColorPicker = RingScreen.ColorPicker(
        selected = session.flows.theme,
        onSelect = session.flows::selectTheme,
        dialPreview = dialSpec(),
    )

    private fun dialPreview(theme: CircleColorTheme): RingScreen.DialPreview = RingScreen.DialPreview(
        startAltitudeM = 2_500f,
        theme = theme,
        spec = dialSpec(),
    )

    private fun dialSpec() = ColorDialPreviewSpec(
        maxAltitudeM = 4_000f,
        defaultAltitudeM = 2_500f,
        checkpointsM = listOf(300f, 1_500f, 4_000f),
        colorAt = { _, theme -> CircleColorSchemes.resolve(theme).active },
        render = { altitudeM, _, modifier -> ShowcaseDialValue(altitudeM, modifier) },
    )

    @Composable
    private fun ShowcaseDialValue(altitudeM: Float, modifier: Modifier) {
        Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            IconRing(
                icon = RingIcons.Gauge,
                label = "ALTITUDE",
                centerValue = "${altitudeM.toInt()} M",
                active = true,
                onTap = {},
            )
        }
    }

    private fun maxCapacityRows(): RingScreen.Rows = RingScreen.Rows(
        title = "18 ROWS DEMO",
        items = flowOf(
            (1..18).map { index ->
                RowSpec("row-$index", "ROW ${index.toString().padStart(2, '0')}", "SCROLLABLE", RingIcons.Book)
            },
        ),
    )

    private fun longContentRows(): RingScreen.Rows = RingScreen.Rows(
        title = "LONG CONTENT",
        items = flowOf(
            listOf(
                RowSpec(
                    key = "long",
                    title = "A DELIBERATELY LONG TITLE THAT MUST REMAIN HONEST",
                    sub = "LONG SUPPORTING COPY WRAPS OR ELLIPSIZES WITHOUT ESCAPING THE ROUND CHORD",
                    icon = RingIcons.Warning,
                    hint = "Long content tests the shared geometry rather than adding sample padding.",
                ),
            ),
        ),
    )
}

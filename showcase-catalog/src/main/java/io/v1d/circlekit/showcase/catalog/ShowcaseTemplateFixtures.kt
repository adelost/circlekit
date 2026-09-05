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
import com.adelost.ringkit.data.Progress
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
        ShowcaseScreenCase.HUB.scenarioId -> hub()
        ShowcaseScreenCase.DETAIL.scenarioId -> detail(Health.FRESH, Progress(3, 5)) {}
        ShowcaseScreenCase.LAUNCHER.scenarioId -> launcher()
        ShowcaseScreenCase.ROWS.scenarioId -> rows()
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
        hub(),
        detail(Health.FRESH, null) {},
        launcher(),
        rows(),
        adjustment(session),
        colorPicker(session),
        dialPreview(CircleColorTheme.SEA_GLASS),
    )

    private fun hub(): RingScreen.Hub = RingScreen.Hub(
        title = "SOURCE HUB",
        rows = listOf(
            stat("weather", "WEATHER", "18°", Health.FRESH, RingIcons.Cloud),
            stat("wind", "WIND", "6 M/S", Health.AGING, RingIcons.Wind),
            stat("position", "POSITION", "±12 M", Health.FRESH, RingIcons.Gps),
            stat("terrain", "TERRAIN", "82%", Health.AGING, RingIcons.Mountain),
            stat("sync", "SYNC", "OFF", Health.OFF, RingIcons.Link),
            stat("forecast", "FORECAST", "ERROR", Health.BROKEN, RingIcons.Warning),
        ),
        corner = LaunchSpec(
            icon = RingIcons.Gear,
            label = "SETTINGS",
            open = { rows() },
        ),
    )

    private fun stat(
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
        detail = { detail(health, null) {} },
    )

    private fun detail(
        health: Health,
        progress: Progress?,
        onRefresh: () -> Unit,
    ): RingScreen.Detail = RingScreen.Detail(
        title = "SOURCE DETAIL",
        icon = RingIcons.Cloud,
        sourceId = SourceId("showcase-source"),
        hero = flowOf("18°"),
        sub = flowOf("DETERMINISTIC FIXTURE"),
        freshness = flowOf(if (health == Health.BROKEN) "TIMEOUT" else "UPDATED 2 MIN AGO"),
        health = flowOf(health),
        progress = flowOf(progress),
        actions = listOf(
            ActionSpec("USE VALUE", RingIcons.Check, {}),
            ActionSpec("CLEAR", RingIcons.Trash, {}, holdToConfirm = true, destructive = true),
        ),
        onRefresh = onRefresh,
        refreshEnabled = flowOf(progress == null),
    )

    private fun launcher(): RingScreen.Launcher = RingScreen.Launcher(
        title = "LAUNCHER",
        gridRole = MenuGridRole.COMPONENT_GALLERY,
        entries = listOf(
            LaunchSpec(RingIcons.Cloud, "DETAIL", open = { detail(Health.FRESH, null) {} }),
            LaunchSpec(RingIcons.Book, "ROWS", open = ::rows),
            LaunchSpec(RingIcons.Sliders, "ADJUST", open = { null }, run = {}),
        ),
    )

    private fun rows(): RingScreen.Rows = RingScreen.Rows(
        title = "ROWS",
        items = flowOf(
            listOf(
                RowSpec("info", "INFORMATION", "PASSIVE", RingIcons.Check),
                RowSpec("action", "ACTION", "TAP", RingIcons.Play, onTap = {}),
                RowSpec(
                    "toggle",
                    "TOGGLE",
                    "ON",
                    RingIcons.Eye,
                    choices = listOf("OFF", "ON"),
                    onSelect = {},
                ),
            ),
        ),
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
        title = "MAX CAPACITY",
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

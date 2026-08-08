package com.adelost.ringkit.ui

import com.adelost.designkit.ui.LocalCircleSurfaceLayout
import com.adelost.designkit.ui.CircleSurfaceClass
import com.adelost.designkit.ui.*

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import com.adelost.ringkit.data.Health
import com.adelost.ringkit.data.Progress
import com.adelost.ringkit.data.SourceId
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf

private const val MAX_GRID_MENU_ITEMS = 9

/**
 * Declarative screens: the menu system is DATA, rendered in ONE place.
 *
 * The point is not the case COUNT — it is that a new data source, launcher or
 * list can never be a new bespoke composable. Adding a setting, a menu, a
 * status list or a continuous value is a new spec value, and the renderer
 * already knows how to draw it.
 *
 * A new sealed case is justified only when a surface fails ALL of these:
 *
 *  1. It cannot be expressed as rows or a launcher grid (its content is not
 *     a list of labelled things).
 *  2. It owns interaction the row grammar has no vocabulary for — a scrubber,
 *     a live instrument, a canvas.
 *  3. It needs its own place in the back stack.
 *
 * [ColorPicker] and [DialPreview] clear that bar: a palette with an altitude
 * scrubber, and the real instrument animating down from a chosen height.
 * Forcing them into rows would only mean a slot that accepts arbitrary
 * layout, which is a bespoke composable wearing a data-shaped hat.
 *
 * check-ui-atoms.sh ratchets the case count, so a NEW case is a deliberate,
 * reviewed act rather than the path of least resistance.
 */
sealed interface RingScreen {
    val title: String

    /**
     * Collection screens: a launcher grid or a row list.
     *
     * The shape IS the case. A parallel `RingMenuLayout` taxonomy used to
     * restate it, which meant both hosts dispatched on the layout and then
     * `require`d the matching screen type — validating at runtime what the
     * compiler already knew (circle:8 review, 2026-07-27).
     */
    sealed interface Menu : RingScreen

    /** The status hub: up to six [StatRowSpec] mini-rings + a corner entry. */
    data class Hub(
        override val title: String,
        val rows: List<StatRowSpec>,
        val corner: LaunchSpec? = null,
    ) : RingScreen

    /** One source's detail: hero value, freshness line and actions. */
    data class Detail(
        override val title: String,
        val icon: ImageVector,
        val sourceId: SourceId,
        val hero: Flow<String>,
        val sub: Flow<String>,
        val freshness: Flow<String>,
        val health: Flow<Health>,
        val progress: Flow<Progress?>,
        val actions: List<ActionSpec> = emptyList(),
        val onRefresh: (() -> Unit)? = null,
        /** Null means always available. A source with multiple pipelines can
         *  keep refresh disabled until every pipeline has settled. */
        val refreshEnabled: Flow<Boolean>? = null,
    ) : RingScreen

    /** A grid of launcher rings (settings root, tools). */
    data class Launcher(
        override val title: String,
        val gridRole: MenuGridRole,
        val entries: List<LaunchSpec>,
    ) : Menu {
        init {
            require(entries.size in 1..MAX_GRID_MENU_ITEMS) {
                "Icon-driven grid menus require 1..$MAX_GRID_MENU_ITEMS entries; use Rows for scrollable content"
            }
        }
    }

    /** A content list (jumps, stations, aircraft): ledger rows, rotary scroll. */
    data class Rows(
        override val title: String,
        val items: Flow<List<RowSpec>>,
        /** Setup owns the full screen and cannot be backed around. Menus keep
         * the normal visible exit by default. */
        val showBack: Boolean = true,
    ) : Menu

    /**
     * One continuous setting, opened from a normal gear row. The source row
     * remains live while this submenu is open, so changing units or stepping
     * the value never leaves stale presentation on either host.
     */
    data class Adjustment(
        override val title: String,
        val initial: RowSpec,
        val row: Flow<RowSpec>,
    ) : RingScreen

    /**
     * Shared Watch/Phone colour-family picker. Schemes and their preview
     * pigments live in designkit; this screen only declares current state and
     * intent, keeping settings free from per-theme rendering branches.
     */
    data class ColorPicker(
        override val title: String = "COLORS",
        val selected: Flow<CircleColorTheme>,
        val onSelect: (CircleColorTheme) -> Unit,
        val dialPreview: ColorDialPreviewSpec,
    ) : RingScreen

    /**
     * The real shared instrument at a synthetic numeric altitude. This is a
     * child of [ColorPicker], not a second dial renderer: X/back pops straight
     * to the theme controls while the approved instrument atom owns pixels.
     */
    data class DialPreview(
        override val title: String = "PREVIEW",
        val startAltitudeM: Float,
        val theme: CircleColorTheme,
        val spec: ColorDialPreviewSpec,
    ) : RingScreen
}

/**
 * App-owned flight rules resolved into one renderer callback. RingKit owns
 * only the scrub/animation shell, so safety thresholds and segment math can
 * never drift into a decorative settings implementation.
 */
data class ColorDialPreviewSpec(
    val maxAltitudeM: Float,
    val defaultAltitudeM: Float,
    val checkpointsM: List<Float>,
    val colorAt: (altitudeM: Float, theme: CircleColorTheme) -> Color,
    val render: @Composable (
        altitudeM: Float,
        theme: CircleColorTheme,
        modifier: Modifier,
    ) -> Unit,
) {
    init {
        require(maxAltitudeM > 0f && maxAltitudeM.isFinite())
        require(defaultAltitudeM in 0f..maxAltitudeM)
        require(checkpointsM.all { it in 0f..maxAltitudeM && it.isFinite() })
    }
}

data class StatRowSpec(
    val id: SourceId,
    val icon: ImageVector,
    val label: String,
    val value: Flow<String>,
    val health: Flow<Health>,
    /** Clockwise visual rotation for directional source icons. */
    val iconRotation: Flow<Float> = flowOf(0f),
    /** Built lazily on tap, so a spec row stays cheap data. */
    val detail: () -> RingScreen,
)

/**
 * Something a source's Detail page can DO: refresh it, open its settings,
 * restore a reference.
 *
 * [icon] is required, exactly as it is on [LaunchSpec]. These used to render
 * as bare centred words under the hero number, in an app whose entire menu
 * language is icon-ring rows — so nothing about them said they could be
 * pressed at all. A default icon would have kept that trap loaded on every
 * new action; requiring one makes the compiler ask.
 */
data class ActionSpec(
    val label: String,
    val icon: ImageVector,
    val onRun: () -> Unit,
    /** Destructive/state-swapping actions require a sustained press so a
     *  sleeve-brush can never fire them. */
    val holdToConfirm: Boolean = false,
    val destructive: Boolean = false,
)

data class LaunchSpec(
    val icon: ImageVector,
    val label: String,
    val open: () -> RingScreen?,
    val run: (() -> Unit)? = null,
    val active: Flow<Boolean?> = flowOf(null),
    val liveLabel: Flow<String>? = null,
    /** Availability and cadence are launcher data. Host renderers never
     * invent different gating for the same semantic action. */
    val enabled: Flow<Boolean> = flowOf(true),
    val actionTiming: CircleActionTiming = CircleActionTiming.DELIBERATE,
)

/**
 * One row on any surface. The field list is wide because it covers five
 * meanings at once, but you never fill it in: state the two or three fields
 * your meaning needs and [kind] follows.
 *
 * ```
 * // Information — shows, does nothing.
 * RowSpec(key = "sats", title = "SATELLITES", sub = "11", icon = RingIcons.Gps)
 *
 * // Action — one thing happens.
 * RowSpec(key = "cal", title = "CALIBRATE", sub = "", icon = RingIcons.Refresh,
 *         onTap = { vm.calibrate() })
 *
 * // Toggle — two states, the ring carries them.
 * RowSpec(key = "grid", title = "GRID", sub = if (on) "ON" else "OFF",
 *         icon = RingIcons.Grid, choices = listOf("OFF", "ON"),
 *         choiceRole = CircleChoiceRole.TOGGLE, onSelect = { vm.setGrid(it == "ON") })
 *
 * // Choice of N — a finite named set; renders step dots.
 * RowSpec(key = "units", title = "UNITS", sub = current.label, icon = RingIcons.Ruler,
 *         choices = Units.entries.map { it.label }, onSelect = { vm.setUnits(it) })
 *
 * // Adjustment — a CONTINUOUS value; opens its own +/- screen.
 * RowSpec(key = "spot", title = "SPOT", sub = "300 M", icon = RingIcons.Target,
 *         onDec = { vm.spot(-10) }, onInc = { vm.spot(+10) })
 * ```
 */
data class RowSpec(
    val key: String,
    val title: String,
    val sub: String,
    /** Null is an explicit content-row decision (jump, station, aircraft).
     *  Menu/settings rows supply an icon. No default: every new row must
     *  consciously choose between those two roles. */
    val icon: ImageVector?,
    /**
     * One sentence: what this row does, and what its states mean. Shown in the
     * centre cue while the row is held, so a row can be explored by pressing
     * it and released before it fires — the press IS the peek, and no new
     * gesture had to be invented for it (Mattias 2026-07-27: "man kanske inte
     * vet riktigt vad den gör ... så kan man explora lite bättre").
     *
     * Blank means the title already says everything. Write one for anything a
     * jumper could not name from its label alone.
     */
    val hint: String = "",
    /** Product meaning, resolved to the same pigment on Watch and Phone. */
    val accent: CircleAccent = ringIconAccent(icon),
    /** Optional product-semantic colour for the row's value/icon (for
     * altitude alarm bands, health states, etc.). */
    val semanticColor: Color? = null,
    /** Optional verb shown only inside the transient information card. */
    val infoAction: CircleActionCueInfoAction? = null,
    /** Null is a passive information/status row, with no touch affordance. */
    val onTap: (() -> Unit)? = null,
    /** Optional asynchronous work rendered through the shared label sweep.
     * The renderer also supplies the standard safe-tap delay automatically. */
    val labelProgress: CircleLabelProgress? = null,
    /** Both set = the row opens a dedicated continuous-value submenu. */
    val onDec: (() -> Unit)? = null,
    val onInc: (() -> Unit)? = null,
    /**
     * Optional structured copy for the continuous-value submenu. [sub]
     * remains the compact parent-row summary; this separates the value a
     * person changes from its reference/context so a round editor never has
     * to parse product prose or wrap one opaque string around its controls.
     */
    val adjustmentValue: AdjustmentValuePresentation? = null,
    /** Optional visibility toggle shown as an eye in the value centre. */
    val enabled: Boolean? = null,
    val onToggle: (() -> Unit)? = null,
    /** Mode-swapping rows require the sustained-press gesture. */
    val holdToConfirm: Boolean = false,
    /** Duration is row data. Ordinary choices use the 500 ms deliberate rung;
     *  confirmation rows default to the 900 ms destructive/state-swap rung. */
    val holdMs: Long = if (holdToConfirm) {
        MenuDesign.holdDestructiveMs
    } else {
        MenuDesign.holdDeliberateMs
    },
    /** Non-null makes +/- and the optional eye toggle deliberate holds too. */
    val adjustHoldMs: Long? = null,
    /** Complete finite-choice set; rendered as one cycling setting row. */
    val choices: List<String> = emptyList(),
    val onSelect: ((String) -> Unit)? = null,
    /** Boolean choices also light the icon ring; ordinary ordered choices
     * remain neutral and communicate position through the shared dot rail. */
    val choiceRole: CircleChoiceRole = CircleChoiceRole.STEPPED,
    /** Interaction cadence is product data; camera/transport rows are
     * immediate while ordinary settings retain wrist-safe intent. */
    val actionTiming: CircleActionTiming = CircleActionTiming.DELIBERATE,
    /** Adjustment submenu only: holding the value centre fires [onToggle]
     * after this long (a deliberate reset) while +/- stay plain taps. */
    val centerHoldMs: Long? = null,
    /** Optional value replacing the icon inside the row's standard ring.
     *  Used for data that is clearer as itself than as a pictogram. */
    val centerValue: String? = null,
) {
    /**
     * Semantic row role, DERIVED from the interaction data — never passed in.
     *
     * It used to be a constructor parameter defaulting to the same resolver,
     * guarded by a `require` that it matched. That made a wrong kind
     * constructible and then rejected at runtime; deriving it makes the wrong
     * state unrepresentable (circle:8 review, 2026-07-27).
     */
    val kind: RowKind = rowKindFor(onTap, onDec, onInc, choices, choiceRole)

    init {
        require(
            (choices.isEmpty() && onSelect == null) ||
                (
                    choices.size in CircleChoiceState.MIN_OPTIONS..CircleChoiceState.MAX_OPTIONS &&
                        choices.distinct().size == choices.size && onSelect != null
                    ),
        ) { "Row choices require 2..7 unique options and an onSelect handler" }
        require((onDec == null) == (onInc == null)) {
            "Adjustment rows require both decrement and increment actions"
        }
        require(onDec == null || choices.isEmpty()) {
            "A row cannot be both an adjustment and a finite choice"
        }
        require(adjustmentValue == null || onDec != null) {
            "Structured adjustment copy belongs only to an adjustment row"
        }
        require(icon == null || centerValue == null) { "A row ring holds either an icon or a value, never both" }
        require(hint.length <= MenuDesign.hintMaxChars) {
            "Row '$key' explains itself in ${hint.length} characters; the centre cue holds " +
                "${MenuDesign.hintMaxChars} before it ellipsises. One sentence, not two."
        }
    }
}

data class AdjustmentValuePresentation(
    val primary: String,
    val supporting: String? = null,
) {
    init {
        require(primary.isNotBlank()) { "An adjustment value needs visible primary copy" }
        require(supporting == null || supporting.isNotBlank()) {
            "Adjustment supporting copy is either absent or visible"
        }
    }
}

/**
 * A dumb stack. push/back, nothing else — locks, phase guards and camera
 * policy are the app's wrappers AROUND the stack, never per-screen logic.
 */
class RingNavigator(root: RingScreen) {
    val stack = mutableStateListOf(root)
    val current: RingScreen get() = stack.last()

    fun push(screen: RingScreen) {
        stack.add(screen)
    }

    /** Pops one level. Returns false when already at the root. */
    fun back(): Boolean {
        if (stack.size <= 1) return false
        stack.removeAt(stack.lastIndex)
        return true
    }
}

/**
 * The ONE entry point. Screens are data; this is the only door through which
 * they turn into pixels, and the surface class is the only thing it decides.
 *
 * The pixels themselves live one file away per surface — [RoundRingScreens]
 * and [PhoneRingScreens] — so a round inset or a phone header can never be
 * written into the shared contract by accident.
 *
 * Product-level X@9 owns visible round back navigation; phone keeps its own
 * header/back atom.
 */
@Composable
fun RenderRingScreen(
    nav: RingNavigator,
    onExit: () -> Unit,
) {
    if (LocalCircleSurfaceLayout.current.surfaceClass != CircleSurfaceClass.ROUND) {
        PhoneRingScreen(nav = nav, onExit = onExit)
        return
    }
    val s = nav.current
    Box(Modifier.fillMaxSize().circleMenuCanvas()) {
        when (s) {
            is RingScreen.Hub -> HubScreen(s, nav)
            is RingScreen.Detail -> DetailScreen(s)
            is RingScreen.Menu -> MenuScreen(s, nav)
            is RingScreen.Adjustment -> RingAdjustmentScreen(s)
            is RingScreen.ColorPicker -> ColorPickerScreen(s, nav)
            is RingScreen.DialPreview -> DialPreviewScreen(s)
        }
    }
}

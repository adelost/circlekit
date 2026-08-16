package com.adelost.renderkit.list

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import com.adelost.renderkit.data.OledDataPlotModuleLayout
import com.adelost.renderkit.data.OledDataPlotModuleSpec
import com.adelost.renderkit.data.OledDataPlotSpec

/**
 * The wear-free list contract between shared Skyvw screens and their hosts
 * (port contract, docs/plans/2026-07-18-phone-responsive-port.md).
 *
 * A shared screen describes WHAT the list contains and its SEMANTIC layout
 * policy; the host owns the container and translates the policy to its
 * platform: the Wear host renders a ScalingLazyColumn (fisheye, rotary
 * focus, anchor semantics), the phone host a LazyColumn. Raw items were
 * rejected as the contract because the watch's scrolling screens carry
 * per-screen anchor/offset/auto-centering semantics (FlightDetail:
 * ItemCenter + 30 dp anchor offset) that must survive the translation —
 * WatchExact means exact.
 */
@Immutable
data class SkyvwListSpec(
    val policy: SkyvwListPolicy = SkyvwListPolicy(),
    val items: List<SkyvwListItem>,
)

/** Semantic layout policy — hosts translate, screens never see containers. */
@Immutable
data class SkyvwListPolicy(
    val anchor: SkyvwListAnchor = SkyvwListAnchor.TOP,
    /** Optional visual motion shared by every host translation. */
    val scrollEffect: SkyvwListScrollEffect = SkyvwListScrollEffect.NONE,
    /** Visual canvas intent translated by each host. OLED is the product default. */
    val background: SkyvwListBackground = SkyvwListBackground.OLED,
    /** Index the list initially rests on (anchor-relative). */
    val initialIndex: Int = 0,
    /** Anchor fine-tune in dp (ScalingLazy anchor offset / LazyList scroll offset). */
    val initialAnchorOffsetDp: Float = 0f,
    val itemSpacingDp: Float = 0f,
    val paddingTopDp: Float = 0f,
    val paddingBottomDp: Float = 0f,
    val paddingHorizontalDp: Float = 0f,
    /** On ROUND only, let the host pull each moving row inside the circle
     * chord at its current vertical centre. Linear phone hosts ignore it. */
    val roundChordSafeItems: Boolean = false,
    /**
     * How many cells fit beside each other. Capacity, never content.
     *
     * A wide host used to express this by composing a second grid next to the
     * spec, which is how a screen ends up declared twice. It belongs here
     * because the contract already says the host translates a semantic policy
     * into its own container, and a column count is exactly that.
     *
     * Comes from a declared surface table (the `menuGridSpec` pattern), never
     * from a number typed at a call site. One is the default, so every existing
     * screen keeps the rendering it has.
     */
    val columns: Int = 1,
    /** Gap between cells on one line; [itemSpacingDp] still spaces the lines. */
    val columnGapDp: Float = 0f,
) {
    init {
        require(columns >= 1) { "A list needs at least one column, got $columns" }
    }
}

enum class SkyvwListScrollEffect {
    NONE,

    /** The row nearest the viewport centre rests at full size; edge rows
     *  recede slightly. Wear gets this from ScalingLazyColumn, while linear
     *  hosts apply the same semantic focus themselves. */
    CENTER_FOCUS,
}

enum class SkyvwListAnchor {
    /** Plain top-aligned reading list. */
    TOP,

    /** The anchored item rests at the vertical centre (Wear: ItemCenter +
     *  auto-centering; phone: centred initial scroll position). */
    ITEM_CENTER,
}

/**
 * Geometry supplied while a host translates the actual module list item.
 * The content reads each named child's width/centre from here; it never draws
 * a duplicate overlay beside the list. Rectangular hosts leave it null.
 */
val LocalOledDataPlotModuleLayout = staticCompositionLocalOf<OledDataPlotModuleLayout?> { null }

/** One list row: stable identity + content. The content lambda renders
 *  designkit/skyvwui composables only — the host container provides no
 *  scope, so items cannot depend on platform list DSLs. */
class SkyvwListItem(
    val key: Any,
    val contentType: Any? = null,
    /**
     * Non-null only for a real data plot. Round hosts keep this item at one
     * stable chord width and clamp its centre; linear hosts ignore it.
     */
    val oledDataPlot: OledDataPlotSpec? = null,
    /**
     * One typed, vertically clamped plot module. A round host computes its
     * [OledDataPlotModuleLayout], translates this same list item, and provides
     * the result through [LocalOledDataPlotModuleLayout]. Activation and
     * release remain host policy, not model state.
     */
    val oledDataPlotModule: OledDataPlotModuleSpec? = null,
    /**
     * Set by [SkyvwListScope.group]; screens never pass it. Consecutive items
     * sharing a non-null key are one indivisible cell — see [SkyvwListPolicy.columns].
     */
    val groupKey: Any? = null,
    val content: @Composable () -> Unit,
) {
    init {
        require(oledDataPlot == null || oledDataPlotModule == null) {
            "a list item cannot declare both legacy plot and plot-module geometry"
        }
    }

    internal fun inGroup(key: Any): SkyvwListItem =
        SkyvwListItem(
            key = this.key,
            contentType = contentType,
            oledDataPlot = oledDataPlot,
            oledDataPlotModule = oledDataPlotModule,
            groupKey = key,
            content = content,
        )
}

/**
 * Collects the one content sequence a screen declares.
 *
 * [add] keeps every existing screen reading exactly as it did; [group] is the
 * only addition, and it exists because a multi-column host has to know which
 * items may NOT be separated. A records category is a header AND its ranked
 * rows: split across a column boundary it stops being a category, which a
 * per-item span could never express.
 */
class SkyvwListScope internal constructor() {
    private val items = mutableListOf<SkyvwListItem>()

    fun add(item: SkyvwListItem) {
        items += item
    }

    fun addAll(items: Collection<SkyvwListItem>) {
        this.items += items
    }

    /**
     * One indivisible cell.
     *
     * At one column a group is exactly the items written in order — that is the
     * property protecting every round rendering from this contract growing a
     * second dimension.
     */
    fun group(key: Any, builder: SkyvwListScope.() -> Unit) {
        val nested = SkyvwListScope().apply(builder).build()
        require(nested.isNotEmpty()) { "An empty list group has no cell to occupy: $key" }
        items += nested.map { it.inGroup(key) }
    }

    internal fun build(): List<SkyvwListItem> = items.toList()
}

/** Builder sugar so screens read declaratively. */
fun buildSkyvwList(
    policy: SkyvwListPolicy = SkyvwListPolicy(),
    builder: SkyvwListScope.() -> Unit,
): SkyvwListSpec = SkyvwListSpec(policy = policy, items = SkyvwListScope().apply(builder).build())

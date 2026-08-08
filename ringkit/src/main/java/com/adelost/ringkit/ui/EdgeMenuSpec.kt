package com.adelost.ringkit.ui

import com.adelost.designkit.ui.CircleActionTiming
import com.adelost.designkit.ui.CircleChoiceState

import androidx.compose.ui.graphics.vector.ImageVector

/**
 * One option in a surface-owned settings menu.
 *
 * Screens provide only data. The host decides how the menu is opened and one
 * renderer draws every option with the same row grammar on Watch and Phone.
 *
 * Its [kind] is the SAME [RowKind] the settings rows use: a menu option is a
 * menu row, so there is no second vocabulary to keep in sync and no adapter
 * translating one enum into another (Mattias 2026-07-27: no special cases).
 */
class EdgeMenuOption(
    val key: String,
    val label: String,
    val icon: ImageVector,
    /**
     * One sentence: what this option does and what its states mean. Shown in
     * the centre cue while the row is held, so a row can be explored by
     * pressing it and released before it fires (Mattias 2026-07-27: "problemet
     * med att man klickar på en knapp är att man kanske inte vet riktigt vad
     * den gör"). Blank means the label already says everything.
     */
    val hint: String = "",
    /** The interaction meaning. Renderers consume this; they never infer it. */
    val kind: RowKind = RowKind.ACTION,
    /** State for [RowKind.TOGGLE]. */
    val active: Boolean? = null,
    /** Ordered-state position for [RowKind.CHOICE_OF_N]. */
    val choiceState: CircleChoiceState? = null,
    /** Optional human labels for an ordered choice. Empty keeps numeric steps. */
    val choiceLabels: List<String> = emptyList(),
    val onTap: () -> Unit,
    /**
     * The state this ACTION operates on, shown as the row's value line.
     * Null keeps the plain SELECT affordance. Without it an action row that
     * has state has to smuggle the state into its LABEL, and the row then
     * renames itself instead of naming its question (Mattias 2026-07-27).
     */
    val value: String? = null,
    /** Optional verb shown only inside the transient information card. */
    val infoAction: com.adelost.designkit.ui.CircleActionCueInfoAction? = null,
    /** Apply the action and return to the spatial surface immediately. */
    val closeOnTap: Boolean = false,
    val timing: CircleActionTiming = CircleActionTiming.DELIBERATE,
) {
    init {
        when (kind) {
            RowKind.ACTION -> {
                require(choiceState == null && choiceLabels.isEmpty()) {
                    "Action '$key' cannot carry ordered-choice state"
                }
            }
            RowKind.TOGGLE -> {
                require(active != null && choiceState == null && choiceLabels.isEmpty()) {
                    "Toggle '$key' requires active state and cannot carry ordered-choice state"
                }
            }
            RowKind.CHOICE_OF_N -> {
                val state = requireNotNull(choiceState) {
                    "Choice '$key' requires ordered-choice state"
                }
                require(active == null) { "Choice '$key' cannot also be a boolean toggle" }
                require(
                    choiceLabels.isEmpty() ||
                        (
                            choiceLabels.size == state.optionCount &&
                                choiceLabels.distinct().size == choiceLabels.size
                            ),
                ) {
                    "Choice '$key' labels must be unique and match its option count"
                }
            }
            RowKind.INFORMATION, RowKind.ADJUSTMENT -> error(
                "Menu option '$key' cannot be $kind: a menu row is tappable, and a " +
                    "continuous value opens its own adjustment screen instead",
            )
        }
    }
}

class EdgeMenuSection(
    val label: String,
    val options: List<EdgeMenuOption>,
) {
    init {
        require(label.isNotBlank()) { "Menu section label must not be blank" }
        require(options.isNotEmpty()) { "Menu section must contain an option" }
    }
}

/**
 * Complete options-menu declaration for a spatial surface. This replaces the
 * old draggable tray contract; no geometry or host behavior leaks into data.
 */
class EdgeMenuSpec(
    val title: String,
    val primarySection: EdgeMenuSection? = null,
    val options: List<EdgeMenuOption> = emptyList(),
    /**
     * Options that are set once and then forgotten. They are reachable, but
     * one push deeper — a first glance that lists everything is a list nobody
     * reads (Mattias 2026-07-27, on the eighteen-row replay menu).
     */
    val settings: List<EdgeMenuOption> = emptyList(),
    /**
     * Options nobody could justify a home for. They still work and are still
     * reachable, one push below [settings], so dropping one is a decision made
     * by looking at it (Mattias 2026-07-27: "lägg dem under en junk-meny ...
     * så då får jag kolla i den kategorin sen och se om jag vill slänga
     * saker"). Deleting an option is never the menu layer's call.
     */
    val junk: List<EdgeMenuOption> = emptyList(),
) {
    init {
        require(title.isNotBlank()) { "Menu title must not be blank" }
        require(
            primarySection != null || options.isNotEmpty() ||
                settings.isNotEmpty() || junk.isNotEmpty(),
        ) {
            "Menu must contain at least one option"
        }
    }

    /** What the menu opens on. */
    val firstScreenOptions: List<EdgeMenuOption>
        get() = primarySection?.options.orEmpty() + options

    /** Everything the menu exposes, at whatever depth. */
    val allOptions: List<EdgeMenuOption>
        get() = firstScreenOptions + settings + junk
}
